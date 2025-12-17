---
trigger: always_on
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Tableau 元数据治理平台 - 从 Tableau Server 抓取元数据，存入本地 SQLite 数据库，提供 Web 界面进行数据治理分析。参考开源项目设计、元数据采集、元数据管理、血缘分析等理念，<https://github.com/datahub-project/datahub>

## 技术栈

- **后端**: Flask 3.0 + SQLAlchemy 2.0
- **数据库**: SQLite (metadata.db)
- **Tableau 集成**: Metadata API (GraphQL) + REST API 认证

## 常用命令

```bash
# 启动 Web 服务
python run.py

# 执行数据同步（从 Tableau Server 抓取元数据）
python tableau_sync.py

# 初始化数据库
python init_db.py
```

服务默认运行在 `http://localhost:8001`

## 项目结构

```
app/
├── __init__.py      # Flask 应用工厂
├── config.py        # 配置（数据库路径、端口等）
├── models.py        # SQLAlchemy ORM 模型（核心数据结构）
├── routes/
│   └── api.py       # REST API 路由（所有业务逻辑）
├── templates/       # Jinja2 模板
└── static/          # 前端静态资源
```

## 核心数据模型

数据流向：`Database → Table → Datasource → Workbook → View`

关键实体：

- **Database/DBTable/DBColumn**: 数据库连接层
- **Datasource**: Tableau 已发布数据源
- **Field/CalculatedField**: 字段与计算字段
- **Workbook/View**: 工作簿与视图/仪表板

血缘关系表：

- `table_to_datasource`: 表→数据源
- `datasource_to_workbook`: 数据源→工作簿
- `field_to_view`: 字段→视图

## API 端点

| 路径 | 说明 |
|------|------|
| `/api/stats` | 全局统计 |
| `/api/dashboard/analysis` | 治理健康度分析 |
| `/api/databases`, `/api/tables`, `/api/datasources` | 资产列表 |
| `/api/fields`, `/api/metrics` | 字段/指标（支持分页） |
| `/api/lineage/{type}/{id}` | 血缘关系 |
| `/api/search?q=` | 全局搜索 |
| `/api/quality/overview` | 数据质量概览 |

## 开发规范

- 永远使用真实数据，不使用 mock 数据
- 站在数据治理角度设计程序
- 当前为只读模式，所有修改操作返回 405
