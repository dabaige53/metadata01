"""
修复脚本：重新同步字段视图关联和指标血缘
"""
from backend.tableau_sync import MetadataSync, TableauMetadataClient, Config

print("🚀 Starting Relation Fix Sync...")

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
        
        # 1. 修复视图关联
        print("\n[1/2] Syncing Field-to-View relations...")
        sync.sync_field_to_view()
        
        # 2. 修复指标依赖
        print("\n[2/2] Syncing Lineage dependencies...")
        sync.sync_lineage()
        
        # 3. 重新计算统计 (包括 field_full_lineage，确保一切同步)
        print("\n[3/3] Recalculating Stats...")
        sync.calculate_stats()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.sign_out()
    print("\n✅ Fix Completed.")
else:
    print("❌ Failed to sign in.")
