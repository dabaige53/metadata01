import requests
import json

base_url = "http://localhost:8101/api"

terms = [
    {
        "term": "数据源认证",
        "definition": "标识数据源（Datasource）的可信程度。经过认证的数据源通常经过官方验证，数据质量有保障。",
        "category": "治理状态",
        "enums": [
            { "value": "true", "label": "已认证", "description": "经过数据团队官方验证，可信度高" },
            { "value": "false", "label": "未认证", "description": "由用户自行发布或未经验证" }
        ]
    },
    {
        "term": "字段角色",
        "definition": "定义字段在分析中的用途，主要分为维度和度量。",
        "category": "数据属性",
        "enums": [
            { "value": "dimension", "label": "维度", "description": "用于分类、切片或过滤数据的定性数据（如：地区、日期）" },
            { "value": "measure", "label": "度量", "description": "可以进行聚合计算的定量数据（如：销售额、利润）" }
        ]
    },
    {
        "term": "指标状态",
        "definition": "描述指标（Metric）当前的生命周期状态。",
        "category": "治理状态",
        "enums": [
            { "value": "active", "label": "活跃", "description": "正常使用中" },
            { "value": "deprecated", "label": "已弃用", "description": "不再建议使用，可能通过替代指标替换" },
            { "value": "review", "label": "审核中", "description": "正在等待治理团队审核" }
        ]
    },
    {
        "term": "计算复杂度",
        "definition": "根据计算字段公式的长度、嵌套层级等因素计算得出的评分，用于衡量维护成本。",
        "category": "技术指标",
        "enums": [
            { "value": "0-3", "label": "低复杂度", "description": "简单聚合或直接字段引用" },
            { "value": "4-7", "label": "中等复杂度", "description": "包含少量逻辑判断或嵌套函数" },
            { "value": ">7", "label": "高复杂度", "description": "复杂的跨表计算、LOD表达式或多层嵌套" }
        ]
    }
]

def init_data():
    print(f"Initializing glossary data to {base_url}...")
    for term in terms:
        try:
            print(f"Creating term: {term['term']}...")
            res = requests.post(f"{base_url}/glossary", json=term)
            if res.status_code == 201:
                print(f"  Success: {res.json()['id']}")
            elif res.status_code == 409:
                print(f"  Already exists.")
            else:
                print(f"  Failed: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"  Error: {e}")

if __name__ == "__main__":
    init_data()
