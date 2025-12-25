#!/usr/bin/env python3
"""
卡片详情一致性验证脚本

验证各模块列表卡片显示的统计数据与详情页是否一致
特别关注字段统计、关联资源统计等
"""
import sys
import sqlite3
import requests
from pathlib import Path
from typing import Dict, List, Any, Tuple

# 数据库路径
DB_PATH = Path(__file__).parent.parent.parent / "data" / "metadata.db"
API_BASE = "http://localhost:8101/api"

class ConsistencyVerifier:
    """卡片详情一致性验证器"""

    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.cursor = self.conn.cursor()
        self.errors = []
        self.warnings = []

    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()

    def log_error(self, module: str, item_id: str, field: str, card_val: Any, detail_val: Any, reason: str = ""):
        """记录错误"""
        self.errors.append({
            'module': module,
            'item_id': item_id,
            'field': field,
            'card_value': card_val,
            'detail_value': detail_val,
            'reason': reason
        })

    def log_warning(self, message: str):
        """记录警告"""
        self.warnings.append(message)

    def verify_tables(self, sample_size: int = 10) -> Dict[str, int]:
        """验证数据表模块（物理表和嵌入式表）"""
        print("\n=== 验证数据表模块 ===")

        results = {'total': 0, 'passed': 0, 'failed': 0}

        # 获取样本（包括物理表和嵌入式表）
        self.cursor.execute("""
            SELECT id, name, is_embedded FROM tables
            ORDER BY RANDOM()
            LIMIT ?
        """, (sample_size,))

        samples = self.cursor.fetchall()

        for table_id, table_name, is_embedded in samples:
            results['total'] += 1
            print(f"\n检查表: {table_name} ({'嵌入式' if is_embedded else '物理表'})")

            # 获取列表API数据（卡片数据）
            try:
                resp = requests.get(f"{API_BASE}/tables?search={table_name[:20]}")
                if resp.status_code == 200:
                    items = resp.json().get('items', [])
                    card_data = next((i for i in items if i['id'] == table_id), None)
                else:
                    self.log_warning(f"无法获取列表API数据: {table_name}")
                    continue
            except Exception as e:
                self.log_warning(f"列表API请求失败: {table_name}, {e}")
                continue

            # 获取详情API数据
            try:
                resp = requests.get(f"{API_BASE}/tables/{table_id}")
                if resp.status_code == 200:
                    detail_data = resp.json()
                else:
                    self.log_warning(f"无法获取详情API数据: {table_name}")
                    continue
            except Exception as e:
                self.log_warning(f"详情API请求失败: {table_name}, {e}")
                continue

            # 验证各项指标
            passed = True

            # 1. 列数量
            card_column_count = card_data.get('column_count', 0) if card_data else 0
            detail_column_count = len(detail_data.get('columns', []))
            if card_column_count != detail_column_count:
                self.log_error('tables', table_id, 'column_count', card_column_count, detail_column_count)
                print(f"  ❌ 列数量不一致: 卡片={card_column_count}, 详情={detail_column_count}")
                passed = False
            else:
                print(f"  ✅ 列数量一致: {card_column_count}")

            # 2. 字段数量
            card_field_count = card_data.get('field_count', 0) if card_data else 0
            detail_field_count = len(detail_data.get('full_fields', []))
            if card_field_count != detail_field_count:
                self.log_error('tables', table_id, 'field_count', card_field_count, detail_field_count,
                             reason=f"嵌入式={is_embedded}")
                print(f"  ❌ 字段数量不一致: 卡片={card_field_count}, 详情={detail_field_count}")
                passed = False
            else:
                print(f"  ✅ 字段数量一致: {card_field_count}")

            # 3. 数据源数量
            card_ds_count = card_data.get('datasource_count', 0) if card_data else 0
            detail_ds_count = len(detail_data.get('datasources', []))
            if card_ds_count != detail_ds_count:
                self.log_error('tables', table_id, 'datasource_count', card_ds_count, detail_ds_count)
                print(f"  ❌ 数据源数量不一致: 卡片={card_ds_count}, 详情={detail_ds_count}")
                passed = False
            else:
                print(f"  ✅ 数据源数量一致: {card_ds_count}")

            # 4. 工作簿数量
            card_wb_count = card_data.get('workbook_count', 0) if card_data else 0
            detail_wb_count = len(detail_data.get('workbooks', []))
            if card_wb_count != detail_wb_count:
                self.log_error('tables', table_id, 'workbook_count', card_wb_count, detail_wb_count)
                print(f"  ❌ 工作簿数量不一致: 卡片={card_wb_count}, 详情={detail_wb_count}")
                passed = False
            else:
                print(f"  ✅ 工作簿数量一致: {card_wb_count}")

            if passed:
                results['passed'] += 1
            else:
                results['failed'] += 1

        return results

    def verify_datasources(self, sample_size: int = 10) -> Dict[str, int]:
        """验证数据源模块（已发布和嵌入式）"""
        print("\n=== 验证数据源模块 ===")

        results = {'total': 0, 'passed': 0, 'failed': 0}

        # 获取样本
        self.cursor.execute("""
            SELECT id, name, is_embedded FROM datasources
            ORDER BY RANDOM()
            LIMIT ?
        """, (sample_size,))

        samples = self.cursor.fetchall()

        for ds_id, ds_name, is_embedded in samples:
            results['total'] += 1
            print(f"\n检查数据源: {ds_name} ({'嵌入式' if is_embedded else '已发布'})")

            # 获取详情API数据
            try:
                resp = requests.get(f"{API_BASE}/datasources/{ds_id}")
                if resp.status_code != 200:
                    self.log_warning(f"无法获取详情API数据: {ds_name}")
                    continue
                detail_data = resp.json()
            except Exception as e:
                self.log_warning(f"详情API请求失败: {ds_name}, {e}")
                continue

            # 获取卡片数据（从列表API）
            try:
                if is_embedded:
                    resp = requests.get(f"{API_BASE}/datasources/embedded")
                else:
                    resp = requests.get(f"{API_BASE}/datasources")

                if resp.status_code == 200:
                    items = resp.json().get('items', [])
                    card_data = next((i for i in items if i['id'] == ds_id), None)
                else:
                    self.log_warning(f"无法获取列表API数据: {ds_name}")
                    card_data = None
            except Exception as e:
                self.log_warning(f"列表API请求失败: {ds_name}, {e}")
                card_data = None

            # 验证指标
            passed = True

            # 字段数量（如果卡片有此字段）
            if card_data and 'field_count' in card_data:
                card_field_count = card_data.get('field_count', 0)
                detail_field_count = len(detail_data.get('fields', []))
                if card_field_count != detail_field_count:
                    self.log_error('datasources', ds_id, 'field_count', card_field_count, detail_field_count)
                    print(f"  ❌ 字段数量不一致: 卡片={card_field_count}, 详情={detail_field_count}")
                    passed = False
                else:
                    print(f"  ✅ 字段数量一致: {card_field_count}")

            if passed:
                results['passed'] += 1
            else:
                results['failed'] += 1

        return results

    def verify_workbooks(self, sample_size: int = 10) -> Dict[str, int]:
        """验证工作簿模块"""
        print("\n=== 验证工作簿模块 ===")

        results = {'total': 0, 'passed': 0, 'failed': 0}

        # 获取样本
        self.cursor.execute("""
            SELECT id, name FROM workbooks
            ORDER BY RANDOM()
            LIMIT ?
        """, (sample_size,))

        samples = self.cursor.fetchall()

        for wb_id, wb_name in samples:
            results['total'] += 1
            print(f"\n检查工作簿: {wb_name}")

            # 获取详情API数据
            try:
                resp = requests.get(f"{API_BASE}/workbooks/{wb_id}")
                if resp.status_code != 200:
                    self.log_warning(f"无法获取详情API数据: {wb_name}")
                    continue
                detail_data = resp.json()
            except Exception as e:
                self.log_warning(f"详情API请求失败: {wb_name}, {e}")
                continue

            # 获取卡片数据
            try:
                resp = requests.get(f"{API_BASE}/workbooks")
                if resp.status_code == 200:
                    items = resp.json().get('items', [])
                    card_data = next((i for i in items if i['id'] == wb_id), None)
                else:
                    self.log_warning(f"无法获取列表API数据: {wb_name}")
                    card_data = None
            except Exception as e:
                self.log_warning(f"列表API请求失败: {wb_name}, {e}")
                card_data = None

            # 验证指标
            passed = True

            # 视图数量
            if card_data and 'view_count' in card_data:
                card_view_count = card_data.get('view_count', 0)
                detail_view_count = len(detail_data.get('views', []))
                if card_view_count != detail_view_count:
                    self.log_error('workbooks', wb_id, 'view_count', card_view_count, detail_view_count)
                    print(f"  ❌ 视图数量不一致: 卡片={card_view_count}, 详情={detail_view_count}")
                    passed = False
                else:
                    print(f"  ✅ 视图数量一致: {card_view_count}")

            if passed:
                results['passed'] += 1
            else:
                results['failed'] += 1

        return results

    def generate_report(self):
        """生成验证报告"""
        print("\n" + "=" * 60)
        print("卡片详情一致性验证报告")
        print("=" * 60)

        if not self.errors and not self.warnings:
            print("\n✅ 所有验证均通过，未发现不一致问题！")
            return 0

        if self.warnings:
            print(f"\n⚠️  警告 ({len(self.warnings)} 项):")
            for i, warning in enumerate(self.warnings, 1):
                print(f"  {i}. {warning}")

        if self.errors:
            print(f"\n❌ 错误 ({len(self.errors)} 项):")
            for i, error in enumerate(self.errors, 1):
                print(f"  {i}. 模块={error['module']}, 字段={error['field']}")
                print(f"     ID={error['item_id']}")
                print(f"     卡片值={error['card_value']}, 详情值={error['detail_value']}")
                if error.get('reason'):
                    print(f"     原因: {error['reason']}")
            return 1

        return 0


def main():
    """主函数"""
    print("=" * 60)
    print("Tableau 元数据治理平台 - 卡片详情一致性验证")
    print("=" * 60)

    verifier = ConsistencyVerifier()

    # 验证各模块（每个模块采样10条记录）
    all_results = {}

    all_results['tables'] = verifier.verify_tables(sample_size=10)
    all_results['datasources'] = verifier.verify_datasources(sample_size=10)
    all_results['workbooks'] = verifier.verify_workbooks(sample_size=10)

    # 汇总统计
    print("\n" + "=" * 60)
    print("验证统计")
    print("=" * 60)

    for module, results in all_results.items():
        total = results['total']
        passed = results['passed']
        failed = results['failed']
        pass_rate = (passed / total * 100) if total > 0 else 0

        status = "✅" if failed == 0 else "❌"
        print(f"\n{status} {module.upper()}")
        print(f"  总计: {total} 项")
        print(f"  通过: {passed} 项")
        print(f"  失败: {failed} 项")
        print(f"  通过率: {pass_rate:.1f}%")

    # 生成详细报告
    exit_code = verifier.generate_report()

    sys.exit(exit_code)


if __name__ == '__main__':
    main()
