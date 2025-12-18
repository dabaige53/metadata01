"""
离线执行血缘关系计算
使用本地数据库中已有的 CalculatedField 数据重新生成 FieldDependency 和 Metric 数据
不需要连接 Tableau Server
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.config import Config
from backend.models import Base, get_engine, init_db
from backend.tableau_sync import MetadataSync

def main():
    print("=" * 50)
    print("Tableau 离线血缘计算工具")
    print("=" * 50)
    
    # 使用空客户端，因为 sync_lineage 不需要联网
    sync = MetadataSync(None)
    
    print("正在计算血缘关系...")
    try:
        count = sync.sync_lineage()
        print(f"\n✅ 成功生成 {count} 条血缘依赖关系")
    except Exception as e:
        print(f"\n❌ 计算失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
