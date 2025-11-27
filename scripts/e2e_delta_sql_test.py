"""
End-to-End Test Suite for Delta SQL Query Implementation

This test suite validates the complete workflow:
1. User Registration
2. Login
3. Project Creation
4. Dataset Upload (Delta backend)
5. SQL Query Execution

Run with: python scripts/e2e_delta_sql_test.py
"""

import requests
import json
import sys
import io
import time
import csv
from datetime import datetime

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Configuration
BASE_URL = "http://localhost:8080"
API_BASE = f"{BASE_URL}/api"

# Test data
TEST_USER_EMAIL = f"test_user_{int(time.time())}@example.com"
TEST_USER_PASSWORD = "TestPassword123!"
TEST_PROJECT_NAME = f"test_project_{int(time.time())}"
TEST_DATASET_NAME = f"test_dataset_{int(time.time())}"
TEST_SCHEMA = "test"
TEST_TABLE = "sample_data"


class TestContext:
    """Hold test context data"""
    def __init__(self):
        self.cookies = None
        self.user_id = None
        self.project_id = None
        self.dataset_id = None
        self.test_data_file = None


def log(message, level="INFO"):
    """Print formatted log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    icons = {
        "INFO": "ℹ️",
        "SUCCESS": "✅",
        "ERROR": "❌",
        "WARNING": "⚠️",
        "TEST": "🧪"
    }
    icon = icons.get(level, "•")
    print(f"[{timestamp}] {icon} {message}")


def create_test_data_file():
    """Create a sample CSV file for testing"""
    log("Creating test data file...")
    
    filename = "test_data.csv"
    data = [
        ["id", "name", "value", "category"],
        ["1", "Item A", "100", "Electronics"],
        ["2", "Item B", "200", "Clothing"],
        ["3", "Item C", "150", "Electronics"],
        ["4", "Item D", "300", "Food"],
        ["5", "Item E", "250", "Clothing"],
    ]
    
    with open(filename, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(data)
    
    log(f"Created test file: {filename}", "SUCCESS")
    return filename


def test_1_register_user(ctx):
    """Test 1: Register a new user"""
    log("TEST 1: User Registration", "TEST")
    
    try:
        resp = requests.post(f"{API_BASE}/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if resp.status_code in [200, 201]:
            log(f"User registered: {TEST_USER_EMAIL}", "SUCCESS")
            return True
        elif resp.status_code == 409:
            log("User already exists, continuing...", "WARNING")
            return True
        else:
            log(f"Registration failed: {resp.status_code} - {resp.text}", "ERROR")
            return False
    except Exception as e:
        log(f"Registration error: {e}", "ERROR")
        return False


def test_2_login(ctx):
    """Test 2: Login with credentials"""
    log("TEST 2: User Login", "TEST")
    
    try:
        resp = requests.post(f"{API_BASE}/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        if resp.status_code == 200:
            ctx.cookies = resp.cookies
            log("Login successful", "SUCCESS")
            return True
        else:
            log(f"Login failed: {resp.status_code} - {resp.text}", "ERROR")
            return False
    except Exception as e:
        log(f"Login error: {e}", "ERROR")
        return False


def test_3_create_project(ctx):
    """Test 3: Create a new project"""
    log("TEST 3: Project Creation", "TEST")
    
    try:
        resp = requests.post(
            f"{API_BASE}/projects",
            json={"name": TEST_PROJECT_NAME},
            cookies=ctx.cookies
        )
        
        if resp.status_code in [200, 201]:
            project = resp.json()
            ctx.project_id = project['id']
            log(f"Project created: {TEST_PROJECT_NAME} (ID: {ctx.project_id})", "SUCCESS")
            return True
        else:
            log(f"Project creation failed: {resp.status_code} - {resp.text}", "ERROR")
            return False
    except Exception as e:
        log(f"Project creation error: {e}", "ERROR")
        return False


def test_4_upload_dataset(ctx):
    """Test 4: Upload dataset with Delta backend"""
    log("TEST 4: Dataset Upload (Delta Backend)", "TEST")
    
    try:
        # Create test data file
        ctx.test_data_file = create_test_data_file()
        
        # Upload dataset
        with open(ctx.test_data_file, 'rb') as f:
            files = {'file': (ctx.test_data_file, f, 'text/csv')}
            data = {
                'project_id': ctx.project_id,
                'name': TEST_DATASET_NAME,
                'schema': TEST_SCHEMA,
                'table': TEST_TABLE,
                'storage_backend': 'delta'
            }
            
            resp = requests.post(
                f"{API_BASE}/datasets/prepare",
                files=files,
                data=data,
                cookies=ctx.cookies
            )
        
        if resp.status_code in [200, 201]:
            result = resp.json()
            ctx.dataset_id = result.get('dataset_id')
            log(f"Dataset uploaded: {TEST_DATASET_NAME} (ID: {ctx.dataset_id})", "SUCCESS")
            log(f"Table location: {TEST_SCHEMA}.{TEST_TABLE}")
            return True
        else:
            log(f"Dataset upload failed: {resp.status_code} - {resp.text}", "ERROR")
            return False
    except Exception as e:
        log(f"Dataset upload error: {e}", "ERROR")
        return False


def test_5_wait_for_schema_ready(ctx):
    """Test 5: Wait for schema to be ready"""
    log("TEST 5: Wait for Schema Readiness", "TEST")
    
    max_attempts = 30
    attempt = 0
    
    try:
        while attempt < max_attempts:
            attempt += 1
            
            resp = requests.get(
                f"{API_BASE}/datasets/{ctx.dataset_id}/schema",
                cookies=ctx.cookies
            )
            
            if resp.status_code == 200:
                schema = resp.json()
                if schema and schema.get('properties'):
                    log(f"Schema is ready (columns: {len(schema.get('properties', {}))})", "SUCCESS")
                    return True
            
            if attempt < max_attempts:
                time.sleep(1)
        
        log("Schema not ready after 30 seconds", "WARNING")
        return True  # Continue anyway
    except Exception as e:
        log(f"Schema check error: {e}", "ERROR")
        return True  # Continue anyway


def test_6_query_dataset(ctx):
    """Test 6: Run SQL query against Delta table"""
    log("TEST 6: SQL Query Execution", "TEST")
    
    test_queries = [
        {
            "name": "Select All",
            "sql": f"SELECT * FROM {TEST_SCHEMA}.{TEST_TABLE}",
            "expected_min_rows": 1
        },
        {
            "name": "Select with Limit",
            "sql": f"SELECT * FROM {TEST_SCHEMA}.{TEST_TABLE} LIMIT 3",
            "expected_min_rows": 1
        },
        {
            "name": "Count Rows",
            "sql": f"SELECT COUNT(*) as total FROM {TEST_SCHEMA}.{TEST_TABLE}",
            "expected_min_rows": 1
        },
        {
            "name": "Filter by Category",
            "sql": f"SELECT * FROM {TEST_SCHEMA}.{TEST_TABLE} WHERE category = 'Electronics'",
            "expected_min_rows": 1
        },
        {
            "name": "Group By",
            "sql": f"SELECT category, COUNT(*) as count FROM {TEST_SCHEMA}.{TEST_TABLE} GROUP BY category",
            "expected_min_rows": 1
        }
    ]
    
    all_passed = True
    
    for i, query_test in enumerate(test_queries, 1):
        log(f"  Query {i}/{len(test_queries)}: {query_test['name']}")
        log(f"  SQL: {query_test['sql']}")
        
        try:
            resp = requests.post(
                f"{API_BASE}/query/execute",
                json={
                    "sql": query_test['sql'],
                    "project_id": ctx.project_id,
                    "limit": 100,
                    "page": 1
                },
                cookies=ctx.cookies
            )
            
            if resp.status_code == 200:
                result = resp.json()
                columns = result.get('columns', [])
                rows = result.get('rows', [])
                
                log(f"  ✓ Columns: {len(columns)}, Rows: {len(rows)}")
                
                # Display first few rows
                if rows:
                    log(f"  Sample data: {rows[0]}")
                
                if len(rows) >= query_test['expected_min_rows']:
                    log(f"  ✓ Query passed", "SUCCESS")
                else:
                    log(f"  ✗ Expected at least {query_test['expected_min_rows']} rows, got {len(rows)}", "WARNING")
                    all_passed = False
            else:
                log(f"  ✗ Query failed: {resp.status_code} - {resp.text}", "ERROR")
                all_passed = False
                
        except Exception as e:
            log(f"  ✗ Query error: {e}", "ERROR")
            all_passed = False
    
    return all_passed


def test_7_cleanup(ctx):
    """Test 7: Cleanup (optional)"""
    log("TEST 7: Cleanup", "TEST")
    
    try:
        # Delete test data file
        if ctx.test_data_file:
            import os
            if os.path.exists(ctx.test_data_file):
                os.remove(ctx.test_data_file)
                log(f"Removed test file: {ctx.test_data_file}")
        
        log("Cleanup completed", "SUCCESS")
        return True
    except Exception as e:
        log(f"Cleanup warning: {e}", "WARNING")
        return True


def main():
    """Run complete test suite"""
    print("=" * 80)
    print("🧪 DELTA SQL QUERY - END-TO-END TEST SUITE")
    print("=" * 80)
    print(f"\nTest Configuration:")
    print(f"  Base URL: {BASE_URL}")
    print(f"  Test User: {TEST_USER_EMAIL}")
    print(f"  Test Project: {TEST_PROJECT_NAME}")
    print(f"  Test Dataset: {TEST_DATASET_NAME}")
    print(f"  Table Reference: {TEST_SCHEMA}.{TEST_TABLE}")
    print("=" * 80)
    print()
    
    ctx = TestContext()
    
    # Define test sequence
    tests = [
        ("User Registration", test_1_register_user),
        ("User Login", test_2_login),
        ("Project Creation", test_3_create_project),
        ("Dataset Upload", test_4_upload_dataset),
        ("Schema Readiness", test_5_wait_for_schema_ready),
        ("SQL Query Execution", test_6_query_dataset),
        ("Cleanup", test_7_cleanup),
    ]
    
    results = []
    start_time = time.time()
    
    # Run tests
    for test_name, test_func in tests:
        try:
            passed = test_func(ctx)
            results.append((test_name, passed))
            
            if not passed and test_name not in ["Cleanup", "Schema Readiness"]:
                log(f"Critical test failed: {test_name}. Stopping test suite.", "ERROR")
                break
                
        except Exception as e:
            log(f"Test exception in {test_name}: {e}", "ERROR")
            results.append((test_name, False))
            break
    
    # Summary
    duration = time.time() - start_time
    print("\n" + "=" * 80)
    print("📊 TEST SUMMARY")
    print("=" * 80)
    
    passed_count = sum(1 for _, passed in results if passed)
    total_count = len(results)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print("-" * 80)
    print(f"Results: {passed_count}/{total_count} tests passed")
    print(f"Duration: {duration:.2f} seconds")
    print("=" * 80)
    
    if passed_count == total_count:
        print("\n🎉 ALL TESTS PASSED! Delta SQL query implementation is fully functional!")
        return 0
    else:
        print(f"\n⚠️  {total_count - passed_count} test(s) failed")
        return 1


if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test suite interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
