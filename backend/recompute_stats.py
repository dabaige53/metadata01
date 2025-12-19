#!/usr/bin/env python3
"""
重新计算本地数据库统计信息
不依赖 Tableau 连接
"""
import os
import sys

# 添加项目根目录到路径
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, base_dir)

from backend.tableau_sync import MetadataSync

class DummyClient:
    def execute_query(self, query): return {}
    def sign_in(self): return True
    def sign_out(self): pass

def main():
    print("🚀 开始重新计算数据库预存统计信息...")
    
    # 使用空客户端初始化同步管理器
    sync = MetadataSync(DummyClient())
    
    # 执行统计计算
    sync.calculate_stats()
    
    sync.close()
    print("\n✨ 预计算完成!")

if __name__ == "__main__":
    main()
