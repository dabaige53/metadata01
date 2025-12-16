"""
测试 Tableau Server Metadata API 连接
使用 PAT (Personal Access Token) 认证
"""
import requests
import json
import re

# Tableau Server 配置
BASE_URL = "http://tbi.juneyaoair.com"
USERNAME = "huangguanru"
PASSWORD = "Admin123"

# Metadata API 端点
METADATA_API_URL = f"{BASE_URL}/api/metadata/graphql"


def get_api_version():
    """获取 Tableau Server 支持的 API 版本"""
    
    serverinfo_url = f"{BASE_URL}/api/3.4/serverinfo"  # 使用最低版本尝试
    
    print("=" * 60)
    print("步骤 0: 获取 Tableau Server API 版本")
    print("=" * 60)
    
    # 尝试多个版本
    for version in ["3.4", "3.8", "3.10", "3.14", "3.18", "3.20"]:
        try:
            url = f"{BASE_URL}/api/{version}/serverinfo"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                rest_api_version = data.get("serverInfo", {}).get("restApiVersion")
                print(f"✅ 服务器支持的 REST API 版本: {rest_api_version}")
                return rest_api_version
        except:
            continue
    
    # 如果都失败，尝试从首页获取
    try:
        response = requests.get(BASE_URL, timeout=10)
        # 尝试从响应中提取版本信息
        print(f"首页状态码: {response.status_code}")
        return "3.10"  # 返回一个常见的版本
    except:
        return "3.10"


def sign_in_with_password(api_version):
    """使用用户名密码登录并获取认证 token"""
    
    signin_url = f"{BASE_URL}/api/{api_version}/auth/signin"
    
    # 用户名密码认证请求体
    payload = {
        "credentials": {
            "name": USERNAME,
            "password": PASSWORD,
            "site": {
                "contentUrl": ""  # 默认站点使用空字符串
            }
        }
    }
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    print("\n" + "=" * 60)
    print("步骤 1: 使用用户名密码登录获取认证 Token")
    print("=" * 60)
    print(f"登录 URL: {signin_url}")
    print(f"用户名: {USERNAME}")
    
    try:
        response = requests.post(
            signin_url,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            credentials = data.get("credentials", {})
            token = credentials.get("token")
            site_id = credentials.get("site", {}).get("id")
            user_id = credentials.get("user", {}).get("id")
            
            print("✅ 登录成功!")
            print(f"Token: {token[:20]}..." if token else "Token: None")
            print(f"Site ID: {site_id}")
            print(f"User ID: {user_id}")
            
            return token, site_id
        else:
            print(f"❌ 登录失败")
            print(f"响应内容: {response.text}")
            return None, None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求异常: {e}")
        return None, None


def test_metadata_api(auth_token):
    """测试 Metadata API - 获取数据库列表"""
    
    query = """
    {
        databases {
            id
            name
            connectionType
        }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Tableau-Auth": auth_token
    }
    
    payload = {"query": query}
    
    print("\n" + "=" * 60)
    print("步骤 2: 测试 Metadata API - 获取数据库")
    print("=" * 60)
    print(f"URL: {METADATA_API_URL}")
    
    try:
        response = requests.post(
            METADATA_API_URL,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Metadata API 连接成功!")
            print("响应数据:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return True
        else:
            print(f"❌ API 请求失败")
            print(f"响应内容: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求异常: {e}")
        return False


def test_workbooks(auth_token):
    """测试获取工作簿列表"""
    
    query = """
    {
        workbooks {
            id
            name
            projectName
            createdAt
            updatedAt
        }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Tableau-Auth": auth_token
    }
    
    payload = {"query": query}
    
    print("\n" + "=" * 60)
    print("步骤 3: 获取工作簿列表")
    print("=" * 60)
    
    try:
        response = requests.post(
            METADATA_API_URL,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 工作簿查询成功!")
            print("响应数据:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return True
        else:
            print(f"❌ 查询失败: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求异常: {e}")
        return False


def test_tables(auth_token):
    """测试获取数据表列表"""
    
    query = """
    {
        databaseTables {
            id
            name
            schema
            fullName
            database {
                name
                connectionType
            }
        }
    }
    """
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Tableau-Auth": auth_token
    }
    
    payload = {"query": query}
    
    print("\n" + "=" * 60)
    print("步骤 4: 获取数据表列表")
    print("=" * 60)
    
    try:
        response = requests.post(
            METADATA_API_URL,
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ 数据表查询成功!")
            print("响应数据:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            return True
        else:
            print(f"❌ 查询失败: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 请求异常: {e}")
        return False


def sign_out(auth_token, api_version):
    """登出并释放 token"""
    
    signout_url = f"{BASE_URL}/api/{api_version}/auth/signout"
    
    headers = {
        "X-Tableau-Auth": auth_token
    }
    
    print("\n" + "=" * 60)
    print("步骤 5: 登出")
    print("=" * 60)
    
    try:
        response = requests.post(
            signout_url,
            headers=headers,
            timeout=30
        )
        
        if response.status_code == 204:
            print("✅ 登出成功!")
        else:
            print(f"登出状态码: {response.status_code}")
            
    except requests.exceptions.RequestException as e:
        print(f"登出异常: {e}")


def main():
    """主函数"""
    print("\n" + "🔍 Tableau Server Metadata API 测试".center(60))
    print("=" * 60)
    
    # 0. 获取 API 版本
    api_version = get_api_version()
    print(f"使用 API 版本: {api_version}")
    
    # 1. 登录获取 token
    auth_token, site_id = sign_in_with_password(api_version)
    
    if not auth_token:
        print("\n❌ 无法获取认证 token，测试终止")
        return
    
    try:
        # 2. 测试 Metadata API
        test_metadata_api(auth_token)
        
        # 3. 测试工作簿查询
        test_workbooks(auth_token)
        
        # 4. 测试数据表查询
        test_tables(auth_token)
        
    finally:
        # 5. 登出
        sign_out(auth_token, api_version)
    
    print("\n" + "=" * 60)
    print("✅ 测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
