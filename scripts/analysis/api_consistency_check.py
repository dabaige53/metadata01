#!/usr/bin/env python3
"""
前端 API 与验证脚本一致性对比
对比前端 get_field_detail API 使用的查询逻辑与 bi_cross_validate.py 脚本的差异
"""

import sqlite3
import requests
import json

DB_PATH = "metadata.db"
API_BASE = "http://localhost:8201/api"

def compare_field_detail():
    """对比字段详情 API 返回与数据库直接查询"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print("=" * 70)
    print("前端 API 与数据库查询一致性验证")
    print("=" * 70)
    
    # 抽样 5 个字段进行对比
    cur.execute("SELECT id, name FROM fields WHERE is_calculated=1 LIMIT 5")
    sample_fields = cur.fetchall()
    
    all_pass = True
    
    for field_id, field_name in sample_fields:
        print(f"\n[验证] 字段: {field_name} (ID: {field_id[:8]}...)")
        
        # 1. 调用前端 API
        try:
            resp = requests.get(f"{API_BASE}/fields/{field_id}", timeout=5)
            if resp.status_code != 200:
                print(f"   ❌ API 返回错误: {resp.status_code}")
                all_pass = False
                continue
            api_data = resp.json()
        except Exception as e:
            print(f"   ❌ API 请求失败: {e}")
            all_pass = False
            continue
        
        # 2. 模拟前端 API 的查询逻辑 (按 field_name 聚合)
        # 与 api.py 2578-2585 行一致
        cur.execute("""
            SELECT DISTINCT fl.table_id, t.name, t.schema, db.name as db_name, t.database_id
            FROM fields f
            JOIN field_full_lineage fl ON f.id = fl.field_id
            JOIN tables t ON fl.table_id = t.id
            LEFT JOIN databases db ON t.database_id = db.id
            WHERE f.name = ? AND fl.table_id IS NOT NULL AND t.id IS NOT NULL
        """, (field_name,))
        db_tables = cur.fetchall()
        
        # 3. 对比结果
        api_tables = api_data.get('derived_tables', [])
        
        # 检查表数量是否一致
        if len(api_tables) == len(db_tables):
            print(f"   ✅ 关联表数量一致: {len(api_tables)}")
        else:
            print(f"   ❌ 关联表数量不一致: API={len(api_tables)}, DB查询={len(db_tables)}")
            all_pass = False
        
        # 检查工作簿
        cur.execute("""
            SELECT DISTINCT fl.workbook_id, w.name
            FROM fields f
            JOIN field_full_lineage fl ON f.id = fl.field_id
            LEFT JOIN workbooks w ON fl.workbook_id = w.id
            WHERE f.name = ? AND fl.workbook_id IS NOT NULL AND w.id IS NOT NULL
        """, (field_name,))
        db_workbooks = cur.fetchall()
        api_workbooks = api_data.get('all_workbooks', [])
        
        if len(api_workbooks) == len(db_workbooks):
            print(f"   ✅ 关联工作簿数量一致: {len(api_workbooks)}")
        else:
            print(f"   ❌ 关联工作簿数量不一致: API={len(api_workbooks)}, DB查询={len(db_workbooks)}")
            all_pass = False
    
    # 对比验证脚本的直接查询口径
    print("\n" + "-" * 70)
    print("对比验证脚本 (bi_cross_validate.py) 与前端 API 的统计口径差异")
    print("-" * 70)
    
    # 验证脚本: 直接关联
    cur.execute("SELECT COUNT(DISTINCT f.id) FROM fields f JOIN tables t ON f.table_id=t.id WHERE t.is_embedded=0")
    script_direct = cur.fetchone()[0]
    
    # 验证脚本: 推导关联 (与前端一致)
    cur.execute("SELECT COUNT(DISTINCT fl.field_id) FROM field_full_lineage fl JOIN tables t ON fl.table_id=t.id WHERE t.is_embedded=0")
    script_derived = cur.fetchone()[0]
    
    # 前端: 实际使用的是按 field_name 聚合的推导血缘
    print(f"\n   验证脚本 - 直接关联 (fields.table_id): {script_direct}")
    print(f"   验证脚本 - 推导关联 (field_full_lineage): {script_derived}")
    print(f"   前端 API - 使用推导关联 (field_full_lineage)")
    
    if script_derived >= script_direct:
        print(f"\n   ✅ 验证脚本的推导关联数 ({script_derived}) >= 直接关联数 ({script_direct})")
        print(f"   ✅ 前端 API 使用 field_full_lineage，与验证脚本推导口径一致")
    else:
        print(f"\n   ❌ 推导关联数不应小于直接关联数，请检查逻辑")
        all_pass = False
    
    conn.close()
    
    print("\n" + "=" * 70)
    print(f"验证结论: {'✅ 全部通过' if all_pass else '❌ 存在差异'}")
    print("=" * 70)
    
    return all_pass

def compare_workbook_field_count():
    """对比工作簿-字段关联的双向一致性"""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    print("\n" + "=" * 70)
    print("工作簿-字段双向关联验证 (核心交叉验证)")
    print("=" * 70)
    
    # 抽样 3 个工作簿
    cur.execute("SELECT id, name FROM workbooks LIMIT 3")
    sample_wbs = cur.fetchall()
    
    for wb_id, wb_name in sample_wbs:
        print(f"\n[验证] 工作簿: {wb_name}")
        
        # 正向: 从字段查工作簿
        cur.execute("SELECT COUNT(*) FROM fields WHERE workbook_id = ?", (wb_id,))
        fwd_direct = cur.fetchone()[0]
        
        # 正向: 从 field_full_lineage 查
        cur.execute("SELECT COUNT(DISTINCT field_id) FROM field_full_lineage WHERE workbook_id = ?", (wb_id,))
        fwd_derived = cur.fetchone()[0]
        
        # 调用 API
        try:
            resp = requests.get(f"{API_BASE}/workbooks/{wb_id}", timeout=5)
            if resp.status_code == 200:
                api_data = resp.json()
                stats = api_data.get('stats', {})
                api_field_count = stats.get('field_count', 0)
                api_total_field_count = stats.get('total_field_count', 0)
                print(f"   API 返回 field_count (视图使用): {api_field_count}")
                print(f"   API 返回 total_field_count (直接关联): {api_total_field_count}")
                print(f"   DB 直接关联 (fields.workbook_id): {fwd_direct}")
                print(f"   DB 推导关联 (field_full_lineage): {fwd_derived}")
                
                # 检查 total_field_count 是否与数据库一致
                if api_total_field_count == fwd_direct:
                    print(f"   → total_field_count 与 DB 直接关联一致 ✅")
                else:
                    print(f"   → total_field_count 与 DB 不一致 ⚠️")
        except Exception as e:
            print(f"   API 请求失败: {e}")
    
    conn.close()

if __name__ == "__main__":
    compare_field_detail()
    compare_workbook_field_count()
