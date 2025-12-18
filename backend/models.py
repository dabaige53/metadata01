"""
SQLAlchemy ORM 模型
基于数据库设计文档创建 - 增强版（补全 Tableau Metadata API 字段）
"""
from datetime import datetime
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, Boolean, 
    Text, DateTime, ForeignKey, Table
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

Base = declarative_base()


# ==================== 关联表 ====================

table_to_datasource = Table(
    'table_to_datasource',
    Base.metadata,
    Column('table_id', String(255), ForeignKey('tables.id'), primary_key=True),
    Column('datasource_id', String(255), ForeignKey('datasources.id'), primary_key=True),
    Column('relationship_type', String(50))
)

datasource_to_workbook = Table(
    'datasource_to_workbook',
    Base.metadata,
    Column('datasource_id', String(255), ForeignKey('datasources.id'), primary_key=True),
    Column('workbook_id', String(255), ForeignKey('workbooks.id'), primary_key=True)
)

field_to_view = Table(
    'field_to_view',
    Base.metadata,
    Column('field_id', String(255), ForeignKey('fields.id'), primary_key=True),
    Column('view_id', String(255), ForeignKey('views.id'), primary_key=True),
    Column('used_in_formula', Boolean, default=False)
)


# ==================== 辅助实体表 ====================

class TableauUser(Base):
    """Tableau 用户"""
    __tablename__ = 'tableau_users'
    
    id = Column(String(255), primary_key=True)
    luid = Column(String(255))  # REST API 标识符
    name = Column(String(255), nullable=False)  # 用户名
    display_name = Column(String(255))  # 显示名称
    email = Column(String(255))
    domain = Column(String(255))
    site_role = Column(String(100))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'displayName': self.display_name,
            'email': self.email,
            'siteRole': self.site_role
        }


class Project(Base):
    """Tableau 项目"""
    __tablename__ = 'projects'
    
    id = Column(String(255), primary_key=True)
    luid = Column(String(255))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    parent_project_id = Column(String(255), ForeignKey('projects.id'))
    vizportal_url_id = Column(String(255))
    
    # 关系
    parent_project = relationship('Project', remote_side=[id], backref='child_projects')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'parentProjectId': self.parent_project_id
        }


# ==================== 核心实体表 ====================

class Database(Base):
    """数据库连接（增强版）"""
    __tablename__ = 'databases'
    
    id = Column(String(255), primary_key=True)
    luid = Column(String(255))  # REST API 标识符
    name = Column(String(255), nullable=False)
    connection_type = Column(String(100))  # snowflake, sqlserver, excel-direct
    host_name = Column(String(500))
    port = Column(Integer)  # 端口号
    service = Column(String(255))  # 服务名（Oracle等）
    description = Column(Text)  # 描述
    is_certified = Column(Boolean, default=False)  # 是否认证
    certification_note = Column(Text)  # 认证说明
    platform = Column(String(50))  # cloud/on-prem
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    tables = relationship('DBTable', back_populates='database')
    
    def to_dict(self):
        return {
            'id': self.id,
            'luid': self.luid,
            'name': self.name,
            'type': self.connection_type,
            'host': self.host_name,
            'port': self.port,
            'service': self.service,
            'description': self.description,
            'isCertified': self.is_certified,
            'certificationNote': self.certification_note,
            'platform': self.platform,
            'tables': len(self.tables) if self.tables else 0,
            'status': 'active',
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class DBTable(Base):
    """数据表（增强版）"""
    __tablename__ = 'tables'
    
    id = Column(String(255), primary_key=True)
    luid = Column(String(255))  # REST API 标识符
    name = Column(String(255), nullable=False)
    full_name = Column(String(500))
    schema = Column(String(255))
    database_id = Column(String(255), ForeignKey('databases.id'))
    connection_type = Column(String(100))
    table_type = Column(String(50))  # 表类型
    description = Column(Text)  # 描述
    is_embedded = Column(Boolean, default=False)
    is_certified = Column(Boolean, default=False)  # 是否认证
    certification_note = Column(Text)  # 认证说明
    project_name = Column(String(255))  # 项目名称
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    
    # 关系
    database = relationship('Database', back_populates='tables')
    columns = relationship('DBColumn', back_populates='table')
    fields = relationship('Field', back_populates='table')
    datasources = relationship('Datasource', secondary=table_to_datasource, back_populates='tables')
    
    def to_dict(self):
        return {
            'id': self.id,
            'luid': self.luid,
            'name': self.name,
            'fullName': self.full_name,
            'schema': self.schema,
            'databaseId': self.database_id,
            'databaseName': self.database.name if self.database else None,
            'connectionType': self.connection_type,
            'tableType': self.table_type,
            'description': self.description,
            'isEmbedded': self.is_embedded,
            'isCertified': self.is_certified,
            'projectName': self.project_name,
            'columnCount': len(self.columns) if self.columns else 0,
            'fieldCount': len(self.fields) if self.fields else 0,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class DBColumn(Base):
    """数据库原生列（新增）"""
    __tablename__ = 'db_columns'
    
    id = Column(String(255), primary_key=True)
    luid = Column(String(255))  # REST API 标识符
    name = Column(String(255), nullable=False)
    remote_type = Column(String(100))  # 数据库原生数据类型
    description = Column(Text)
    is_nullable = Column(Boolean)
    is_certified = Column(Boolean, default=False)
    certification_note = Column(Text)
    table_id = Column(String(255), ForeignKey('tables.id'))
    
    # 关系
    table = relationship('DBTable', back_populates='columns')
    
    def to_dict(self):
        return {
            'id': self.id,
            'luid': self.luid,
            'name': self.name,
            'remoteType': self.remote_type,
            'description': self.description,
            'isNullable': self.is_nullable,
            'isCertified': self.is_certified,
            'tableId': self.table_id,
            'tableName': self.table.name if self.table else None
        }


class Field(Base):
    """字段（增强版 - 补全 Tableau Metadata API 字段）"""
    __tablename__ = 'fields'
    
    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)  # 重命名后的显示名
    data_type = Column(String(100))  # Tableau 数据类型: float, int, string
    remote_type = Column(String(100))  # 数据库原生类型: NUMBER(18,2)
    description = Column(Text)
    table_id = Column(String(255), ForeignKey('tables.id'))
    datasource_id = Column(String(255), ForeignKey('datasources.id'))
    workbook_id = Column(String(255), ForeignKey('workbooks.id'))
    is_calculated = Column(Boolean, default=False)
    formula = Column(Text)
    role = Column(String(50))  # measure/dimension
    aggregation = Column(String(50))  # 默认聚合方式（SUM/AVG/COUNT等）
    is_hidden = Column(Boolean, default=False)  # 是否隐藏
    folder_name = Column(String(255))  # 所属文件夹
    
    # ========== 新增字段：名称层次 ==========
    fully_qualified_name = Column(String(500))  # 完全限定名（内部唯一标识）: [Orders].[Sales]
    caption = Column(String(255))  # 显示标题（用户界面显示的名称）
    upstream_column_name = Column(String(255))  # 原始列名（数据库表的物理列名）
    upstream_column_id = Column(String(255), ForeignKey('db_columns.id'))  # 关联的上游数据列 ID
    
    # ========== 新增字段：语义信息 ==========
    semantic_role = Column(String(100))  # 语义角色: [Geography].[City] 等
    default_format = Column(String(100))  # 默认格式: currency, percentage 等
    
    # ========== 新增字段：时间戳 ==========
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    
    # 关系
    table = relationship('DBTable', back_populates='fields')
    datasource = relationship('Datasource', back_populates='fields')
    workbook = relationship('Workbook', back_populates='fields')
    views = relationship('View', secondary=field_to_view, back_populates='fields')
    upstream_column = relationship('DBColumn', foreign_keys=[upstream_column_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'caption': self.caption,
            'fullyQualifiedName': self.fully_qualified_name,
            'upstreamColumnName': self.upstream_column_name,
            'upstreamColumnId': self.upstream_column_id,
            'dataType': self.data_type,
            'remoteType': self.remote_type,
            'description': self.description,
            'tableId': self.table_id,
            'table': self.table.name if self.table else None,
            'datasourceId': self.datasource_id,
            'datasource': self.datasource.name if self.datasource else None,
            'isCalculated': self.is_calculated,
            'formula': self.formula,
            'role': self.role,
            'semanticRole': self.semantic_role,
            'aggregation': self.aggregation,
            'defaultFormat': self.default_format,
            'isHidden': self.is_hidden,
            'folderName': self.folder_name,
            'usageCount': len(self.views) if self.views else 0,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class FieldDependency(Base):
    """字段依赖关系表 (DAG)"""
    __tablename__ = 'field_dependencies'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source_field_id = Column(String(255), ForeignKey('fields.id'), nullable=False) # 下游（计算字段）
    dependency_field_id = Column(String(255), ForeignKey('fields.id'), nullable=True) # 上游（被引用的字段）
    dependency_name = Column(String(255)) # 被引用的字段名（如果找不到ID，存名字）
    dependency_type = Column(String(50)) # 'formula', 'filter', etc.
    
    # 关系
    source_field = relationship('Field', foreign_keys=[source_field_id], backref='upstream_dependencies')
    dependency_field = relationship('Field', foreign_keys=[dependency_field_id], backref='downstream_impacts')

    def to_dict(self):
        return {
            'id': self.id,
            'sourceFieldId': self.source_field_id,
            'dependencyFieldId': self.dependency_field_id,
            'dependencyName': self.dependency_name,
            'dependencyType': self.dependency_type
        }


class Datasource(Base):
    """数据源（增强版）"""
    __tablename__ = 'datasources'
    
    id = Column(String(255), primary_key=True)
    luid = Column(String(255))  # REST API 标识符
    name = Column(String(255), nullable=False)
    description = Column(Text)  # 描述
    uri = Column(String(500))  # 数据源 URI
    project_name = Column(String(255))
    owner = Column(String(255))
    owner_id = Column(String(255))  # 所有者ID
    has_extract = Column(Boolean, default=False)
    extract_last_refresh_time = Column(DateTime)
    extract_last_incremental_update_time = Column(DateTime)  # 增量更新时间
    extract_last_update_time = Column(DateTime)  # 最后更新时间
    is_certified = Column(Boolean, default=False)
    certification_note = Column(Text)
    certifier_display_name = Column(String(255))  # 认证者名称
    contains_unsupported_custom_sql = Column(Boolean, default=False)  # 不支持的SQL
    has_active_warning = Column(Boolean, default=False)  # 活动警告
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    
    # 关系
    tables = relationship('DBTable', secondary=table_to_datasource, back_populates='datasources')
    fields = relationship('Field', back_populates='datasource')
    workbooks = relationship('Workbook', secondary=datasource_to_workbook, back_populates='datasources')
    
    def to_dict(self):
        return {
            'id': self.id,
            'luid': self.luid,
            'name': self.name,
            'description': self.description,
            'uri': self.uri,
            'projectName': self.project_name,
            'owner': self.owner,
            'hasExtract': self.has_extract,
            'lastRefresh': self.extract_last_refresh_time.isoformat() if self.extract_last_refresh_time else None,
            'lastIncrementalUpdate': self.extract_last_incremental_update_time.isoformat() if self.extract_last_incremental_update_time else None,
            'isCertified': self.is_certified,
            'certificationNote': self.certification_note,
            'certifierDisplayName': self.certifier_display_name,
            'containsUnsupportedCustomSql': self.contains_unsupported_custom_sql,
            'hasActiveWarning': self.has_active_warning,
            'tableCount': len(self.tables) if self.tables else 0,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class Workbook(Base):
    """工作簿（增强版）"""
    __tablename__ = 'workbooks'
    
    id = Column(String(255), primary_key=True)
    luid = Column(String(255))  # REST API 标识符
    name = Column(String(255), nullable=False)
    description = Column(Text)  # 描述
    uri = Column(String(500))  # 工作簿 URI
    project_name = Column(String(255))
    owner = Column(String(255))
    owner_id = Column(String(255))  # 所有者ID
    contains_unsupported_custom_sql = Column(Boolean, default=False)  # 不支持的SQL
    has_active_warning = Column(Boolean, default=False)  # 活动警告
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    
    # 关系
    views = relationship('View', back_populates='workbook')
    fields = relationship('Field', back_populates='workbook')
    datasources = relationship('Datasource', secondary=datasource_to_workbook, back_populates='workbooks')
    
    def to_dict(self):
        return {
            'id': self.id,
            'luid': self.luid,
            'name': self.name,
            'description': self.description,
            'uri': self.uri,
            'projectName': self.project_name,
            'owner': self.owner,
            'containsUnsupportedCustomSql': self.contains_unsupported_custom_sql,
            'hasActiveWarning': self.has_active_warning,
            'viewCount': len(self.views) if self.views else 0,
            'datasourceCount': len(self.datasources) if self.datasources else 0,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


class View(Base):
    """视图/仪表板（增强版）"""
    __tablename__ = 'views'
    
    id = Column(String(255), primary_key=True)
    luid = Column(String(255))  # REST API 标识符
    document_view_id = Column(String(255))  # 工作簿内唯一ID
    name = Column(String(255), nullable=False)
    path = Column(String(500))  # 服务器路径
    view_type = Column(String(50))  # 视图类型 (sheet/dashboard)
    index = Column(Integer)  # 在工作簿中的顺序
    workbook_id = Column(String(255), ForeignKey('workbooks.id'))
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    
    # 关系
    workbook = relationship('Workbook', back_populates='views')
    fields = relationship('Field', secondary=field_to_view, back_populates='views')
    
    def to_dict(self):
        return {
            'id': self.id,
            'luid': self.luid,
            'documentViewId': self.document_view_id,
            'name': self.name,
            'path': self.path,
            'viewType': self.view_type,
            'index': self.index,
            'workbookId': self.workbook_id,
            'workbookName': self.workbook.name if self.workbook else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }


# ==================== 计算字段详情表 ====================

class CalculatedField(Base):
    """计算字段详情"""
    __tablename__ = 'calculated_fields'
    
    field_id = Column(String(255), ForeignKey('fields.id'), primary_key=True)
    name = Column(String(255))
    formula = Column(Text)
    reference_count = Column(Integer, default=0)
    complexity_score = Column(Float, default=0)
    
    def to_dict(self):
        return {
            'fieldId': self.field_id,
            'name': self.name,
            'formula': self.formula,
            'referenceCount': self.reference_count,
            'complexityScore': self.complexity_score
        }


# ==================== 指标治理表 ====================

class Metric(Base):
    """标准指标"""
    __tablename__ = 'metrics'
    
    id = Column(String(255), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    formula = Column(Text)
    formula_hash = Column(String(64))  # 用于去重
    metric_type = Column(String(50))  # KPI, Calculated, Ratio
    owner = Column(String(255))
    status = Column(String(50), default='active')  # active/review/deprecated/duplicate
    complexity_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    variants = relationship('MetricVariant', back_populates='master_metric')
    duplicates = relationship('MetricDuplicate', foreign_keys='MetricDuplicate.metric_id', back_populates='metric')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'formula': self.formula,
            'type': self.metric_type,
            'owner': self.owner,
            'status': self.status,
            'complexity': self.complexity_score,
            'variants': len(self.variants) if self.variants else 0,
            'lastModified': self.updated_at.strftime('%Y-%m-%d') if self.updated_at else None,
            'tags': []  # TODO: 添加标签关系
        }


class MetricVariant(Base):
    """指标变体"""
    __tablename__ = 'metric_variants'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    master_metric_id = Column(String(255), ForeignKey('metrics.id'))
    variant_name = Column(String(255))
    source = Column(String(255))
    
    # 关系
    master_metric = relationship('Metric', back_populates='variants')
    
    def to_dict(self):
        return {
            'id': self.id,
            'masterMetricId': self.master_metric_id,
            'variantName': self.variant_name,
            'source': self.source
        }


class MetricDuplicate(Base):
    """重复检测记录"""
    __tablename__ = 'metric_duplicates'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    metric_id = Column(String(255), ForeignKey('metrics.id'))
    duplicate_metric_id = Column(String(255), ForeignKey('metrics.id'))
    similarity_score = Column(Float)
    detection_method = Column(String(50))  # hash, semantic, manual
    status = Column(String(50), default='pending')  # pending/confirmed/rejected
    
    # 关系
    metric = relationship('Metric', foreign_keys=[metric_id], back_populates='duplicates')
    duplicate_metric = relationship('Metric', foreign_keys=[duplicate_metric_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'metricId': self.metric_id,
            'duplicateMetricId': self.duplicate_metric_id,
            'similarityScore': self.similarity_score,
            'detectionMethod': self.detection_method,
            'status': self.status
        }


# ==================== 系统表 ====================

class SyncLog(Base):
    """同步日志"""
    __tablename__ = 'sync_logs'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    sync_type = Column(String(50))  # full/incremental
    status = Column(String(50))  # running/completed/failed
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    records_synced = Column(Integer, default=0)
    error_message = Column(Text)
    
    def to_dict(self):
        return {
            'id': self.id,
            'syncType': self.sync_type,
            'status': self.status,
            'startedAt': self.started_at.isoformat() if self.started_at else None,
            'completedAt': self.completed_at.isoformat() if self.completed_at else None,
            'recordsSynced': self.records_synced,
            'errorMessage': self.error_message
        }


# ==================== 数据库工具函数 ====================

def get_engine(database_path):
    """创建数据库引擎"""
    return create_engine(f'sqlite:///{database_path}', echo=False)


def init_db(engine):
    """初始化数据库表"""
    Base.metadata.create_all(engine)


def get_session(engine):
    """获取数据库会话"""
    Session = sessionmaker(bind=engine)
    return Session()
