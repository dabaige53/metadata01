import sys
import os
from backend.config import Config
from backend.tableau_sync import TableauMetadataClient, MetadataSync

def run_partial_sync():
    print("Starting partial sync for fields...")
    
    # Initialize client
    client = TableauMetadataClient(
        Config.TABLEAU_BASE_URL,
        Config.TABLEAU_USERNAME,
        Config.TABLEAU_PASSWORD
    )
    
    if not client.sign_in():
        print("Failed to sign in")
        return

    try:
        # Initialize sync manager
        sync = MetadataSync(client)
        
        # Sync fields only
        # Note: sync_fields in tableau_sync.py uses fetch_fields which we just updated
        sync.sync_fields()
        
    finally:
        client.sign_out()
        print("Done")

if __name__ == "__main__":
    run_partial_sync()
