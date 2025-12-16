import React, { useState } from 'react';
import { Database, Table2, FileText, Layers, BarChart3, Eye, Settings, Search, Filter, ChevronRight, Users, Clock, CheckCircle, AlertCircle, GitBranch, Edit, Trash2, Tag, TrendingUp, AlertTriangle, X, Save, Plus, Link } from 'lucide-react';

const TableauMetadataViewer = () => {
  const [activeModule, setActiveModule] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showLineage, setShowLineage] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    connectionType: 'all',
    certified: 'all',
    status: 'all',
    isCalculated: 'all'
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const [governanceAction, setGovernanceAction] = useState(null);

  // 模拟数据统计
  const stats = {
    databases: 134,
    tables: 450,
    fields: 8304,
    calculatedFields: 4768,
    datasources: 53,
    workbooks: 78,
    views: 1344,
    metrics: 156,
    duplicateMetrics: 45,
    orphanedFields: 23
  };

  // 模拟数据库列表
  const [databases, setDatabases] = useState([
    { id: '1', name: 'Snowflake Production', type: 'snowflake', host: 'prod.snowflake.com', platform: 'cloud', tables: 145, status: 'active' },
    { id: '2', name: 'SQL Server Analytics', type: 'sqlserver', host: '192.168.1.100', platform: 'on-prem', tables: 98, status: 'active' },
    { id: '3', name: 'Excel Data Warehouse', type: 'excel-direct', host: 'local', platform: 'cloud', tables: 12, status: 'inactive' },
  ]);

  // 模拟字段数据
  const [fields, setFields] = useState([
    { id: '1', name: 'revenue', dataType: 'float', remoteType: 'NUMBER(18,2)', table: 'sales_fact', datasource: 'Sales Analytics', isCalculated: false, role: 'measure', usageCount: 45, description: '总收入金额' },
    { id: '2', name: 'customer_name', dataType: 'string', remoteType: 'VARCHAR(255)', table: 'customer_dim', datasource: 'Customer Insights', isCalculated: false, role: 'dimension', usageCount: 78, description: '客户姓名' },
    { id: '3', name: 'profit_margin', dataType: 'float', remoteType: 'CALCULATED', table: 'sales_fact', datasource: 'Sales Analytics', isCalculated: true, role: 'measure', formula: 'SUM([Profit]) / SUM([Revenue])', usageCount: 23, description: '利润率' },
    { id: '4', name: 'total_orders', dataType: 'int', remoteType: 'CALCULATED', table: 'sales_fact', datasource: 'Sales Analytics', isCalculated: true, role: 'measure', formula: 'COUNT([Order_ID])', usageCount: 0, description: '订单总数（未使用）' },
  ]);

  // 模拟指标数据
  const [metrics, setMetrics] = useState([
    { id: '1', name: 'Total Revenue', formula: 'SUM([Revenue])', type: 'KPI', status: 'active', complexity: 1, variants: 5, owner: 'john.doe@company.com', lastModified: '2024-12-10', tags: ['Finance', 'KPI'] },
    { id: '2', name: 'Customer Lifetime Value', formula: 'AVG([Total_Purchase]) * AVG([Retention_Years])', type: 'Calculated', status: 'review', complexity: 3, variants: 12, owner: 'jane.smith@company.com', lastModified: '2024-12-15', tags: ['Marketing', 'Customer'] },
    { id: '3', name: 'Profit Margin %', formula: '(SUM([Profit]) / SUM([Revenue])) * 100', type: 'Ratio', status: 'deprecated', complexity: 2, variants: 8, owner: 'bob.wilson@company.com', lastModified: '2024-11-20', tags: ['Finance'] },
    { id: '4', name: 'Revenue Total', formula: 'SUM([Revenue])', type: 'KPI', status: 'duplicate', complexity: 1, variants: 3, owner: 'alice.brown@company.com', lastModified: '2024-12-12', tags: ['Finance'], duplicateOf: '1' },
  ]);

  // 血缘关系数据
  const lineageData = {
    '1': {
      upstream: [
        { type: 'table', name: 'sales_fact', schema: 'analytics' },
        { type: 'table', name: 'customer_dim', schema: 'analytics' }
      ],
      downstream: [
        { type: 'datasource', name: 'Sales Analytics' },
        { type: 'workbook', name: 'Q4 Sales Dashboard' },
        { type: 'view', name: 'Revenue Trend' }
      ]
    }
  };

  // 筛选数据
  const getFilteredData = (data) => {
    return data.filter(item => {
      // 搜索过滤
      const matchesSearch = searchTerm === '' ||
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.formula?.toLowerCase().includes(searchTerm.toLowerCase());

      // 类型过滤
      const matchesType = filterOptions.connectionType === 'all' || item.type === filterOptions.connectionType;

      // 认证过滤
      const matchesCertified = filterOptions.certified === 'all' ||
        (filterOptions.certified === 'true' && item.certified) ||
        (filterOptions.certified === 'false' && !item.certified);

      // 状态过滤
      const matchesStatus = filterOptions.status === 'all' || item.status === filterOptions.status;

      // 计算字段过滤
      const matchesCalculated = filterOptions.isCalculated === 'all' ||
        (filterOptions.isCalculated === 'true' && item.isCalculated) ||
        (filterOptions.isCalculated === 'false' && !item.isCalculated);

      return matchesSearch && matchesType && matchesCertified && matchesStatus && matchesCalculated;
    });
  };

  // 切换选中项
  const toggleItemSelection = (itemId) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // 批量操作
  const handleBulkAction = (action) => {
    setGovernanceAction(action);
  };

  // 执行治理操作
  const executeGovernanceAction = () => {
    if (governanceAction === 'merge') {
      // 合并重复指标
      const targetId = selectedItems[0];
      setMetrics(prev => prev.map(m =>
        selectedItems.includes(m.id) && m.id !== targetId
          ? { ...m, status: 'merged', mergedInto: targetId }
          : m
      ));
      alert(`已将 ${selectedItems.length - 1} 个指标合并到主指标`);
    } else if (governanceAction === 'deprecate') {
      // 废弃指标
      setMetrics(prev => prev.map(m =>
        selectedItems.includes(m.id) ? { ...m, status: 'deprecated' } : m
      ));
      alert(`已将 ${selectedItems.length} 个指标标记为废弃`);
    } else if (governanceAction === 'tag') {
      // 批量打标签
      const tag = prompt('请输入标签名称:');
      if (tag) {
        setMetrics(prev => prev.map(m =>
          selectedItems.includes(m.id) ? { ...m, tags: [...(m.tags || []), tag] } : m
        ));
        alert(`已为 ${selectedItems.length} 个指标添加标签: ${tag}`);
      }
    } else if (governanceAction === 'cleanup') {
      // 清理未使用字段
      const orphanedCount = fields.filter(f => selectedItems.includes(f.id) && f.usageCount === 0).length;
      if (confirm(`确定要删除 ${orphanedCount} 个未使用的字段吗？`)) {
        setFields(prev => prev.filter(f => !selectedItems.includes(f.id) || f.usageCount > 0));
        alert(`已清理 ${orphanedCount} 个未使用字段`);
      }
    }
    setSelectedItems([]);
    setGovernanceAction(null);
  };

  // 渲染全览页面（带治理看板）
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
          <Database className="w-8 h-8 mb-2 opacity-80" />
          <div className="text-3xl font-bold">{stats.databases}</div>
          <div className="text-sm opacity-90">数据库连接</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
          <Table2 className="w-8 h-8 mb-2 opacity-80" />
          <div className="text-3xl font-bold">{stats.tables}</div>
          <div className="text-sm opacity-90">数据表</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
          <FileText className="w-8 h-8 mb-2 opacity-80" />
          <div className="text-3xl font-bold">{stats.fields}</div>
          <div className="text-sm opacity-90">字段总数</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
          <Settings className="w-8 h-8 mb-2 opacity-80" />
          <div className="text-3xl font-bold">{stats.calculatedFields}</div>
          <div className="text-sm opacity-90">计算字段</div>
        </div>
      </div>

      {/* 治理问题看板 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          需要关注的治理问题
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => { setActiveModule('metrics'); setFilterOptions({ ...filterOptions, status: 'duplicate' }); }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-red-600">{stats.duplicateMetrics}</span>
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div className="text-sm text-red-700">重复指标</div>
            <div className="text-xs text-red-600 mt-1">点击查看详情</div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => { setActiveModule('fields'); setFilterOptions({ ...filterOptions, isCalculated: 'all' }); }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-yellow-600">{stats.orphanedFields}</span>
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
            <div className="text-sm text-yellow-700">未使用字段</div>
            <div className="text-xs text-yellow-600 mt-1">建议清理</div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold text-blue-600">67</span>
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div className="text-sm text-blue-700">待审核指标</div>
            <div className="text-xs text-blue-600 mt-1">需要验证</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-500" />
            数据源分布
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">已发布数据源</span>
              <span className="font-semibold">{stats.datasources}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">工作簿</span>
              <span className="font-semibold">{stats.workbooks}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">视图/仪表板</span>
              <span className="font-semibold">{stats.views}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-pink-500" />
            指标治理状态
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">标准指标</span>
              <span className="font-semibold">{stats.metrics}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">活跃状态</span>
              <span className="font-semibold text-green-600">89</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">待审核</span>
              <span className="font-semibold text-yellow-600">45</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染字段列表（带治理功能）
  const renderFields = () => {
    const filteredFields = getFilteredData(fields);
    const orphanedFields = filteredFields.filter(f => f.usageCount === 0);

    return (
      <div className="space-y-4">
        {/* 批量操作工具栏 */}
        {selectedItems.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm font-medium">已选择 {selectedItems.length} 个字段</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('tag')}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                批量打标签
              </button>
              <button
                onClick={() => handleBulkAction('cleanup')}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                清理未使用
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400">
                取消选择
              </button>
            </div>
          </div>
        )}

        {/* 未使用字段提示 */}
        {orphanedFields.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <div>
                  <div className="font-medium text-yellow-800">发现 {orphanedFields.length} 个未使用的字段</div>
                  <div className="text-sm text-yellow-700">这些字段在任何视图中都未被引用，建议考虑清理</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedItems(orphanedFields.map(f => f.id));
                  handleBulkAction('cleanup');
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                一键清理
              </button>
            </div>
          </div>
        )}

        {filteredFields.map(field => (
          <div key={field.id} className={`bg-white rounded-lg border p-6 hover:shadow-md transition-shadow ${selectedItems.includes(field.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}>
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={selectedItems.includes(field.id)}
                onChange={() => toggleItemSelection(field.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {field.name}
                      {field.isCalculated && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">计算字段</span>
                      )}
                      {field.usageCount === 0 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">未使用</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{field.description}</p>
                    <p className="text-xs text-gray-400 mt-1">来源: {field.datasource} / {field.table}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setSelectedItem(field); setShowLineage(true); }}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="查看血缘">
                      <GitBranch className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => { setSelectedItem(field); setShowEditModal(true); }}
                      className="p-2 hover:bg-gray-100 rounded"
                      title="编辑">
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">数据类型:</span>
                    <span className="ml-2 font-medium">{field.dataType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">远程类型:</span>
                    <span className="ml-2 font-mono text-xs">{field.remoteType}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">角色:</span>
                    <span className={`ml-2 px-2 py-0.5 rounded text-xs ${field.role === 'measure' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                      {field.role}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">使用次数:</span>
                    <span className={`ml-2 font-semibold ${field.usageCount === 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {field.usageCount}
                    </span>
                  </div>
                </div>
                {field.formula && (
                  <div className="mt-3 p-3 bg-gray-50 rounded text-xs font-mono">
                    {field.formula}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染指标治理（带重复检测）
  const renderMetrics = () => {
    const filteredMetrics = getFilteredData(metrics);
    const duplicates = filteredMetrics.filter(m => m.status === 'duplicate');

    return (
      <div className="space-y-4">
        {/* 批量操作工具栏 */}
        {selectedItems.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm font-medium">已选择 {selectedItems.length} 个指标</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('merge')}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                合并重复
              </button>
              <button
                onClick={() => handleBulkAction('deprecate')}
                className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700">
                标记废弃
              </button>
              <button
                onClick={() => handleBulkAction('tag')}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                批量打标签
              </button>
              <button
                onClick={() => setSelectedItems([])}
                className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400">
                取消选择
              </button>
            </div>
          </div>
        )}

        {/* 重复指标提示 */}
        {duplicates.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <div className="font-medium text-red-800">发现 {duplicates.length} 个重复指标</div>
                  <div className="text-sm text-red-700">这些指标与其他指标的计算逻辑相同，建议合并以保持一致性</div>
                </div>
              </div>
              <button
                onClick={() => alert('批量合并功能')}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
                查看合并建议
              </button>
            </div>
          </div>
        )}

        {filteredMetrics.map(metric => (
          <div key={metric.id} className={`bg-white rounded-lg border p-6 hover:shadow-md transition-shadow ${selectedItems.includes(metric.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            } ${metric.status === 'duplicate' ? 'border-l-4 border-l-red-500' : ''}`}>
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                checked={selectedItems.includes(metric.id)}
                onChange={() => toggleItemSelection(metric.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      {metric.name}
                      <span className={`text-xs px-2 py-1 rounded ${metric.status === 'active' ? 'bg-green-100 text-green-700' :
                          metric.status === 'review' ? 'bg-yellow-100 text-yellow-700' :
                            metric.status === 'duplicate' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                        }`}>
                        {metric.status}
                      </span>
                      {metric.duplicateOf && (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200">
                          重复指标 #{metric.duplicateOf}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      {metric.tags?.map(tag => (
                        <span key={tag} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div>
                      <div className="text-xs text-gray-500">复杂度</div>
                      <div className="text-lg font-bold">{metric.complexity}</div>
                    </div>
                    <button
                      onClick={() => { setSelectedItem(metric); setShowEditModal(true); }}
                      className="p-2 hover:bg-gray-100 rounded">
                      <Edit className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded text-xs font-mono mb-3">
                  {metric.formula}
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">类型:</span>
                    <span className="ml-2 font-medium">{metric.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">变体数:</span>
                    <span className="ml-2 font-semibold text-orange-600">{metric.variants}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">所有者:</span>
                    <span className="ml-2 text-xs">{metric.owner}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">最后修改:</span>
                    <span className="ml-2 text-xs">{metric.lastModified}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 血缘关系弹窗
  const LineageModal = () => {
    if (!showLineage || !selectedItem) return null;
    const lineage = lineageData[selectedItem.id] || { upstream: [], downstream: [] };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-blue-600" />
              数据血缘关系: {selectedItem.name}
            </h2>
            <button onClick={() => setShowLineage(false)} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 rotate-180" />
                上游依赖
              </h3>
              <div className="space-y-2">
                {lineage.upstream.length > 0 ? lineage.upstream.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-blue-50 rounded border border-blue-200">
                    {item.type === 'table' ? <Table2 className="w-4 h-4 text-blue-600" /> : <Database className="w-4 h-4 text-blue-600" />}
                    <div>
                      <div className="font-medium text-sm">{item.name}</div>
                      {item.schema && <div className="text-xs text-gray-500">{item.schema}</div>}
                    </div>
                  </div>
                )) : (
                  <div className="text-sm text-gray-500 text-center py-4">无上游依赖</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <ChevronRight className="w-4 h-4" />
                下游影响
              </h3>
              <div className="space-y-2">
                {lineage.downstream.length > 0 ? lineage.downstream.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-green-50 rounded border border-green-200">
                    {item.type === 'datasource' ? <Layers className="w-4 h-4 text-green-600" /> :
                      item.type === 'workbook' ? <BarChart3 className="w-4 h-4 text-green-600" /> :
                        <Eye className="w-4 h-4 text-green-600" />}
                    <div className="font-medium text-sm">{item.name}</div>
                  </div>
                )) : (
                  <div className="text-sm text-gray-500 text-center py-4">无下游影响</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">影响分析</div>
                <div>修改此字段将影响 {lineage.downstream.length} 个下游对象，建议在非高峰时段进行变更。</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 编辑弹窗
  const EditModal = () => {
    if (!showEditModal || !selectedItem) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">编辑: {selectedItem.name}</h2>
            <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">描述</label>
              <textarea
                className="w-full border border-gray-300 rounded p-2 text-sm"
                rows={3}
                defaultValue={selectedItem.description}
                placeholder="添加字段描述..."
              />
            </div>

            {selectedItem.formula && (
              <div>
                <label className="block text-sm font-medium mb-2">计算公式</label>
                <textarea
                  className="w-full border border-gray-300 rounded p-2 text-sm font-mono"
                  rows={4}
                  defaultValue={selectedItem.formula}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">标签</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedItem.tags?.map(tag => (
                  <span key={tag} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs flex items-center gap-1">
                    {tag}
                    <X className="w-3 h-3 cursor-pointer" />
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="添加标签..."
                className="w-full border border-gray-300 rounded p-2 text-sm"
              />
            </div>

            {selectedItem.status && (
              <div>
                <label className="block text-sm font-medium mb-2">状态</label>
                <select className="w-full border border-gray-300 rounded p-2 text-sm" defaultValue={selectedItem.status}>
                  <option value="active">活跃</option>
                  <option value="review">待审核</option>
                  <option value="deprecated">已废弃</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
              取消
            </button>
            <button
              onClick={() => { alert('保存成功'); setShowEditModal(false); }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2">
              <Save className="w-4 h-4" />
              保存
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 筛选面板
  const FilterPanel = () => (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Filter className="w-4 h-4" />
          筛选条件
        </h3>
        <button
          onClick={() => setFilterOptions({ connectionType: 'all', certified: 'all', status: 'all', isCalculated: 'all' })}
          className="text-xs text-blue-600 hover:text-blue-700">
          重置
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {activeModule === 'databases' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">连接类型</label>
            <select
              value={filterOptions.connectionType}
              onChange={(e) => setFilterOptions({ ...filterOptions, connectionType: e.target.value })}
              className="w-full border border-gray-300 rounded p-1.5 text-sm">
              <option value="all">全部</option>
              <option value="snowflake">Snowflake</option>
              <option value="sqlserver">SQL Server</option>
              <option value="excel-direct">Excel</option>
            </select>
          </div>
        )}
        {activeModule === 'fields' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">字段类型</label>
            <select
              value={filterOptions.isCalculated}
              onChange={(e) => setFilterOptions({ ...filterOptions, isCalculated: e.target.value })}
              className="w-full border border-gray-300 rounded p-1.5 text-sm">
              <option value="all">全部</option>
              <option value="true">计算字段</option>
              <option value="false">普通字段</option>
            </select>
          </div>
        )}
        {activeModule === 'metrics' && (
          <div>
            <label className="block text-xs text-gray-600 mb-1">状态</label>
            <select
              value={filterOptions.status}
              onChange={(e) => setFilterOptions({ ...filterOptions, status: e.target.value })}
              className="w-full border border-gray-300 rounded p-1.5 text-sm">
              <option value="all">全部</option>
              <option value="active">活跃</option>
              <option value="review">待审核</option>
              <option value="deprecated">已废弃</option>
              <option value="duplicate">重复</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );

  // 根据活动模块渲染内容
  const renderContent = () => {
    switch (activeModule) {
      case 'overview': return renderOverview();
      case 'fields': return <>{FilterPanel()}{renderFields()}</>;
      case 'metrics': return <>{FilterPanel()}{renderMetrics()}</>;
      default: return renderOverview();
    }
  };

  // 侧边栏菜单
  const menuItems = [
    { id: 'overview', icon: Eye, label: '全览概况', color: 'text-blue-500' },
    { id: 'databases', icon: Database, label: '数据库连接', color: 'text-purple-500', count: stats.databases },
    { id: 'tables', icon: Table2, label: '数据表', color: 'text-green-500', count: stats.tables },
    { id: 'fields', icon: FileText, label: '字段管理', color: 'text-orange-500', count: stats.fields },
    { id: 'datasources', icon: Layers, label: '数据源', color: 'text-cyan-500', count: stats.datasources },
    { id: 'workbooks', icon: BarChart3, label: '工作簿', color: 'text-pink-500', count: stats.workbooks },
    { id: 'metrics', icon: Settings, label: '指标治理', color: 'text-red-500', count: stats.metrics },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Tableau 元数据</h1>
          <p className="text-xs text-gray-500 mt-1">治理平台 v1.0</p>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg mb-2 transition-colors ${isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? item.color : 'text-gray-400'}`} />
                  <span className="font-medium text-sm">{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span className={`text-xs px-2 py-1 rounded ${isActive ? 'bg-blue-100' : 'bg-gray-100'
                    }`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Users className="w-5 h-5 text-gray-400" />
            <div>
              <div className="text-sm font-medium">管理员</div>
              <div className="text-xs text-gray-500">admin@company.com</div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部搜索栏 */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="搜索数据库、表、字段、指标..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>

      {/* 弹窗 */}
      <LineageModal />
      <EditModal />

      {/* 治理操作确认弹窗 */}
      {governanceAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">确认操作</h3>
            <p className="text-sm text-gray-600 mb-6">
              {governanceAction === 'merge' && `即将合并 ${selectedItems.length} 个指标`}
              {governanceAction === 'deprecate' && `即将废弃 ${selectedItems.length} 个指标`}
              {governanceAction === 'tag' && `即将为 ${selectedItems.length} 个项目添加标签`}
              {governanceAction === 'cleanup' && `即将清理 ${selectedItems.length} 个未使用字段`}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setGovernanceAction(null); setSelectedItems([]); }}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={executeGovernanceAction}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableauMetadataViewer;