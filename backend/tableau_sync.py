"""
Tableau 元数据同步入口模块
此文件为兼容性入口，实际实现已拆分到 backend/services/ 目录

使用方式：
    from backend.tableau_sync import TableauMetadataClient, MetadataSync, main
    
    # 或直接从 services 导入
    from backend.services import TableauMetadataClient, MetadataSync
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 从 services 模块重新导出
from backend.services.tableau_client import TableauMetadataClient
from backend.services.sync_manager import MetadataSync
from backend.config import Config


def main():
    """主函数 - 执行同步"""
    import argparse
    parser = argparse.ArgumentParser(description='Tableau 元数据同步工具')
    parser.add_argument('--skip-views', action='store_true', help='跳过视图使用统计同步')
    parser.add_argument('--skip-usage', action='store_true', help='跳过使用统计同步（同 --skip-views）')
    parser.add_argument('--views-only', action='store_true', help='仅同步视图使用统计')
    parser.add_argument('--usage-only', action='store_true', help='仅同步使用统计（同 --views-only）')
    parser.add_argument('--db-path', type=str, help='指定数据库路径')
    args = parser.parse_args()

    db_path = args.db_path or Config.DATABASE_PATH
    print(f"\n数据库路径: {db_path}")
    
    client = TableauMetadataClient(
        base_url=Config.TABLEAU_SERVER_URL,
        pat_name=Config.TABLEAU_PAT_NAME,
        pat_secret=Config.TABLEAU_PAT_SECRET
    )
    
    try:
        client.sign_in()
        sync = MetadataSync(client, db_path=db_path)
        
        if args.views_only or args.usage_only:
            print("\n[仅同步视图使用统计模式]")
            sync.sync_views_usage()
        else:
            sync.sync_all()
            if not (args.skip_views or args.skip_usage):
                sync.sync_views_usage()
        
        sync.close()
        print("\n✅ 同步完成")
    finally:
        client.sign_out()


if __name__ == "__main__":
    main()
