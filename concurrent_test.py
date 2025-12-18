import concurrent.futures
import requests
import time

API_BASE = "http://127.0.0.1:8001"
ENDPOINTS = [
    "/api/dashboard/analysis",
    "/api/stats",
    "/api/databases",
    "/api/fields?page=1&page_size=50",
    "/api/tables",
    "/api/datasources",
    "/api/quality/duplicates"
]

def fetch_endpoint(endpoint):
    url = f"{API_BASE}{endpoint}"
    start_time = time.time()
    try:
        response = requests.get(url, timeout=30)
        duration = time.time() - start_time
        return endpoint, response.status_code, duration, len(response.content)
    except Exception as e:
        duration = time.time() - start_time
        return endpoint, "Error", duration, str(e)

def run_concurrent_tests():
    print(f"开始并发测试... 基准地址: {API_BASE}")
    print("-" * 60)
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(ENDPOINTS)) as executor:
        future_to_url = {executor.submit(fetch_endpoint, url): url for url in ENDPOINTS}
        for future in concurrent.futures.as_completed(future_to_url):
            endpoint = future_to_url[future]
            try:
                endpoint, status, duration, info = future.result()
                status_color = "[PASS]" if status == 200 else "[FAIL]"
                print(f"{status_color} {endpoint:<35} | 状态: {status:<8} | 耗时: {duration:.2f}s | 大小/错误: {info}")
            except Exception as exc:
                print(f"[ERROR] {endpoint:<35} 生成了异常: {exc}")

if __name__ == "__main__":
    run_concurrent_tests()
