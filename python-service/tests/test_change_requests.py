"""
Test suite for Change Request System

Tests:
- CR creation and lifecycle
- State transitions
- Validation integration
- Permission checks
- Event tracking
"""

import sys
import os
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from change_request_models import (
    ChangeRequest,
    ChangeRequestStatus,
    ChangeRequestStateMachine,
    ChangeRequestPermissions,
    CreateChangeRequestRequest,
    ApproveChangeRequestRequest,
    RejectChangeRequestRequest,
    ValidationSummary,
)
from change_request_service import ChangeRequestService


def test_cr_creation():
    """Test 1: Create Change Request"""
    print("\n=== Test 1: CR Creation ===")
    
    service = ChangeRequestService(delta_root="/tmp/test_delta")
    
    request = CreateChangeRequestRequest(
        project_id="proj_001",
        dataset_id="ds_001",
        session_id="sess_123",
        title="Fix customer data",
        description="Update customer emails",
        approvers=["user_002", "user_003"]
    )
    
    cr = service.create_change_request(request, created_by="user_001")
    
    assert cr.id.startswith("cr_"), f"CR ID should start with cr_, got {cr.id}"
    assert cr.status == ChangeRequestStatus.DRAFT, f"Initial status should be DRAFT"
    assert cr.project_id == "proj_001"
    assert cr.dataset_id == "ds_001"
    assert cr.created_by == "user_001"
    assert len(cr.approvers) == 2
    print(f"OK Created CR {cr.id} in DRAFT status")
    
    # Check events were created
    events = service.get_cr_events(cr.id)
    assert len(events) == 1, "Should have 1 CREATED event"
    assert events[0].event_type.value == "created"
    print("OK Created event logged")
    
    return True


def test_state_transitions():
    """Test 2: State machine transitions"""
    print("\n=== Test 2: State Transitions ===")
    
    sm = ChangeRequestStateMachine()
    
    # Valid transitions
    assert sm.can_transition(ChangeRequestStatus.DRAFT, ChangeRequestStatus.PENDING_REVIEW)
    print("OK DRAFT -> PENDING_REVIEW allowed")
    
    assert sm.can_transition(ChangeRequestStatus.PENDING_REVIEW, ChangeRequestStatus.APPROVED)
    print("OK PENDING_REVIEW -> APPROVED allowed")
    
    assert sm.can_transition(ChangeRequestStatus.PENDING_REVIEW, ChangeRequestStatus.REJECTED)
    print("OK PENDING_REVIEW -> REJECTED allowed")
    
    assert sm.can_transition(ChangeRequestStatus.APPROVED, ChangeRequestStatus.MERGED)
    print("OK APPROVED -> MERGED allowed")
    
    assert sm.can_transition(ChangeRequestStatus.MERGED, ChangeRequestStatus.CLOSED)
    print("OK MERGED -> CLOSED allowed")
    
    # Invalid transitions
    assert not sm.can_transition(ChangeRequestStatus.DRAFT, ChangeRequestStatus.APPROVED)
    print("OK DRAFT -> APPROVED blocked")
    
    assert not sm.can_transition(ChangeRequestStatus.DRAFT, ChangeRequestStatus.MERGED)
    print("OK DRAFT -> MERGED blocked")
    
    assert not sm.can_transition(ChangeRequestStatus.CLOSED, ChangeRequestStatus.DRAFT)
    print("OK CLOSED is terminal state")
    
    return True


def test_submit_for_review():
    """Test 3: Submit CR for review"""
    print("\n=== Test 3: Submit for Review ===")
    
    service = ChangeRequestService(delta_root="/tmp/test_delta")
    
    # Create CR
    request = CreateChangeRequestRequest(
        project_id="proj_001",
        dataset_id="ds_001",
        title="Test submission",
        approvers=["user_002"]
    )
    cr = service.create_change_request(request, created_by="user_001")
    
    # Create validation summary (clean)
    validation = ValidationSummary(
        state="PASSED",
        counts={"info": 10, "warning": 0, "error": 0, "fatal": 0},
        messages=[]
    )
    
    # Submit for review
    success, error, updated_cr = service.submit_for_review(
        cr.id,
        "user_001",
        validation
    )
    
    assert success, f"Submission should succeed, got error: {error}"
    assert updated_cr.status == ChangeRequestStatus.PENDING_REVIEW
    assert updated_cr.warnings_count == 0
    assert updated_cr.errors_count == 0
    print(f"OK CR {cr.id} submitted for review")
    
    # Check events
    events = service.get_cr_events(cr.id)
    assert len(events) == 2, "Should have CREATED and SUBMITTED events"
    print("OK Submitted event logged")
    
    return True


def test_validation_blocking():
    """Test 4: Validation blocks submission"""
    print("\n=== Test 4: Validation Blocking ===")
    
    service = ChangeRequestService(delta_root="/tmp/test_delta")
    
    # Create CR
    request = CreateChangeRequestRequest(
        project_id="proj_001",
        dataset_id="ds_001",
        title="Test with errors"
    )
    cr = service.create_change_request(request, created_by="user_001")
    
    # Validation with errors
    validation = ValidationSummary(
        state="FAILED",
        counts={"info": 5, "warning": 2, "error": 3, "fatal": 0},
        messages=[{"column": "email", "message": "Invalid format"}]
    )
    
    # Try to submit - should fail
    success, error, updated_cr = service.submit_for_review(
        cr.id,
        "user_001",
        validation
    )
    
    assert not success, "Submission should fail with errors"
    assert "blocking validation errors" in error.lower()
    assert updated_cr.status == ChangeRequestStatus.DRAFT
    print("OK Submission blocked by validation errors")
    
    # Try with fatal errors
    validation_fatal = ValidationSummary(
        state="FAILED",
        counts={"info": 0, "warning": 0, "error": 0, "fatal": 1},
        messages=[{"column": "id", "message": "Duplicate ID"}]
    )
    
    success, error, updated_cr = service.submit_for_review(
        cr.id,
        "user_001",
        validation_fatal
    )
    
    assert not success, "Submission should fail with fatal errors"
    assert "fatal" in error.lower()
    print("OK Submission blocked by fatal errors")
    
    # Warnings should be allowed
    validation_warning = ValidationSummary(
        state="PARTIAL_PASS",
        counts={"info": 10, "warning": 2, "error": 0, "fatal": 0},
        messages=[{"column": "amount", "message": "High value"}]
    )
    
    success, error, updated_cr = service.submit_for_review(
        cr.id,
        "user_001",
        validation_warning
    )
    
    assert success, "Submission should succeed with warnings only"
    assert updated_cr.warnings_count == 2
    print("OK Submission allowed with warnings")
    
    return True


def test_approval_workflow():
    """Test 5: Approval workflow"""
    print("\n=== Test 5: Approval Workflow ===")
    
    service = ChangeRequestService(delta_root="/tmp/test_delta")
    
    # Create and submit CR
    request = CreateChangeRequestRequest(
        project_id="proj_001",
        dataset_id="ds_001",
        title="Test approval",
        approvers=["user_002"]
    )
    cr = service.create_change_request(request, created_by="user_001")
    
    validation = ValidationSummary(
        state="PASSED",
        counts={"info": 5, "warning": 0, "error": 0, "fatal": 0},
        messages=[]
    )
    service.submit_for_review(cr.id, "user_001", validation)
    
    # Approve CR
    approve_req = ApproveChangeRequestRequest(
        approver_id="user_002",
        message="Looks good!"
    )
    
    success, error, approved_cr = service.approve_change_request(cr.id, approve_req)
    
    assert success, f"Approval should succeed, got error: {error}"
    assert approved_cr.status == ChangeRequestStatus.APPROVED
    assert approved_cr.approved_at is not None
    print(f"OK CR {cr.id} approved by user_002")
    
    # Check events
    events = service.get_cr_events(cr.id)
    assert any(evt.event_type.value == "approved" for evt in events)
    print("OK Approved event logged")
    
    return True


def test_rejection_workflow():
    """Test 6: Rejection workflow"""
    print("\n=== Test 6: Rejection Workflow ===")
    
    service = ChangeRequestService(delta_root="/tmp/test_delta")
    
    # Create and submit CR
    request = CreateChangeRequestRequest(
        project_id="proj_001",
        dataset_id="ds_001",
        title="Test rejection"
    )
    cr = service.create_change_request(request, created_by="user_001")
    
    validation = ValidationSummary(
        state="PASSED",
        counts={"info": 5, "warning": 0, "error": 0, "fatal": 0},
        messages=[]
    )
    service.submit_for_review(cr.id, "user_001", validation)
    
    # Reject CR
    reject_req = RejectChangeRequestRequest(
        reviewer_id="user_002",
        message="Data looks incorrect, please review"
    )
    
    success, error, rejected_cr = service.reject_change_request(cr.id, reject_req)
    
    assert success, f"Rejection should succeed, got error: {error}"
    assert rejected_cr.status == ChangeRequestStatus.REJECTED
    assert rejected_cr.rejected_at is not None
    print(f"OK CR {cr.id} rejected by user_002")
    
    # Check events
    events = service.get_cr_events(cr.id)
    rejected_event = next(evt for evt in events if evt.event_type.value == "rejected")
    assert rejected_event.message == "Data looks incorrect, please review"
    print("OK Rejection event logged with message")
    
    return True


def test_permissions():
    """Test 7: Permission checks"""
    print("\n=== Test 7: Permissions ===")
    
    perms = ChangeRequestPermissions()
    
    # Owner permissions
    assert perms.can_create_cr("owner")
    assert perms.can_approve_cr("owner")
    assert perms.can_merge_cr("owner")
    assert perms.can_view_cr("owner")
    print("OK Owner has all permissions")
    
    # Contributor permissions
    assert perms.can_create_cr("contributor")
    assert perms.can_approve_cr("contributor")
    assert perms.can_merge_cr("contributor")
    print("OK Contributor has create/approve/merge permissions")
    
    # Viewer permissions
    assert not perms.can_create_cr("viewer")
    assert perms.can_approve_cr("viewer")
    assert perms.can_merge_cr("viewer")
    assert perms.can_view_cr("viewer")
    print("OK Viewer cannot create but can approve/view")
    
    return True


def test_list_and_filter():
    """Test 8: List and filter CRs"""
    print("\n=== Test 8: List and Filter ===")
    
    service = ChangeRequestService(delta_root="/tmp/test_delta")
    
    # Create multiple CRs
    for i in range(5):
        request = CreateChangeRequestRequest(
            project_id="proj_001" if i < 3 else "proj_002",
            dataset_id=f"ds_{i:03d}",
            title=f"CR {i}"
        )
        cr = service.create_change_request(request, created_by="user_001")
        
        # Submit some
        if i % 2 == 0:
            validation = ValidationSummary(
                state="PASSED",
                counts={"info": 5, "warning": 0, "error": 0, "fatal": 0}
            )
            service.submit_for_review(cr.id, "user_001", validation)
    
    # List all
    all_crs = service.list_change_requests()
    assert len(all_crs) >= 5
    print(f"OK Listed all CRs: {len(all_crs)}")
    
    # Filter by project
    proj1_crs = service.list_change_requests(project_id="proj_001")
    assert len(proj1_crs) >= 3
    print(f"OK Filtered by project: {len(proj1_crs)}")
    
    # Filter by status
    pending_crs = service.list_change_requests(status=ChangeRequestStatus.PENDING_REVIEW)
    assert len(pending_crs) >= 3
    print(f"OK Filtered by status: {len(pending_crs)}")
    
    # Combined filters
    proj1_pending = service.list_change_requests(
        project_id="proj_001",
        status=ChangeRequestStatus.PENDING_REVIEW
    )
    assert len(proj1_pending) >= 2
    print(f"OK Combined filters: {len(proj1_pending)}")
    
    return True


def run_all_tests():
    """Run all CR tests"""
    print("=" * 60)
    print("Change Request System Test Suite")
    print("=" * 60)
    
    tests = [
        ("CR Creation", test_cr_creation),
        ("State Transitions", test_state_transitions),
        ("Submit for Review", test_submit_for_review),
        ("Validation Blocking", test_validation_blocking),
        ("Approval Workflow", test_approval_workflow),
        ("Rejection Workflow", test_rejection_workflow),
        ("Permissions", test_permissions),
        ("List and Filter", test_list_and_filter),
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
