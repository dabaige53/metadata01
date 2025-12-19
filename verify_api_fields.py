import requests
import json

def check_calculated_fields():
    url = "http://localhost:8101/api/fields"
    params = {"page_size": 100}
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        items = data.get("items", [])
        calc_count = sum(1 for item in items if item.get("isCalculated"))
        
        print(f"Total items fetched: {len(items)}")
        print(f"Calculated fields found: {calc_count}")
        
        if calc_count > 0:
            print("Sample calculated field:")
            for item in items:
                if item.get("isCalculated"):
                    print(json.dumps(item, indent=2, ensure_ascii=False))
                    break
        else:
            print("No calculated fields found in the first page.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_calculated_fields()
