from backend.models import get_engine, init_db
from backend.config import Config
from backend.tableau_sync import MetadataSync, TableauMetadataClient
from backend.migrations import split_fields_table_v5
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
        
        print("\n=== STEP 5.1: Calculated Fields ===")
        sync.sync_calculated_fields()
        
        print("\n=== STEP 5.2: Field to View Relations ===")
        sync.sync_field_to_view()
        
        print("\n=== STEP 5.5: Structure Migration (Part 1) ===")
        ms_session, ms_engine = split_fields_table_v5.get_session()
        split_fields_table_v5.cleanup_tables(ms_session)
        split_fields_table_v5.create_tables(ms_engine)
        split_fields_table_v5.migrate_regular_fields(ms_session)
        split_fields_table_v5.migrate_calculated_fields(ms_session)
        ms_session.commit()
        ms_session.close()

        print("\n=== STEP 6: Lineage ===")
        sync.sync_lineage()
        
        print("\n=== STEP 6.5: Calculate Stats (填充 field_full_lineage) ===")
        sync.calculate_stats()
        
        print("\n=== STEP 7: Structure Migration (Part 2) ===")
        ms_session_2, _ = split_fields_table_v5.get_session()
        split_fields_table_v5.migrate_relations(ms_session_2)
        split_fields_table_v5.update_statistics(ms_session_2)
        split_fields_table_v5.migrate_lineage(ms_session_2)
        split_fields_table_v5.verify_no_duplicates(ms_session_2)
        ms_session_2.commit()
        ms_session_2.close()
        
    except Exception as e:
        print(f"❌ Sync failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.sign_out()
    print("✅ Full Reset and Sync Completed.")
else:
    print("❌ Failed to sign in.")
