import requests
import json

BASE_URL = "http://localhost:8101/api"

def test_view_lineage():
    # 1. Get a list of views (dashboards and sheets)
    print("Fetching views...")
    try:
        resp = requests.get(f"{BASE_URL}/views?page_size=20&include_standalone=true")
        data = resp.json()
        items = data.get('items', [])
    except Exception as e:
        print(f"Error fetching views: {e}")
        return

    if not items:
        print("No views found.")
        return

    # Find a dashboard and a sheet
    dashboard = next((v for v in items if v.get('viewType') == 'dashboard'), None)
    sheet = next((v for v in items if v.get('viewType') == 'sheet'), None)

    if dashboard:
        print(f"\nTesting Dashboard Lineage: {dashboard['name']} ({dashboard['id']})")
        l_resp = requests.get(f"{BASE_URL}/lineage/view/{dashboard['id']}")
        l_data = l_resp.json()
        print("  Upstream:", [u['type'] + ':' + u['name'] for u in l_data.get('upstream', [])])
        print("  Downstream:", [d['type'] + ':' + d['name'] for d in l_data.get('downstream', [])])
        
        # Test Graph
        g_resp = requests.get(f"{BASE_URL}/lineage/graph/view/{dashboard['id']}")
        g_data = g_resp.json()
        print("  Graph Nodes:", len(g_data.get('nodes', [])))
        print("  Graph Edges:", len(g_data.get('edges', [])))

    if sheet:
        print(f"\nTesting Sheet Lineage: {sheet['name']} ({sheet['id']})")
        l_resp = requests.get(f"{BASE_URL}/lineage/view/{sheet['id']}")
        l_data = l_resp.json()
        print("  Upstream:", [u['type'] + ':' + u['name'] for u in l_data.get('upstream', [])])
        print("  Downstream:", [d['type'] + ':' + d['name'] for d in l_data.get('downstream', [])])

        # Test Graph
        g_resp = requests.get(f"{BASE_URL}/lineage/graph/view/{sheet['id']}")
        g_data = g_resp.json()
        print("  Graph Nodes:", len(g_data.get('nodes', [])))
        print("  Graph Edges:", len(g_data.get('edges', [])))

if __name__ == "__main__":
    test_view_lineage()
