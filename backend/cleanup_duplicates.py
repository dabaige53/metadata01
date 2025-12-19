
import os
import sys
import hashlib

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))) # Point to backend dir
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) # Point to project root

from backend.config import Config
from backend.models import get_engine, get_session, Project

def cleanup_duplicates():
    print("=" * 50)
    print("开始清理重复的项目数据...")
    print("=" * 50)

    db_path = Config.DATABASE_PATH
    engine = get_engine(db_path)
    session = get_session(engine)

    try:
        # 1. 获取所有项目
        projects = session.query(Project).all()
        print(f"当前共有 {len(projects)} 个项目记录")

        # 2. 按名称分组
        projects_by_name = {}
        for p in projects:
            if p.name not in projects_by_name:
                projects_by_name[p.name] = []
            projects_by_name[p.name].append(p)

        deleted_count = 0
        kept_count = 0

        # 3. 识别重复项并清理
        for name, project_list in projects_by_name.items():
            if len(project_list) > 1:
                print(f"\n发现重复项目: '{name}' (共 {len(project_list)} 条)")
                
                # 计算预期的稳定 ID
                stable_id = f"project_{hashlib.md5(name.encode('utf-8')).hexdigest()[:8]}"
                print(f"  预期稳定 ID: {stable_id}")

                # 查找是否有匹配稳定 ID 的记录
                keep_project = None
                for p in project_list:
                    if p.id == stable_id:
                        keep_project = p
                        break
                
                # 如果没有匹配稳定 ID 的，保留第一条（或者也可以选择删除全部，等待下次同步重建）
                # 这里策略：如果有稳定 ID 的保留它，否则保留第一条并重命名 ID (这很难，因为 ID 是主键)
                # 简化策略：保留一条，删除其他。
                # 考虑到下次同步会生成稳定 ID，如果现在保留的不符合稳定 ID，下次同步可能又会插入一条新的（即稳定 ID 的那条）。
                # 所以最佳策略是：删除所有不符合稳定 ID 的记录。如果都没有，全部删除，等待下次同步重建。
                
                matches_stable = [p for p in project_list if p.id == stable_id]
                
                if matches_stable:
                    keep_project = matches_stable[0]
                    print(f"  ✅ 保留匹配稳定 ID 的记录: {keep_project.id}")
                else:
                    print(f"  ⚠️ 没有记录匹配稳定 ID，将删除所有重复项，等待下次同步自动重建。")
                    keep_project = None

                # 执行删除
                for p in project_list:
                    if keep_project and p.id == keep_project.id:
                        continue
                    
                    print(f"  🗑️ 删除冗余记录: {p.id}")
                    session.delete(p)
                    deleted_count += 1
            else:
                # 只有一条记录，检查 ID 是否符合规范
                p = project_list[0]
                stable_id = f"project_{hashlib.md5(name.encode('utf-8')).hexdigest()[:8]}"
                if p.id != stable_id:
                     print(f"\n非标准 ID 项目: '{name}' (当前 ID: {p.id}, 预期: {stable_id})")
                     print(f"  🗑️ 删除以触发重建")
                     session.delete(p)
                     deleted_count += 1
                else:
                    kept_count += 1

        session.commit()
        print("\n" + "=" * 50)
        print(f"清理完成!")
        print(f"共删除: {deleted_count} 条重复/非标准记录")
        print(f"保留: {kept_count} 条有效记录")
        print("=" * 50)

    except Exception as e:
        session.rollback()
        print(f"❌ 清理失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        session.close()

if __name__ == "__main__":
    cleanup_duplicates()
