from backend.models import get_engine, init_db
from backend.config import Config
from backend.tableau_sync import MetadataSync, TableauMetadataClient
import os
import logging
import sys

# Setup logging
logging.basicConfig(level=logging.INFO)

print("🚀 Starting Full Reset and Sync...")

# 1. Reset Database
if os.path.exists(Config.DATABASE_PATH):
    print(f"  🗑️ Removing existing database: {Config.DATABASE_PATH}")
    os.remove(Config.DATABASE_PATH)

print("  📦 Initializing new database...")
engine = get_engine(Config.DATABASE_PATH)
init_db(engine)

# 2. Sync All
print("  🔄 Starting full sync...")

# Force HTTPS
base_url = Config.TABLEAU_BASE_URL
if base_url.startswith("http://"):
    base_url = base_url.replace("http://", "https://")

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
        
        # Sync in order
        print("\n=== STEP 1: Databases ===")
        sync.sync_databases()
        
        print("\n=== STEP 2: Tables ===")
        sync.sync_tables()
        
        print("\n=== STEP 3: Datasources ===")
        sync.sync_datasources()
        
        print("\n=== STEP 4: Workbooks ===")
        sync.sync_workbooks()
        
        print("\n=== STEP 5: Fields (with Fixes) ===")
        sync.sync_fields()
        
        print("\n=== STEP 6: Lineage ===")
        sync.sync_lineage()
        
    except Exception as e:
        print(f"❌ Sync failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.sign_out()
    print("✅ Full Reset and Sync Completed.")
else:
    print("❌ Failed to sign in.")
