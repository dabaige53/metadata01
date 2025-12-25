
import requests
import json

url = "http://127.0.0.1:8101/api/stats"

try:
    response = requests.get(url)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Success! Stats data:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # 验证逻辑
        # 预期 fields 应为 5987, metrics 应为 1703
        if data.get('fields') == 5987 and data.get('metrics') == 1703:
            print("\n✅ Verification passed: Stats are correct (deduplicated counts).")
        else:
            print("\n❌ Verification failed: Stats mismatch.")
            print(f"Expected fields: 5987, got: {data.get('fields')}")
            print(f"Expected metrics: 1703, got: {data.get('metrics')}")
            
    else:
        print("Error response:")
        print(response.text)
except Exception as e:
    print(f"Exception: {e}")
