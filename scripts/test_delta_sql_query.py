"""
Test script for Delta SQL Query Implementation

This script tests the ability to query Delta tables using SQL through the API.
"""

import requests
import json
import sys
import io

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Configuration
BASE_URL = "http://localhost:8080"
API_BASE = f"{BASE_URL}/api"

# Test credentials (using the ones from previous scripts)
EMAIL = "admin@oreo.io"
PASSWORD = "admin123"

def login():
    """Login and get session"""
    print("🔐 Logging in...")
    resp = requests.post(f"{BASE_URL}/login", json={
        "email": EMAIL,
        "password": PASSWORD
    })
    if resp.status_code != 200:
        print(f"❌ Login failed: {resp.status_code} - {resp.text}")
        sys.exit(1)
    print("✅ Login successful")
    return resp.cookies

def get_or_create_project(cookies):
    """Get or create test project"""
    print("\n📁 Getting project...")
    
    # List projects
    resp = requests.get(f"{API_BASE}/projects", cookies=cookies)
    if resp.status_code != 200:
        print(f"❌ Failed to list projects: {resp.text}")
        sys.exit(1)
    
    projects = resp.json()
    
    # Find or create 'test' project
    test_project = None
    for p in projects:
        if p.get('name') == 'test':
            test_project = p
            break
    
    if not test_project:
        print("  Creating new 'test' project...")
        resp = requests.post(f"{API_BASE}/projects", json={"name": "test"}, cookies=cookies)
        if resp.status_code not in [200, 201]:
            print(f"❌ Failed to create project: {resp.text}")
            sys.exit(1)
        test_project = resp.json()
    
    print(f"✅ Using project: {test_project['name']} (ID: {test_project['id']})")
    return test_project['id']

def get_delta_dataset(cookies, project_id):
    """Get the Delta dataset"""
    print(f"\n📊 Looking for Delta dataset in project {project_id}...")
    
    resp = requests.get(f"{API_BASE}/projects/{project_id}/datasets", cookies=cookies)
    if resp.status_code != 200:
        print(f"❌ Failed to list datasets: {resp.text}")
        return None
    
    datasets = resp.json()
    
    # Find a Delta dataset
    for ds in datasets:
        if ds.get('storage_backend') == 'delta':
            print(f"✅ Found Delta dataset: {ds.get('name')} (ID: {ds['id']})")
            print(f"   Schema: {ds.get('target_schema')}")
            print(f"   Table: {ds.get('target_table')}")
            print(f"   Location: {ds.get('target_schema')}.{ds.get('target_table')}")
            return ds
    
    print("⚠️  No Delta dataset found")
    return None

def run_sql_query(cookies, project_id, sql, limit=10):
    """Execute SQL query"""
    print(f"\n🔍 Executing query:")
    print(f"   {sql}")
    
    payload = {
        "sql": sql,
        "project_id": project_id,
        "limit": limit,
        "page": 1
    }
    
    resp = requests.post(
        f"{API_BASE}/query/execute",
        json=payload,
        cookies=cookies
    )
    
    if resp.status_code != 200:
        print(f"❌ Query failed: {resp.status_code}")
        print(f"   Response: {resp.text}")
        return None
    
    result = resp.json()
    print(f"✅ Query successful!")
    print(f"   Columns: {len(result.get('columns', []))}")
    print(f"   Rows: {len(result.get('rows', []))}")
    
    return result

def display_results(result, max_rows=5):
    """Display query results in a formatted way"""
    if not result:
        return
    
    columns = result.get('columns', [])
    rows = result.get('rows', [])
    
    if not columns or not rows:
        print("   No data returned")
        return
    
    print(f"\n   Results (showing {min(len(rows), max_rows)} of {len(rows)} rows):")
    
    # Print header
    header = " | ".join(f"{col[:20]:20}" for col in columns[:5])  # Limit to 5 columns for display
    print(f"   {header}")
    print(f"   {'-' * len(header)}")
    
    # Print rows
    for row in rows[:max_rows]:
        row_str = " | ".join(f"{str(val)[:20]:20}" for val in row[:5])  # Limit to 5 columns
        print(f"   {row_str}")

def test_basic_select(cookies, project_id, table_ref):
    """Test 1: Basic SELECT query"""
    print("\n" + "="*60)
    print("TEST 1: Basic SELECT Query")
    print("="*60)
    
    sql = f"SELECT * FROM {table_ref} LIMIT 5"
    result = run_sql_query(cookies, project_id, sql, limit=5)
    display_results(result)
    
    return result is not None

def test_count_query(cookies, project_id, table_ref):
    """Test 2: COUNT aggregation"""
    print("\n" + "="*60)
    print("TEST 2: COUNT Aggregation")
    print("="*60)
    
    sql = f"SELECT COUNT(*) as total_rows FROM {table_ref}"
    result = run_sql_query(cookies, project_id, sql)
    display_results(result)
    
    return result is not None

def test_where_clause(cookies, project_id, table_ref, columns):
    """Test 3: WHERE clause filtering"""
    print("\n" + "="*60)
    print("TEST 3: WHERE Clause Filtering")
    print("="*60)
    
    # Try to use first column in WHERE clause
    if columns:
        first_col = columns[0]
        sql = f"SELECT * FROM {table_ref} WHERE {first_col} IS NOT NULL LIMIT 5"
        result = run_sql_query(cookies, project_id, sql, limit=5)
        display_results(result)
        return result is not None
    else:
        print("⚠️  Skipping - no columns available")
        return False

def test_group_by(cookies, project_id, table_ref, columns):
    """Test 4: GROUP BY aggregation"""
    print("\n" + "="*60)
    print("TEST 4: GROUP BY Aggregation")
    print("="*60)
    
    # Try to group by first column and count
    if columns and len(columns) > 0:
        first_col = columns[0]
        sql = f"SELECT {first_col}, COUNT(*) as count FROM {table_ref} GROUP BY {first_col} LIMIT 10"
        result = run_sql_query(cookies, project_id, sql, limit=10)
        display_results(result)
        return result is not None
    else:
        print("⚠️  Skipping - no columns available")
        return False

def test_order_by(cookies, project_id, table_ref, columns):
    """Test 5: ORDER BY clause"""
    print("\n" + "="*60)
    print("TEST 5: ORDER BY Clause")
    print("="*60)
    
    if columns:
        first_col = columns[0]
        sql = f"SELECT * FROM {table_ref} ORDER BY {first_col} LIMIT 5"
        result = run_sql_query(cookies, project_id, sql, limit=5)
        display_results(result)
        return result is not None
    else:
        print("⚠️  Skipping - no columns available")
        return False

def main():
    """Main test execution"""
    print("="*60)
    print("🧪 DELTA SQL QUERY IMPLEMENTATION TEST")
    print("="*60)
    
    # Login
    cookies = login()
    
    # Get project
    project_id = get_or_create_project(cookies)
    
    # Get Delta dataset
    dataset = get_delta_dataset(cookies, project_id)
    if not dataset:
        print("\n❌ No Delta dataset found to test against")
        print("   Please create a Delta dataset first using the upload script")
        sys.exit(1)
    
    # Build table reference
    schema = dataset.get('target_schema', 'test')
    table = dataset.get('target_table', 'dataset')
    table_ref = f"{schema}.{table}"
    
    print(f"\n📋 Test Configuration:")
    print(f"   Project ID: {project_id}")
    print(f"   Dataset ID: {dataset['id']}")
    print(f"   Table Reference: {table_ref}")
    
    # Run tests
    results = []
    
    # Test 1: Basic SELECT
    results.append(("Basic SELECT", test_basic_select(cookies, project_id, table_ref)))
    
    # Get columns from first query to use in subsequent tests
    sample_result = run_sql_query(cookies, project_id, f"SELECT * FROM {table_ref} LIMIT 1", limit=1)
    columns = sample_result.get('columns', []) if sample_result else []
    
    # Test 2: COUNT
    results.append(("COUNT Aggregation", test_count_query(cookies, project_id, table_ref)))
    
    # Test 3: WHERE clause
    results.append(("WHERE Clause", test_where_clause(cookies, project_id, table_ref, columns)))
    
    # Test 4: GROUP BY
    results.append(("GROUP BY", test_group_by(cookies, project_id, table_ref, columns)))
    
    # Test 5: ORDER BY
    results.append(("ORDER BY", test_order_by(cookies, project_id, table_ref, columns)))
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed! Delta SQL query implementation is working!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
