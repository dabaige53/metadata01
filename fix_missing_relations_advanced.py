"""
修复脚本：重新同步字段视图关联（高级版 - 含去重与重连）
必须在同一个会话中依次运行 sync_fields 和 sync_field_to_view，
以利用内存中的 deduplication_map 进行关联修复。
"""
from backend.tableau_sync import MetadataSync, TableauMetadataClient, Config

print("🚀 Starting Advanced Relation Fix Sync...")

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
        
        # 1. 同步字段 (生成去重映射 deduplication_map)
        print("\n[1/3] Syncing Fields (Building Deduplication Map)...")
        sync.sync_fields()
        print(f"  Dedup Map Size: {len(sync.deduplication_map)}")
        
        # 2. 修复视图关联 (利用 deduplication_map 重连)
        print("\n[2/3] Syncing Field-to-View relations (Relinking)...")
        sync.sync_field_to_view()
        
        # 3. 修复指标依赖
        print("\n[3/3] Syncing Lineage dependencies...")
        sync.sync_lineage()
        
        # 4. 重新计算统计 (包括 field_full_lineage)
        print("\n[4/4] Recalculating Stats...")
        sync._compute_full_lineage()
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
