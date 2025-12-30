
import requests
import json

url = "http://127.0.0.1:8201/api/fields/catalog"

try:
    response = requests.get(url)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print("Success! Response summary:")
        print(f"Total: {data.get('total')}")
        items = data.get('items', [])
        print(f"Items count: {len(items)}")
        if items:
            print("First item sample:")
            print(json.dumps(items[0], indent=2, ensure_ascii=False))
    else:
        print("Error response:")
        print(response.text)
except Exception as e:
    print(f"Exception: {e}")
