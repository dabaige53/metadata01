"""
探索 Tableau Metadata API 的 Schema
查找计算字段相关的可用字段
"""
import requests
import json

BASE_URL = "http://tbi.juneyaoair.com"
USERNAME = "huangguanru"
PASSWORD = "Admin123"

def sign_in():
    """登录"""
    signin_url = f"{BASE_URL}/api/3.10/auth/signin"
    payload = {
        "credentials": {
            "name": USERNAME,
            "password": PASSWORD,
            "site": {"contentUrl": ""}
        }
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    response = requests.post(signin_url, headers=headers, json=payload, timeout=30)
    if response.status_code == 200:
        token = response.json()["credentials"]["token"]
        print(f"✅ 登录成功")
        return token
    return None

def execute_query(token, query):
    """执行 GraphQL 查询"""
    url = f"{BASE_URL}/api/metadata/graphql"
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Tableau-Auth": token
    }
    response = requests.post(url, headers=headers, json={"query": query}, timeout=60)
    return response.json()

def explore_schema(token):
    """探索 GraphQL Schema"""
    
    # 内省查询 - 查看 Field 类型的可用字段
    introspection_query = """
    {
        __type(name: "DatasourceField") {
            name
            kind
            fields {
                name
                type {
                    name
                    kind
                }
            }
        }
    }
    """
    
    print("\n" + "=" * 60)
    print("探索 DatasourceField 类型")
    print("=" * 60)
    result = execute_query(token, introspection_query)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 查看 CalculatedField 类型
    calc_query = """
    {
        __type(name: "CalculatedField") {
            name
            kind
            fields {
                name
                type {
                    name
                    kind
                }
            }
        }
    }
    """
    
    print("\n" + "=" * 60)
    print("探索 CalculatedField 类型")
    print("=" * 60)
    result = execute_query(token, calc_query)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    # 查看顶层查询
    root_query = """
    {
        __schema {
            queryType {
                fields {
                    name
                    description
                }
            }
        }
    }
    """
    
    print("\n" + "=" * 60)
    print("探索可用的顶层查询")
    print("=" * 60)
    result = execute_query(token, root_query)
    if result.get("data"):
        fields = result["data"]["__schema"]["queryType"]["fields"]
        for f in fields:
            print(f"  - {f['name']}: {f.get('description', '')[:50] if f.get('description') else ''}")

def sign_out(token):
    """登出"""
    signout_url = f"{BASE_URL}/api/3.10/auth/signout"
    requests.post(signout_url, headers={"X-Tableau-Auth": token}, timeout=30)
    print("\n✅ 已登出")

if __name__ == "__main__":
    token = sign_in()
    if token:
        try:
            explore_schema(token)
        finally:
            sign_out(token)
