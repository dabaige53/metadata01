
import os
import sys
import json
import sqlite3
import requests
import glob
from datetime import datetime
from typing import Dict, Any, List, Optional
import re

# Configuration
DB_PATH = os.path.join(os.getcwd(), 'data', 'metadata.db')
API_BASE_URL = 'http://localhost:8201'
JSON_DIR = os.path.join(os.getcwd(), 'docs', 'validation_json')
REPORT_DIR = os.path.join(os.getcwd(), 'docs', 'validation_reports')

class E2EValidator:
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.cursor = self.conn.cursor()
        self.results = {}
        self.current_module = ""
        
        if not os.path.exists(REPORT_DIR):
            os.makedirs(REPORT_DIR)

    def run_sql(self, query: str, params: tuple = ()) -> Any:
        try:
            # Handle variable substition if needed (though mostly handled by params)
            self.cursor.execute(query, params)
            result = self.cursor.fetchall()
            if not result:
                return None
            # Return single value if 1 row 1 col, else list of rows
            if len(result) == 1 and len(result[0]) == 1:
                return result[0][0]
            return result
        except Exception as e:
            return f"SQL Error: {e}"

    def run_api(self, path: str) -> Any:
        try:
            url = f"{API_BASE_URL}{path}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json()
            return f"API Error {response.status_code}: {response.text}"
        except Exception as e:
            return f"API Exception: {e}"

    def extract_id_for_detail_test(self, table_name: str) -> Optional[str]:
        # Helper to get a sample ID for detail page testing
        try:
            self.cursor.execute(f"SELECT id FROM {table_name} LIMIT 1")
            row = self.cursor.fetchone()
            return row[0] if row else None
        except:
            return None

    def validate_module(self, json_file: str):
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for module_name, config in data.items():
            print(f"\n🔵 Testing Module: {module_name} ({os.path.basename(json_file)})")
            self.current_module = module_name
            self.results[module_name] = []
            
            # Module Info
            table_name = config.get("模块定义", {}).get("数据库表")
            
            # 1. Core Attributes
            self._validate_section("核心属性验证", config.get("核心属性验证", {}))
            
            # 2. Lineage Quality
            self._validate_quality("血缘质量检测", config.get("血缘质量检测", {}))
            
            # 3. Related Elements
            self._validate_related("关联元素", config.get("关联元素", []), table_name)
            
            # 4. Frontend Alignment (Stats/Cards)
            frontend_config = config.get("前端元素对齐", {})
            self._validate_frontend_cards("前端列表卡片", frontend_config)
            
            # 5. Frontend Alignment (Detail Pages)
            # Need a sample ID
            sample_id = self.extract_id_for_detail_test(table_name)
            if sample_id:
                self._validate_frontend_details("前端详情页", frontend_config, sample_id)
            else:
                 print(f"  ⚠️ Skipping Detail Page tests (No sample ID found in {table_name})")

    def _validate_section(self, section_name: str, tasks: Dict):
        if not tasks: return
        print(f"  🔸 Section: {section_name}")
        
        for task_name, task_info in tasks.items():
            if task_name == "任务描述": continue
            
            print(f"    - Checking: {task_name}")
            
            # Run SQL
            sql_query = task_info.get("SQL查询")
            sql_res = None
            if sql_query:
                sql_res = self.run_sql(sql_query)
            
            # Run API
            api_path = task_info.get("API路径")
            api_res = None
            if api_path:
                # Handle simple stats API logic if specific keys needed
                full_res = self.run_api(api_path)
                key = task_info.get("API取值键")
                if isinstance(full_res, dict) and key:
                    # Simple key extraction logic (can be expanded)
                    if " " in key: key = key.split()[0] # Remove notes like "(filtered)"
                    api_res = full_res.get(key)
                    if isinstance(api_res, list): api_res = len(api_res) # Usually counting
                else:
                    api_res = full_res # Fallback

            # specific comparison for "Instance Total" etc
            if "total" in task_name.lower() or "总数" in task_name:
                self._record_result(section_name, task_name, sql_res, api_res)
            else:
                # Log observable result
                print(f"      SQL: {sql_res}")

    def _validate_quality(self, section_name: str, tasks: Dict):
         if not tasks: return
         print(f"  🔸 Section: {section_name}")
         # Iterate over sub-lists like "关键字段空值检测", "未匹配血缘检测"
         for category, check_list in tasks.items():
             if isinstance(check_list, list):
                 for item in check_list:
                     if not isinstance(item, dict): continue
                     task_desc = item.get("任务描述") or item.get("检测项")
                     sql = item.get("SQL查询") or item.get("主口径SQL")
                     if not sql: 
                         print(f"    - Quality Check: {task_desc} (Skipped - No SQL)")
                         continue
                         
                     print(f"    - Quality Check: {task_desc}")
                     res = self.run_sql(sql)
                     
                     status = "✅ PASS" if str(res) == "0" else "⚠️ WARN"
                     print(f"      Result: {res} -> {status}")

    def _validate_related(self, section_name: str, related_list: List[Dict], table_name: str):
        if not related_list: return
        print(f"  🔸 Section: {section_name}")
        for item in related_list:
            target = item.get("目标模块")
            print(f"    - Relation: {table_name} -> {target}")
            
            validations = item.get("关联验证", {})
            for key, val in validations.items():
                if "SQL" in key and isinstance(val, str):
                    res = self.run_sql(val)
                    print(f"      {key}: {res}")

    def _validate_frontend_cards(self, section_name: str, config: Dict):
        # Iterate over keys that contain "卡片"
        for key, val in config.items():
            if "卡片" in key:
                print(f"  🔸 Section: {key}")
                for field, task in val.items():
                    if field == "任务描述": continue
                    
                    if not isinstance(task, dict):
                         # print(f"    - Skipping propery: {field}")
                         continue

                    desc = task.get("任务描述")
                    print(f"    - {field}: {desc}")
                    
                    sql = task.get("SQL查询")
                    if sql:
                        res = self.run_sql(sql)
                        print(f"      SQL Result: {res}")

    def _validate_frontend_details(self, section_name: str, config: Dict, sample_id: str):
         for key, val in config.items():
            if "详情页" in key and isinstance(val, dict):
                 print(f"  🔸 Section: {key} (Sample ID: {sample_id})")
                 for tab, task in val.items():
                    if tab == "任务描述": continue
                    
                    # Robust check: task must be a dict to have 'SQL查询'
                    if not isinstance(task, dict):
                        # print(f"    - Skipping propery: {tab} (Value is {type(task).__name__})")
                        continue
                    
                    print(f"    - {tab}")
                    
                    # SQL
                    sql = task.get("SQL查询")
                    sql_res = "N/A"
                    if sql:
                        # Replace ? or :id
                        query = sql.replace("?", f"'{sample_id}'").replace(":id", f"'{sample_id}'")
                        sql_res = self.run_sql(query)

                    # API
                    api_path = task.get("API路径")
                    api_res = "N/A"
                    if api_path:
                        real_path = api_path.replace("{id}", sample_id)
                        full_res = self.run_api(real_path)
                        
                        # Extract data based on key
                        key = task.get("API取值键")
                        if isinstance(full_res, dict) and key:
                            data = full_res.get(key)
                            if isinstance(data, list):
                                api_res = len(data)
                            else:
                                api_res = data

                    print(f"      SQL: {sql_res} | API: {api_res}")
                    match = str(sql_res) == str(api_res)
                    status = "✅ MATCH" if match else "❌ DIFF"
                    print(f"      Status: {status}")

    def _record_result(self, section, task, sql_val, api_val):
        status = "unknown"
        if sql_val is not None and api_val is not None:
            if str(sql_val) == str(api_val):
                status = "PASS"
                print(f"      ✅ MATCH: {sql_val}")
            else:
                status = "FAIL"
                print(f"      ❌ DIFF: SQL={sql_val}, API={api_val}")
        
    def close(self):
        self.conn.close()

if __name__ == "__main__":
    validator = E2EValidator()
    
    # Locate all JSON files
    json_files = glob.glob(os.path.join(JSON_DIR, "*.json"))
    json_files.sort()
    
    print(f"Found {len(json_files)} validation modules.")
    
    for f in json_files:
        validator.validate_module(f)
        
    validator.close()
