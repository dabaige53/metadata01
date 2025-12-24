from backend.tableau_sync import MetadataSync, TableauMetadataClient
from backend.config import Config
import logging
import os

# Setup logging
logging.basicConfig(level=logging.INFO)

print("🚀 Starting Field Sync...")

# Force HTTPS if it was HTTP, to avoid 302 Redirect + GET issue
base_url = Config.TABLEAU_BASE_URL
if base_url.startswith("http://"):
    base_url = base_url.replace("http://", "https://")

print(f"  Target URL: {base_url}")

client = TableauMetadataClient(
    base_url,
    username=Config.TABLEAU_USERNAME,
    password=Config.TABLEAU_PASSWORD,
    pat_name=Config.TABLEAU_PAT_NAME,
    pat_secret=Config.TABLEAU_PAT_SECRET
)

if client.sign_in():
    try:
        sync = MetadataSync(client)
        # Only sync fields to test the fix (and view dependency if needed?)
        # Just fields for now.
        sync.sync_fields()
    finally:
        client.sign_out()
    print("✅ Sync Completed.")
else:
    print("❌ Failed to sign in.")
