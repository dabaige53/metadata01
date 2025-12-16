"""
测试 calculatedFields 查询
"""
import requests
import json

BASE_URL = "http://tbi.juneyaoair.com"
USERNAME = "huangguanru"
PASSWORD = "Admin123"

def sign_in():
    signin_url = f"{BASE_URL}/api/3.10/auth/signin"
    payload = {"credentials": {"name": USERNAME, "password": PASSWORD, "site": {"contentUrl": ""}}}
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    response = requests.post(signin_url, headers=headers, json=payload, timeout=30)
    if response.status_code == 200:
        try:
            data = response.json()
            print("✅ 登录成功")
            return data["credentials"]["token"]
        except:
            print(f"❌ 解析响应失败: {response.text[:100]}")
            return None
    else:
        print(f"❌ 登录失败: {response.status_code}")
        return None

def execute_query(token, query):
    url = f"{BASE_URL}/api/metadata/graphql"
    headers = {"Content-Type": "application/json", "X-Tableau-Auth": token}
    return requests.post(url, headers=headers, json={"query": query}, timeout=60).json()

token = sign_in()
if token:
    # 先查看 CalculatedField 的可用字段
    schema_query = """
    {
        __type(name: "CalculatedField") {
            fields {
                name
                type { name kind }
            }
        }
    }
    """
    print("\n📋 CalculatedField 可用字段:")
    result = execute_query(token, schema_query)
    if result.get("data", {}).get("__type"):
        for f in result["data"]["__type"]["fields"]:
            print(f"  - {f['name']}: {f['type'].get('name') or f['type'].get('kind')}")
    
    # 测试抓取计算字段
    query = """
    {
        calculatedFields {
            id
            name
            formula
            dataType
            role
            datasource {
                id
                name
            }
        }
    }
    """
    print("\n📊 抓取计算字段 (前5个):")
    result = execute_query(token, query)
    
    if "errors" in result:
        print(f"❌ 错误: {result['errors']}")
    else:
        fields = result.get("data", {}).get("calculatedFields", [])
        print(f"共 {len(fields)} 个计算字段")
        for f in fields[:5]:
            print(f"\n  ID: {f.get('id')}")
            print(f"  Name: {f.get('name')}")
            print(f"  Formula: {f.get('formula', '')[:80]}...")
            print(f"  DataType: {f.get('dataType')}")
    
    # 登出
    requests.post(f"{BASE_URL}/api/3.10/auth/signout", headers={"X-Tableau-Auth": token})
    print("\n✅ 已登出")
