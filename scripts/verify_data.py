
import requests
import json

API_URL = "http://localhost:8080/api"
PROJECT_ID = 5
DATASET_ID = 7

def verify_data():
    session = requests.Session()
    
    # Login
    print("Authenticating...")
    email = "test_script@example.com"
    password = "Password123!"
    login_payload = {"email": email, "password": password}
    resp = session.post(f"{API_URL}/auth/login", json=login_payload)
    if resp.status_code != 200:
        print("Login failed")
        return
    print("Logged in")

    # Get Data
    print(f"Fetching data for dataset {DATASET_ID}...")
    resp = session.get(f"{API_URL}/projects/{PROJECT_ID}/datasets/{DATASET_ID}/data?limit=5")
    
    if resp.status_code == 200:
        data = resp.json()
        print(f"Columns: {data.get('columns')}")
        print(f"Rows returned: {len(data.get('data', []))}")
        if data.get('data'):
            print("Sample row:", data['data'][0])
    else:
        print(f"Failed to get data: {resp.status_code} - {resp.text}")

if __name__ == "__main__":
    verify_data()
