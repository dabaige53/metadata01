"""
数据库初始化脚本
"""
import os
import sys

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.config import Config
from app.models import Base, get_engine, init_db, get_session
from app.models import Metric, MetricVariant, MetricDuplicate


def seed_metrics(session):
    """插入示例指标数据"""
    print("\n正在插入示例指标数据...")
    
    # 示例指标数据
    metrics_data = [
        {
            "id": "metric_001",
            "name": "Gross_Profit_Ratio (毛利率)",
            "description": "核心财务指标：毛利率计算，需排除退货数据。",
            "formula": "SUM([Sales] - [Cost]) / SUM([Sales])",
            "formula_hash": "7a2b9c1d4e5f6a7b8c9d0e1f2a3b4c5d",
            "metric_type": "Calculated Field",
            "owner": "Finance_Team",
            "status": "active",
            "complexity_score": 12
        },
        {
            "id": "metric_002",
            "name": "Customer_Churn_Flag (流失客户)",
            "description": "客户流失定义：超过6个月未下单。",
            "formula": "IF DATEDIFF('month', [Last Order Date], TODAY()) > 6 THEN 'Yes' ELSE 'No' END",
            "formula_hash": "9x8y7z6w5v4u3t2s1r0q9p8o7n6m5l4k",
            "metric_type": "Logic Rule",
            "owner": "Marketing_Ops",
            "status": "review",
            "complexity_score": 8
        },
        {
            "id": "metric_003",
            "name": "YoY_Growth (同比增长)",
            "description": "同比销售额增长率，基于月度聚合。",
            "formula": "(SUM([Sales]) - LOOKUP(SUM([Sales]), -12)) / ABS(LOOKUP(SUM([Sales]), -12))",
            "formula_hash": "3c2d1e4f5g6h7i8j9k0l1m2n3o4p5q6r",
            "metric_type": "Calculated Field",
            "owner": "Sales_Strategy",
            "status": "active",
            "complexity_score": 15
        },
        # 重复指标示例 - 与 metric_001 公式相同
        {
            "id": "metric_004",
            "name": "GP_Margin (毛利)",
            "description": "财务团队定义的毛利率计算。",
            "formula": "SUM([Sales] - [Cost]) / SUM([Sales])",
            "formula_hash": "7a2b9c1d4e5f6a7b8c9d0e1f2a3b4c5d",  # 相同 hash
            "metric_type": "Calculated Field",
            "owner": "Analytics_Team",
            "status": "active",
            "complexity_score": 12
        },
        {
            "id": "metric_005",
            "name": "Average_Order_Value (客单价)",
            "description": "平均每笔订单金额。",
            "formula": "SUM([Revenue]) / COUNTD([Order ID])",
            "formula_hash": "5r4s3t2u1v0w9x8y7z6a5b4c3d2e1f0g",
            "metric_type": "Calculated Field",
            "owner": "Product_Team",
            "status": "active",
            "complexity_score": 6
        }
    ]
    
    for m_data in metrics_data:
        metric = Metric(**m_data)
        session.add(metric)
    
    # 添加变体示例
    variants_data = [
        {"master_metric_id": "metric_001", "variant_name": "GP%", "source": "Executive Dashboard"},
        {"master_metric_id": "metric_001", "variant_name": "Gross Margin", "source": "Sales Report"},
        {"master_metric_id": "metric_001", "variant_name": "Profit Ratio", "source": "Finance Workbook"},
        {"master_metric_id": "metric_002", "variant_name": "Is_Churned", "source": "Marketing Dashboard"},
        {"master_metric_id": "metric_002", "variant_name": "流失标记", "source": "中文报表"},
        {"master_metric_id": "metric_003", "variant_name": "YoY %", "source": "Trend Analysis"},
    ]
    
    for v_data in variants_data:
        variant = MetricVariant(**v_data)
        session.add(variant)
    
    # 添加重复检测记录 (metric_001 和 metric_004 公式相同)
    duplicate = MetricDuplicate(
        metric_id="metric_001",
        duplicate_metric_id="metric_004",
        similarity_score=1.0,
        detection_method="hash",
        status="pending"
    )
    session.add(duplicate)
    
    session.commit()
    print(f"  - 创建 {len(metrics_data)} 个指标")
    print(f"  - 创建 {len(variants_data)} 个变体")
    print(f"  - 创建 1 个待审核重复记录")


def main():
    """初始化数据库"""
    print("=" * 50)
    print("Tableau 元数据监控系统 - 数据库初始化")
    print("=" * 50)
    
    database_path = Config.DATABASE_PATH
    print(f"\n数据库路径: {database_path}")
    
    # 检查数据库是否已存在
    if os.path.exists(database_path):
        response = input("\n数据库已存在，是否重新初始化？(y/N): ")
        if response.lower() != 'y':
            print("取消初始化")
            return
        os.remove(database_path)
        print("已删除旧数据库")
    
    # 创建数据库引擎
    engine = get_engine(database_path)
    
    # 初始化表结构
    print("\n正在创建数据库表...")
    init_db(engine)
    
    # 列出创建的表
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\n成功创建 {len(tables)} 个表:")
    for table in tables:
        columns = inspector.get_columns(table)
        print(f"  - {table} ({len(columns)} 个字段)")
    
    # 插入示例数据
    session = get_session(engine)
    try:
        seed_metrics(session)
    finally:
        session.close()
    
    print("\n" + "=" * 50)
    print("数据库初始化完成!")
    print("=" * 50)


if __name__ == '__main__':
    main()

