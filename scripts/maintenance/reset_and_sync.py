"""
数据库重置并全量同步脚本
简化版：直接调用 sync_all()，确保与 tableau_sync.py 逻辑一致
"""
from backend.models import get_engine, init_db
from backend.config import Config
from backend.tableau_sync import MetadataSync, TableauMetadataClient
import os
import logging

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
    pat_name=Config.TABLEAU_PAT_NAME,
    pat_secret=Config.TABLEAU_PAT_SECRET
)

if client.sign_in():
    try:
        sync = MetadataSync(client)
        
        # 使用 sync_all() 确保与 tableau_sync.py 逻辑一致
        # sync_all() 内部已包含：
        # - 按依赖顺序同步所有实体
        # - sync_views_usage() 视图使用统计
        # - calculate_stats() 预计算统计字段
        # - split_fields_table_v5 V5迁移
        sync.sync_all()
        
        sync.close()
        
    except Exception as e:
        print(f"❌ Sync failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.sign_out()
    print("✅ Full Reset and Sync Completed.")
else:
    print("❌ Failed to sign in.")

