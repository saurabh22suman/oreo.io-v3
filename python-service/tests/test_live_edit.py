"""
Test suite for Live Edit System

Tests:
- Session creation and lifecycle
- Cell editing and validation
- Grid data overlay
- Preview generation
- Bulk edits
- Session expiry and cleanup
"""

import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from live_edit_models import (
    SessionMode,
    SessionStatus,
    StartSessionRequest,
    CellEditRequest,
    BulkEditRequest,
    GridDataRequest,
)
from live_edit_service import LiveEditService


def test_start_session():
    """Test 1: Start live edit session"""
    print("\n=== Test 1: Start Session ===")
    
    service = LiveEditService(delta_root="/tmp/test_delta")
    
    request = StartSessionRequest(
        user_id="user_001",
        mode=SessionMode.FULL_TABLE
    )
    
    response = service.start_session(request, "proj_001", "ds_001")
    
    assert response.session_id.startswith("sess_"), f"Session ID should start with sess_"
    assert len(response.editable_columns) > 0, "Should have editable columns"
    assert response.rules_map is not None, "Should have rules map"
    print(f"OK Created session {response.session_id}")
    print(f"OK Editable columns: {response.editable_columns}")
    
    # Verify session is stored
    session = service.get_session(response.session_id)
    assert session is not None, "Session should be retrievable"
    assert session.status == SessionStatus.ACTIVE
    assert session.can_edit(), "Session should be editable"
    print("OK Session is active and editable")
    
    return True


def test_save_cell_edit():
    """Test 2: Save cell edit"""
    print("\n=== Test 2: Save Cell Edit ===")
    
    service = LiveEditService(delta_root="/tmp/test_delta")
    
    # Start session
    start_req = StartSessionRequest(user_id="user_001")
    response = service.start_session(start_req, "proj_001", "ds_001")
    session_id = response.session_id
    
    # Save cell edit
    edit_req = CellEditRequest(
        row_id="123",
        column="amount",
        new_value=450.50,
        client_ts=datetime.utcnow().isoformat()
    )
    
    edit_response = service.save_cell_edit(session_id, edit_req, "user_001")
    
    assert edit_response.edit_id is not None, "Should return edit_id"
    assert edit_response.status == "ok", f"Status should be ok, got {edit_response.status}"
    assert edit_response.validation is not None, "Should include validation"
    print(f"OK Saved edit {edit_response.edit_id}")
    
    # Verify session statistics updated
    session = service.get_session(session_id)
    assert session.edit_count == 1, "Edit count should be 1"
    assert session.cells_changed == 1, "Cells changed should be 1"
    print("OK Session statistics updated")
    
    # Verify edit is retrievable
    edits = service.get_session_edits(session_id)
    assert len(edits) == 1, "Should have 1 edit"
    assert edits[0].row_id == "123"
    assert edits[0].column == "amount"
    print("OK Edit is retrievable")
    
    return True


def test_bulk_edits():
    """Test 3: Save bulk edits"""
    print("\n=== Test 3: Bulk Edits ===")
    
    service = LiveEditService(delta_root="/tmp/test_delta")
    
    # Start session
    start_req = StartSessionRequest(user_id="user_001")
    response = service.start_session(start_req, "proj_001", "ds_001")
    session_id = response.session_id
    
    # Create bulk edit request
    bulk_req = BulkEditRequest(
        edits=[
            CellEditRequest(row_id="100", column="amount", new_value=100.0),
            CellEditRequest(row_id="101", column="amount", new_value=200.0),
            CellEditRequest(row_id="102", column="status", new_value="approved"),
        ]
    )
    
    result = service.save_bulk_edits(session_id, bulk_req, "user_001")
    
    assert len(result["results"]) == 3, "Should have 3 results"
    print(f"OK Saved {len(result['results'])} edits in bulk")
    
    # Verify session statistics
    session = service.get_session(session_id)
    assert session.edit_count == 3, "Edit count should be 3"
    assert session.rows_affected == 3, "Rows affected should be 3"
    print("OK Bulk edit statistics correct")
    
    return True


def test_non_editable_column():
    """Test 4: Reject edit to non-editable column"""
    print("\n=== Test 4: Non-Editable Column ===")
    
    service = LiveEditService(delta_root="/tmp/test_delta")
    
    # Start session
    start_req = StartSessionRequest(user_id="user_001")
    response = service.start_session(start_req, "proj_001", "ds_001")
    session_id = response.session_id
    
    # Try to edit non-editable column (e.g., id)
    edit_req = CellEditRequest(
        row_id="123",
        column="id",  # Not in editable_columns
        new_value=999
    )
    
    edit_response = service.save_cell_edit(session_id, edit_req, "user_001")
    
    assert edit_response.status == "error", "Should reject non-editable column"
    assert "not editable" in edit_response.validation.get("messages", [""])[0].lower()
    print("OK Non-editable column rejected")
    
    return True


def test_preview_generation():
    """Test 5: Generate preview"""
    print("\n=== Test 5: Preview Generation ===")
    
    service = LiveEditService(delta_root="/tmp/test_delta")
    
    # Start session
    start_req = StartSessionRequest(user_id="user_001")
    response = service.start_session(start_req, "proj_001", "ds_001")
    session_id = response.session_id
    
    # Save some edits
    edits = [
        CellEditRequest(row_id="100", column="amount", new_value=100.0),
        CellEditRequest(row_id="100", column="status", new_value="approved"),
        CellEditRequest(row_id="101", column="amount", new_value=200.0),
    ]
    
    for edit_req in edits:
        service.save_cell_edit(session_id, edit_req, "user_001")
    
    # Generate preview
    preview = service.generate_preview(session_id)
    
    assert preview.session_id == session_id
    assert preview.rows_changed == 2, f"Expected 2 rows, got {preview.rows_changed}"
    assert preview.cells_changed == 3, f"Expected 3 cells, got {preview.cells_changed}"
    assert len(preview.diffs) == 3, "Should have 3 diffs"
    print(f"OK Preview: {preview.rows_changed} rows, {preview.cells_changed} cells changed")
    print(f"OK Validation summary: {preview.validation_summary}")
    
    return True


def test_session_modes():
    """Test 6: Session modes (full_table vs row_selection)"""
    print("\n=== Test 6: Session Modes ===")
    
    service = LiveEditService(delta_root="/tmp/test_delta")
    
    # Test FULL_TABLE mode
    full_req = StartSessionRequest(
        user_id="user_001",
        mode=SessionMode.FULL_TABLE
    )
    full_response = service.start_session(full_req, "proj_001", "ds_001")
    full_session = service.get_session(full_response.session_id)
    
    assert full_session.mode == SessionMode.FULL_TABLE
    assert len(full_session.selected_rows) == 0
    print("OK FULL_TABLE mode created")
    
    # Test ROW_SELECTION mode
    row_req = StartSessionRequest(
        user_id="user_001",
        mode=SessionMode.ROW_SELECTION,
        rows=[100, 101, 102]
    )
    row_response = service.start_session(row_req, "proj_001", "ds_001")
    row_session = service.get_session(row_response.session_id)
    
    assert row_session.mode == SessionMode.ROW_SELECTION
    assert len(row_session.selected_rows) == 3
    assert 100 in row_session.selected_rows
    print("OK ROW_SELECTION mode created with 3 rows")
    
    return True


def test_abort_session():
    """Test 7: Abort session"""
    print("\n=== Test 7: Abort Session ===")
    
    service = LiveEditService(delta_root="/tmp/test_delta")
    
    # Start session
    start_req = StartSessionRequest(user_id="user_001")
    response = service.start_session(start_req, "proj_001", "ds_001")
    session_id = response.session_id
    
    # Add some edits
    edit_req = CellEditRequest(row_id="123", column="amount", new_value=100.0)
    service.save_cell_edit(session_id, edit_req, "user_001")
    
    # Abort session
    success = service.delete_session(session_id)
    assert success, "Should successfully delete session"
    
    # Verify session is aborted
    session = service.get_session(session_id)
    assert session.status == SessionStatus.ABORTED
    print("OK Session aborted")
    
    # Verify edits are cleaned up
    edits = service.get_session_edits(session_id)
    assert len(edits) == 0, "Edits should be cleaned up"
    print("OK Edits cleaned up")
    
    return True


def test_session_expiry():
    """Test 8: Session expiry"""
    print("\n=== Test 8: Session Expiry ===")
    
    service = LiveEditService(delta_root="/tmp/test_delta")
    
    # Start session
    start_req = StartSessionRequest(user_id="user_001")
    response = service.start_session(start_req, "proj_001", "ds_001")
    session_id = response.session_id
    
    # Manually set expiry to past
    session = service.get_session(session_id)
    session.expires_at = datetime.utcnow() - timedelta(hours=1)
    
    # Check expiry
    assert session.is_expired(), "Session should be expired"
    assert not session.can_edit(), "Expired session should not be editable"
    print("OK Session expiry check works")
    
    # Cleanup expired sessions
    cleaned = service.cleanup_expired_sessions()
    assert cleaned >= 1, "Should clean at least 1 session"
    print(f"OK Cleaned {cleaned} expired sessions")
    
    # Verify session status updated
    session = service.get_session(session_id)
    assert session.status == SessionStatus.EXPIRED
    print("OK Session marked as expired")
    
    return True


def run_all_tests():
    """Run all Live Edit tests"""
    print("=" * 60)
    print("Live Edit System Test Suite")
    print("=" * 60)
    
    tests = [
        ("Start Session", test_start_session),
        ("Save Cell Edit", test_save_cell_edit),
        ("Bulk Edits", test_bulk_edits),
        ("Non-Editable Column", test_non_editable_column),
        ("Preview Generation", test_preview_generation),
        ("Session Modes", test_session_modes),
        ("Abort Session", test_abort_session),
        ("Session Expiry", test_session_expiry),
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n[PASS] {test_name}")
            else:
                failed += 1
                print(f"\n[FAIL] {test_name}")
        except Exception as e:
            failed += 1
            print(f"\n[FAIL] {test_name}")
            print(f"   Error: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print(f"Test Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    print("=" * 60)
    
    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
