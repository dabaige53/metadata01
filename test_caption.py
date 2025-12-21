import os
import sys
import json
from backend.tableau_sync import TableauMetadataClient
from backend.config import Config

# Setup client
# Config likely reads from env. I will try to run this with the env vars if needed.
# But for now let's assume Config works.

def test_caption():
    client = TableauMetadataClient(
        Config.TABLEAU_BASE_URL,
        Config.TABLEAU_USERNAME,
        Config.TABLEAU_PASSWORD
    )
    client.sign_in()
    
    # Custom query to fetch fields with caption for specific ID if possible, 
    # or just fetch all and filter.
    # We can't filter by ID easily in the deep query without building a custom one.
    # So I'll override the fetch_fields query or just execute a raw query.
    
    query = """
    {
        publishedDatasources {
            id
            name
            fields {
                id
                name
                caption
                description
                isCalculated
            }
        }
    }
    """
    
    print("Executing query...")
    try:
        result = client.execute_query(query)
    except Exception as e:
        print(f"Query failed: {e}")
        return

    if "errors" in result:
        print("Errors in response:")
        print(json.dumps(result["errors"], indent=2, ensure_ascii=False))
        return

    data = result.get("data", {}).get("publishedDatasources", [])
    
    target_id = "c28b31d9-67e6-4262-a220-766f6a97371f"
    found = False
    
    for ds in data:
        for field in ds.get("fields", []):
            if field["id"] == target_id:
                print(f"\nFOUND FIELD: {target_id}")
                print(json.dumps(field, indent=2, ensure_ascii=False))
                found = True
                break
        if found: break
    
    if not found:
        print(f"\nTarget field {target_id} NOT FOUND in publishedDatasources.")

if __name__ == "__main__":
    test_caption()
