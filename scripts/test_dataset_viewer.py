"""
Test script to verify dataset viewer data loading
"""
import requests
import json

# Configuration
API_BASE = "http://localhost:8080/api"
TOKEN = None  # Will need to get this from localStorage or login

def test_dataset_data_endpoint():
    """Test the /datasets/{id}/data endpoint"""
    dataset_id = 1  # Adjust this to your test dataset ID
    
    # Test without auth first to see base response
    url = f"{API_BASE}/datasets/{dataset_id}/data?limit=50&offset=0"
    print(f"\nTesting endpoint: {url}")
    
    headers = {}
    if TOKEN:
        headers['Authorization'] = f'Bearer {TOKEN}'
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nResponse structure:")
            print(f"- Keys: {list(data.keys())}")
            if 'data' in data:
                print(f"- Data length: {len(data['data'])}")
                if data['data']:
                    print(f"- First row: {data['data'][0]}")
            if 'columns' in data:
                print(f"- Columns: {data['columns']}")
            
            print(f"\nFull response:")
            print(json.dumps(data, indent=2)[:500])  # First 500 chars
        else:
            print(f"Error response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

def test_dataset_stats_endpoint():
    """Test the /datasets/{id}/stats endpoint"""
    dataset_id = 1
    
    url = f"{API_BASE}/datasets/{dataset_id}/stats"
    print(f"\nTesting stats endpoint: {url}")
    
    headers = {}
    if TOKEN:
        headers['Authorization'] = f'Bearer {TOKEN}'
    
    try:
        response = requests.get(url, headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Stats response: {json.dumps(data, indent=2)}")
        else:
            print(f"Error response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("Dataset Viewer API Test")
    print("=" * 60)
    
    test_dataset_stats_endpoint()
    test_dataset_data_endpoint()
    
    print("\n" + "=" * 60)
    print("Test Complete")
    print("=" * 60)
