"""
Test suite for Delta Lake folder structure implementation.

Tests:
1. Dataset structure creation
2. Main table operations
3. Staging table operations
4. Live edit sessions
5. Query operations
6. Merge operations
7. Cleanup operations
"""

import sys
import os
import tempfile
import shutil
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from delta_adapter import DeltaStorageAdapter, DeltaConfig


def test_dataset_structure_creation():
    """Test 1: Dataset structure creation"""
    print("\n=== Test 1: Dataset Structure Creation ===")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config = DeltaConfig(root=tmpdir)
        adapter = DeltaStorageAdapter(config)
        
        project_id = 1001
        dataset_id = 3201
        
        # Create dataset structure
        root = adapter.create_dataset_structure(project_id, dataset_id)
        
        # Verify all directories exist
        expected_dirs = [
            "main",
            "staging",
            "live_edit",
            "imports",
            "audit",
            "audit/validation_runs",
            "audit/snapshots",
            "audit/history"
        ]
        
        for dir_name in expected_dirs:
            dir_path = os.path.join(root, dir_name)
            assert os.path.exists(dir_path), f"Directory {dir_name} not created"
            assert os.path.isdir(dir_path), f"{dir_name} is not a directory"
        
        print("✓ All directories created successfully")
        print(f"✓ Dataset root: {root}")
        return True


def test_main_table_operations():
    """Test 2: Main table operations"""
    print("\n=== Test 2: Main Table Operations ===")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config = DeltaConfig(root=tmpdir)
        adapter = DeltaStorageAdapter(config)
        
        project_id = 1001
        dataset_id = 3201
        
        # Create main table with schema
        schema = {
            "properties": {
                "id": {"type": "integer"},
                "name": {"type": "string"},
                "email": {"type": "string"},
                "age": {"type": "integer"}
            }
        }
        
        path = adapter.ensure_main_table(project_id, dataset_id, schema)
        assert os.path.exists(path), "Main table path not created"
        assert os.path.exists(os.path.join(path, "_delta_log")), "Delta log not created"
        print("✓ Main table created with schema")
        
        # Append rows to main table
        rows = [
            {"id": 1, "name": "Alice", "email": "alice@example.com", "age": 30},
            {"id": 2, "name": "Bob", "email": "bob@example.com", "age": 25},
            {"id": 3, "name": "Charlie", "email": "charlie@example.com", "age": 35}
        ]
        
        result = adapter.append_to_main(project_id, dataset_id, rows)
        assert result["ok"], "Append failed"
        assert result["inserted"] == 3, "Wrong number of rows inserted"
        print(f"✓ Appended {result['inserted']} rows to main table")
        
        # Query main table
        query_result = adapter.query_main(project_id, dataset_id, limit=10)
        assert query_result["count"] == 3, "Query returned wrong number of rows"
        assert len(query_result["rows"]) == 3, "Query rows count mismatch"
        print(f"✓ Queried main table: {query_result['count']} rows returned")
        
        # Verify data
        names = [row["name"] for row in query_result["rows"]]
        assert "Alice" in names, "Alice not found in results"
        assert "Bob" in names, "Bob not found in results"
        assert "Charlie" in names, "Charlie not found in results"
        print("✓ Data integrity verified")
        
        return True


def test_staging_operations():
    """Test 3: Staging table operations"""
    print("\n=== Test 3: Staging Table Operations ===")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config = DeltaConfig(root=tmpdir)
        adapter = DeltaStorageAdapter(config)
        
        project_id = 1001
        dataset_id = 3201
        change_request_id = 99231
        
        # Create main table first
        schema = {
            "properties": {
                "id": {"type": "integer"},
                "name": {"type": "string"},
                "value": {"type": "number"}
            }
        }
        adapter.ensure_main_table(project_id, dataset_id, schema)
        
        # Add initial data to main
        main_rows = [
            {"id": 1, "name": "Item A", "value": 100.0},
            {"id": 2, "name": "Item B", "value": 200.0}
        ]
        adapter.append_to_main(project_id, dataset_id, main_rows)
        print("✓ Main table initialized with 2 rows")
        
        # Create staging table for change request
        staging_rows = [
            {"id": 2, "name": "Item B Updated", "value": 250.0},  # Update existing
            {"id": 3, "name": "Item C", "value": 300.0}  # New row
        ]
        
        staging_path = adapter.create_staging_table(project_id, dataset_id, change_request_id, staging_rows)
        assert os.path.exists(staging_path), "Staging table not created"
        print(f"✓ Staging table created with {len(staging_rows)} rows")
        
        # Query staging table
        staging_query = adapter.query_staging(project_id, dataset_id, change_request_id, limit=10)
        assert staging_query["count"] == 2, "Staging query returned wrong count"
        print(f"✓ Staging table queried: {staging_query['count']} rows")
        
        # Merge staging to main
        merge_result = adapter.merge_staging_to_main(project_id, dataset_id, change_request_id, keys=["id"])
        assert merge_result["ok"], "Merge failed"
        print(f"✓ Staging merged to main (method: {merge_result['method']})")
        
        # Verify staging table was deleted
        assert not os.path.exists(staging_path), "Staging table not deleted after merge"
        print("✓ Staging table cleaned up after merge")
        
        # Verify main table has merged data
        main_query = adapter.query_main(project_id, dataset_id, limit=10)
        assert main_query["count"] == 3, f"Expected 3 rows after merge, got {main_query['count']}"
        
        # Verify data correctness
        item_b = next((r for r in main_query["rows"] if r["id"] == 2), None)
        assert item_b is not None, "Item B not found after merge"
        assert item_b["name"] == "Item B Updated", "Item B not updated"
        assert item_b["value"] == 250.0, "Item B value not updated"
        
        item_c = next((r for r in main_query["rows"] if r["id"] == 3), None)
        assert item_c is not None, "Item C not found after merge"
        
        print("✓ Merge data integrity verified")
        
        return True


def test_live_edit_operations():
    """Test 4: Live edit session operations"""
    print("\n=== Test 4: Live Edit Session Operations ===")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config = DeltaConfig(root=tmpdir)
        adapter = DeltaStorageAdapter(config)
        
        project_id = 1001
        dataset_id = 3201
        session_id = "sess_1234"
        
        # Create dataset structure
        adapter.create_dataset_structure(project_id, dataset_id)
        
        # Create live edit session
        session_path = adapter.create_live_edit_session(project_id, dataset_id, session_id)
        assert os.path.exists(session_path), "Live edit session not created"
        assert os.path.exists(os.path.join(session_path, "_delta_log")), "Live edit delta log not created"
        print("✓ Live edit session created")
        
        # Add edits
        edits = [
            {
                "edit_id": "edit_001",
                "session_id": session_id,
                "row_id": "row_1",
                "column": "name",
                "old_value": "Old Name",
                "new_value": "New Name",
                "user_id": "user_123",
                "ts": datetime.now(),
                "validation": '{"status": "valid"}'
            },
            {
                "edit_id": "edit_002",
                "session_id": session_id,
                "row_id": "row_2",
                "column": "value",
                "old_value": "100",
                "new_value": "150",
                "user_id": "user_123",
                "ts": datetime.now(),
                "validation": '{"status": "valid"}'
            }
        ]
        
        result = adapter.append_live_edit(project_id, dataset_id, session_id, edits)
        assert result["ok"], "Append live edit failed"
        assert result["edits_added"] == 2, "Wrong number of edits added"
        print(f"✓ Added {result['edits_added']} cell edits")
        
        # Query live edits
        edit_query = adapter.query_live_edit(project_id, dataset_id, session_id, limit=10)
        assert edit_query["count"] == 2, "Live edit query returned wrong count"
        print(f"✓ Queried live edits: {edit_query['count']} edits found")
        
        # Verify edit data
        edit_001 = next((e for e in edit_query["rows"] if e["edit_id"] == "edit_001"), None)
        assert edit_001 is not None, "Edit 001 not found"
        assert edit_001["column"] == "name", "Edit column mismatch"
        assert edit_001["new_value"] == "New Name", "Edit new_value mismatch"
        print("✓ Live edit data integrity verified")
        
        # Delete session
        adapter.delete_live_edit_session(project_id, dataset_id, session_id)
        session_dir = os.path.dirname(session_path)
        assert not os.path.exists(session_dir), "Live edit session not deleted"
        print("✓ Live edit session cleaned up")
        
        return True


def test_history_and_restore():
    """Test 5: History and restore operations"""
    print("\n=== Test 5: History and Restore Operations ===")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config = DeltaConfig(root=tmpdir)
        adapter = DeltaStorageAdapter(config)
        
        project_id = 1001
        dataset_id = 3201
        
        # Create main table
        schema = {"properties": {"id": {"type": "integer"}, "value": {"type": "string"}}}
        adapter.ensure_main_table(project_id, dataset_id, schema)
        
        # Version 0 (initial empty table)
        
        # Version 1: Add initial data
        adapter.append_to_main(project_id, dataset_id, [{"id": 1, "value": "v1"}])
        
        # Version 2: Add more data
        adapter.append_to_main(project_id, dataset_id, [{"id": 2, "value": "v2"}])
        
        # Get history
        history = adapter.history(project_id, dataset_id)
        assert len(history) >= 2, f"Expected at least 2 history entries, got {len(history)}"
        print(f"✓ Retrieved {len(history)} history entries")
        
        # Verify current state
        current = adapter.query_main(project_id, dataset_id, limit=10)
        assert current["count"] == 2, "Expected 2 rows in current state"
        print(f"✓ Current state: {current['count']} rows")
        
        # Restore to version 1
        restore_result = adapter.restore(project_id, dataset_id, version=1)
        assert restore_result["ok"], "Restore failed"
        assert restore_result["restored_to"] == 1, "Restored to wrong version"
        print(f"✓ Restored to version {restore_result['restored_to']}")
        
        # Verify restored state
        restored = adapter.query_main(project_id, dataset_id, limit=10)
        assert restored["count"] == 1, f"Expected 1 row after restore, got {restored['count']}"
        assert restored["rows"][0]["value"] == "v1", "Restored data mismatch"
        print("✓ Restore data integrity verified")
        
        return True


def test_query_filters():
    """Test 6: Query filtering operations"""
    print("\n=== Test 6: Query Filters ===")
    
    with tempfile.TemporaryDirectory() as tmpdir:
        config = DeltaConfig(root=tmpdir)
        adapter = DeltaStorageAdapter(config)
        
        project_id = 1001
        dataset_id = 3201
        
        # Create and populate table
        schema = {
            "properties": {
                "id": {"type": "integer"},
                "category": {"type": "string"},
                "active": {"type": "boolean"},
                "score": {"type": "number"}
            }
        }
        adapter.ensure_main_table(project_id, dataset_id, schema)
        
        rows = [
            {"id": 1, "category": "A", "active": True, "score": 95.5},
            {"id": 2, "category": "B", "active": False, "score": 82.3},
            {"id": 3, "category": "A", "active": True, "score": 88.7},
            {"id": 4, "category": "C", "active": True, "score": 91.2}
        ]
        adapter.append_to_main(project_id, dataset_id, rows)
        print("✓ Test data created")
        
        # Test filter by category
        result = adapter.query_main(project_id, dataset_id, filters={"category": "A"}, limit=10)
        assert result["count"] == 2, f"Expected 2 rows for category A, got {result['count']}"
        print(f"✓ Filter by category: {result['count']} rows")
        
        # Test filter by boolean
        result = adapter.query_main(project_id, dataset_id, filters={"active": True}, limit=10)
        assert result["count"] == 3, f"Expected 3 active rows, got {result['count']}"
        print(f"✓ Filter by boolean: {result['count']} rows")
        
        # Test order by
        result = adapter.query_main(project_id, dataset_id, order_by="score DESC", limit=10)
        assert result["rows"][0]["score"] == 95.5, "Order by not working correctly"
        print("✓ Order by working correctly")
        
        # Test limit and offset
        result = adapter.query_main(project_id, dataset_id, limit=2, offset=1)
        assert result["count"] == 2, "Limit not working"
        print("✓ Limit and offset working correctly")
        
        return True


def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("Delta Lake Implementation Test Suite")
    print("=" * 60)
    
    tests = [
        ("Dataset Structure Creation", test_dataset_structure_creation),
        ("Main Table Operations", test_main_table_operations),
        ("Staging Operations", test_staging_operations),
        ("Live Edit Operations", test_live_edit_operations),
        ("History and Restore", test_history_and_restore),
        ("Query Filters", test_query_filters)
    ]
    
    passed = 0
    failed = 0
    
    for test_name, test_func in tests:
        try:
            if test_func():
                passed += 1
                print(f"\n✅ {test_name} - PASSED")
            else:
                failed += 1
                print(f"\n❌ {test_name} - FAILED")
        except Exception as e:
            failed += 1
            print(f"\n❌ {test_name} - FAILED")
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
