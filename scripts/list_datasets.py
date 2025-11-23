"""
Quick script to list all datasets in a project to help debug query issues
"""
import requests
import sys

BASE_URL = "http://localhost:8080"
EMAIL = "admin@oreo.io"
PASSWORD = "admin123"

# Login
resp = requests.post(f"{BASE_URL}/login", json={"email": EMAIL, "password": PASSWORD})
if resp.status_code != 200:
    print(f"Login failed: {resp.status_code}")
    sys.exit(1)

cookies = resp.cookies

# Get projects
resp = requests.get(f"{BASE_URL}/api/projects", cookies=cookies)
projects = resp.json()

print("Available Projects and Datasets:")
print("=" * 80)

for project in projects:
    project_id = project['id']
    project_name = project['name']
    
    # Get datasets for this project
    resp = requests.get(f"{BASE_URL}/api/projects/{project_id}/datasets", cookies=cookies)
    if resp.status_code != 200:
        continue
    
    datasets = resp.json()
    
    if datasets:
        print(f"\n📁 Project: {project_name} (ID: {project_id})")
        print("-" * 80)
        
        for ds in datasets:
            backend = ds.get('storage_backend', 'N/A')
            icon = "🔷" if backend == 'delta' else "📊"
            schema = ds.get('target_schema', 'N/A')
            table = ds.get('target_table', 'N/A')
            
            print(f"{icon} Dataset: {ds.get('name')}")
            print(f"   ID: {ds['id']}")
            print(f"   Backend: {backend}")
            print(f"   Query as: {schema}.{table}")
            print()

print("\n" + "=" * 80)
print("💡 To query a Delta dataset, use: SELECT * FROM schema.table")
print("   Example: SELECT * FROM test.pollution")
