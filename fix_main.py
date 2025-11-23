# Script to fix main.py null bytes and integrate validation endpoints

def fix_main_py():
    # Step 1: Remove null bytes from main.py
    print("Step 1: Removing null bytes from main.py...")
    with open('python-service/main.py', 'rb') as f:
        content = f.read()
    
    # Remove null bytes
    clean_content = content.replace(b'\x00', b'')
    
    # Write back
    with open('python-service/main.py', 'wb') as f:
        f.write(clean_content)
    
    print("[OK] Null bytes removed")
    
    # Step 2: Append validation endpoints
    print("Step 2: Appending validation endpoints...")
    with open('python-service/validation_endpoints.py', 'r', encoding='utf-8') as f:
        endpoints_content = f.read()
    
    # Remove the import comment and extract just the endpoint code
    lines = endpoints_content.split('\n')
    # Skip first 6 lines (comments and imports)
    endpoint_code = '\n'.join(lines[6:])
    
    # Append to main.py
    with open('python-service/main.py', 'a', encoding='utf-8') as f:
        f.write('\n\n')
        f.write(endpoint_code)
    
    print("[OK] Validation endpoints added")
    print("[SUCCESS] main.py successfully fixed!")
    print("")
    print("Next steps:")
    print("1. Rebuild: docker-compose -f docker-compose.dev.yml build python-service")
    print("2. Restart: docker-compose -f docker-compose.dev.yml up -d python-service")
    print("3. Test: docker exec oreoio-v3-python-service-1 python tests/test_validation_state_machine.py")


if __name__ == "__main__":
    try:
        fix_main_py()
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
