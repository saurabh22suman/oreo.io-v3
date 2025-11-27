
import requests
import os
import json

API_URL = "http://localhost:8080/api"
DATA_FILE = r"e:\Github\oreo_antigravity\oreo.io-v3\test-data\final_dataset.csv"

def upload_dataset():
    session = requests.Session()
    
    # 1. Register/Login
    print("Authenticating...")
    email = "test_script@example.com"
    password = "Password123!"
    
    # Try login first
    login_payload = {"email": email, "password": password}
    resp = session.post(f"{API_URL}/auth/login", json=login_payload)
    
    if resp.status_code != 200:
        print("Login failed, trying to register...")
        register_payload = {"email": email, "password": password, "name": "Test Script User"}
        resp = session.post(f"{API_URL}/auth/register", json=register_payload)
        
        if resp.status_code != 200 and resp.status_code != 201:
            print(f"Registration failed: {resp.text}")
            return
        print("Registered successfully")
        # Login again
        resp = session.post(f"{API_URL}/auth/login", json=login_payload)
        if resp.status_code != 200:
            print(f"Login after registration failed: {resp.text}")
            return
    else:
        print("Logged in successfully")

    # 2. Create a Project
    print("\nCreating project...")
    project_payload = {
        "name": "Live Edit Project",
        "description": "Project for testing Live Edit"
    }
    
    project_id = None
    resp = session.post(f"{API_URL}/projects", json=project_payload)
    
    if resp.status_code == 200 or resp.status_code == 201:
        project = resp.json()
        project_id = project['id']
        print(f"Project created: {project['name']} (ID: {project_id})")
    else:
        # Fetch existing
        resp = session.get(f"{API_URL}/projects")
        if resp.status_code == 200:
            projects = resp.json()
            if isinstance(projects, dict) and 'projects' in projects:
                projects = projects['projects']
            
            if projects:
                for p in projects:
                    if p['name'] == "Live Edit Project":
                        project_id = p['id']
                        break
                if not project_id:
                    project_id = projects[0]['id']
                print(f"Using existing project ID: {project_id}")
            else:
                print("No projects found.")
                return

    # 3. Cleanup existing dataset
    print("\nChecking for existing dataset...")
    resp = session.get(f"{API_URL}/projects/{project_id}/datasets")
    if resp.status_code == 200:
        datasets = resp.json()
        for ds in datasets:
            if ds['name'] == "Final Data":
                print(f"Deleting existing dataset ID: {ds['id']}...")
                del_resp = session.delete(f"{API_URL}/projects/{project_id}/datasets/{ds['id']}")
                if del_resp.status_code == 200:
                    print("Deleted successfully.")
                else:
                    print(f"Failed to delete: {del_resp.status_code}")

    # 4. Create Dataset AND Upload File (Atomic Prepare)
    print(f"\nCreating dataset and uploading file from {DATA_FILE}...")
    if not os.path.exists(DATA_FILE):
        print(f"File not found: {DATA_FILE}")
        return

    try:
        with open(DATA_FILE, 'rb') as f:
            files = {'file': ('final_dataset.csv', f, 'text/csv')}
            # Use /datasets/prepare endpoint
            # Fields: project_id, name
            data = {
                'project_id': str(project_id),
                'name': 'Final Data',
                'description': 'Test dataset for Live Edit'
            }
            
            url = f"{API_URL}/datasets/prepare"
            
            resp = session.post(url, data=data, files=files)
            
            if resp.status_code == 200 or resp.status_code == 201:
                dataset = resp.json()
                print(f"Dataset created and file uploaded successfully!")
                print(f"   ID: {dataset.get('id')}")
                print(f"   Name: {dataset.get('name')}")
            else:
                print(f"Prepare failed: {resp.status_code} - {resp.text}")

    except Exception as e:
        print(f"Error uploading file: {e}")

if __name__ == "__main__":
    upload_dataset()
