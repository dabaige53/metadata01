#!/usr/bin/env python3
"""
API 数据一致性验证脚本
基于 api_data_mapping.json 配置，验证列表页与详情页数据是否一致
"""
import json
import sys
import os
import requests
from datetime import datetime

# 配置
BASE_URL = os.environ.get('API_BASE_URL', 'http://localhost:8201')
MAPPING_FILE = os.path.join(os.path.dirname(__file__), 'api_data_mapping.json')
SAMPLE_SIZE = 5  # 每个接口抽样验证的数量

def load_mapping():
    """加载验证配置"""
    with open(MAPPING_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_nested_value(obj, path):
    """获取嵌套对象的值，支持 items[].field 和 array.length 格式"""
    if path.endswith('.length'):
        arr_path = path[:-7]
        arr = get_nested_value(obj, arr_path)
        return len(arr) if arr else 0
    
    parts = path.split('.')
    current = obj
    for part in parts:
        if part.endswith('[]'):
            # 返回数组中每个元素的指定字段
            key = part[:-2]
            if key:
                current = current.get(key, [])
            return current
        elif current is None:
            return None
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            return None
    return current

def validate_count_consistency(rule, verbose=True):
    """验证列表页与详情页的计数一致性"""
    results = {'passed': 0, 'failed': 0, 'errors': []}
    
    # 获取列表数据
    list_endpoint = rule['list_api']['endpoint']
    list_field = rule['list_api']['field']
    detail_endpoint = rule['detail_api']['endpoint']
    detail_field = rule['detail_api']['field']
    
    try:
        resp = requests.get(f"{BASE_URL}{list_endpoint}?page_size={SAMPLE_SIZE}")
        resp.raise_for_status()
        list_data = resp.json()
    except Exception as e:
        results['errors'].append(f"无法获取列表数据: {e}")
        return results
    
    items = get_nested_value(list_data, 'items[]')
    if not items:
        results['errors'].append("列表为空")
        return results
    
    # 抽样验证
    for item in items[:SAMPLE_SIZE]:
        item_id = item.get('id')
        item_name = item.get('name', item_id)
        list_value = get_nested_value(item, list_field.replace('items[].', ''))
        
        # 获取详情数据
        try:
            detail_url = detail_endpoint.replace('{id}', item_id)
            resp = requests.get(f"{BASE_URL}{detail_url}")
            resp.raise_for_status()
            detail_data = resp.json()
        except Exception as e:
            results['errors'].append(f"无法获取详情 {item_name}: {e}")
            continue
        
        detail_value = get_nested_value(detail_data, detail_field)
        
        if list_value == detail_value:
            results['passed'] += 1
            if verbose:
                print(f"  ✓ {item_name}: {list_value} == {detail_value}")
        else:
            results['failed'] += 1
            error_msg = f"{item_name}: 列表={list_value}, 详情={detail_value}"
            results['errors'].append(error_msg)
            if verbose:
                print(f"  ✗ {error_msg}")
    
    return results

def validate_sample_test_cases(cases, verbose=True):
    """验证样本测试用例"""
    results = {'passed': 0, 'failed': 0, 'errors': []}
    
    for case in cases:
        case_id = case['id']
        table_id = case['table_id']
        expected = case['expected']
        
        try:
            resp = requests.get(f"{BASE_URL}/api/tables/{table_id}")
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            results['errors'].append(f"无法获取测试用例 {case_id}: {e}")
            continue
        
        # 验证 column_count
        if 'column_count' in expected:
            actual = len(data.get('columns', []))
            if actual == expected['column_count']:
                results['passed'] += 1
                if verbose:
                    print(f"  ✓ {case_id} column_count: {actual}")
            else:
                results['failed'] += 1
                results['errors'].append(f"{case_id} column_count: 期望={expected['column_count']}, 实际={actual}")
        
        # 验证 field_count
        if 'field_count' in expected:
            actual = len(data.get('full_fields', []))
            if actual == expected['field_count']:
                results['passed'] += 1
                if verbose:
                    print(f"  ✓ {case_id} field_count: {actual}")
            else:
                results['failed'] += 1
                results['errors'].append(f"{case_id} field_count: 期望={expected['field_count']}, 实际={actual}")
        
        # 验证不应包含的字段
        if 'should_not_contain_field' in expected:
            bad_field = expected['should_not_contain_field']
            field_names = [f.get('name') for f in data.get('full_fields', [])]
            if bad_field not in field_names:
                results['passed'] += 1
                if verbose:
                    print(f"  ✓ {case_id} 不包含字段 '{bad_field}'")
            else:
                results['failed'] += 1
                results['errors'].append(f"{case_id} 不应包含字段 '{bad_field}'")
    
    return results

def main():
    print("=" * 60)
    print("API 数据一致性验证")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"服务器: {BASE_URL}")
    print("=" * 60)
    
    mapping = load_mapping()
    total_passed = 0
    total_failed = 0
    all_errors = []
    
    # 验证计数一致性规则
    print("\n[1] 列表-详情计数一致性验证")
    print("-" * 40)
    for rule in mapping.get('validation_rules', []):
        print(f"\n{rule['name']} ({rule['id']})")
        results = validate_count_consistency(rule)
        total_passed += results['passed']
        total_failed += results['failed']
        all_errors.extend(results['errors'])
    
    # 验证样本测试用例
    print("\n[2] 样本测试用例验证")
    print("-" * 40)
    cases = mapping.get('sample_test_cases', [])
    if cases:
        results = validate_sample_test_cases(cases)
        total_passed += results['passed']
        total_failed += results['failed']
        all_errors.extend(results['errors'])
    
    # 汇总
    print("\n" + "=" * 60)
    print("验证结果汇总")
    print("=" * 60)
    print(f"通过: {total_passed}")
    print(f"失败: {total_failed}")
    
    if all_errors:
        print(f"\n错误详情 ({len(all_errors)} 项):")
        for err in all_errors:
            print(f"  - {err}")
    
    # 返回退出码
    sys.exit(0 if total_failed == 0 else 1)

if __name__ == '__main__':
    main()
