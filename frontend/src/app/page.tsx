'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type DashboardAnalysis } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import {
  FileText, // document (file-text)
  Clock, // clock
  GitBranch, // git-branch
  CheckCircle, // check-circle
  Award, // award (shield like)
  AlertCircle, // alert-circle
  PieChart, // pie-chart
  BarChart2, // bar-chart-2
  Flame, // flame
  ChevronRight,
  ShieldCheck, // shield-check
  Info
} from 'lucide-react';

export default function OverviewPage() {
  const [data, setData] = useState<DashboardAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { openDrawer } = useDrawer();

  useEffect(() => {
    api.getDashboardAnalysis()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data) return <div className="text-center py-20 text-gray-400">加载失败</div>;

  const hc = data.health_score >= 80 ? 'good' : data.health_score >= 60 ? 'warn' : 'bad';
  const scores = data.governance_scores;
  const qualityData = data.quality_metrics;

  const navigateToModule = (module: string, filterKey?: string, filterVal?: string) => {
    if (filterKey && filterVal) {
      // 简单实现：使用 URL 参数传递筛选 (需要在列表页实现读取)
      // 暂时只跳转列表
      router.push(`/${module}`);
    } else {
      router.push(`/${module}`);
    }
  };

  const buildDimCard = (label: string, score: number, Icon: React.ElementType) => {
    const statusColor = score >= 90 ? 'text-green-600' : score >= 70 ? 'text-orange-500' : 'text-red-500';
    const bgClass = score >= 90 ? 'bg-green-50' : score >= 70 ? 'bg-orange-50' : 'bg-red-50';
    const barColor = score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-orange-500' : 'bg-red-500';

    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col relative overflow-hidden group">
        <div className="flex justify-between items-start mb-2 z-10">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${bgClass} ${statusColor}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-medium text-gray-600">{label}</span>
          </div>
          <Info className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-help" />
        </div>
        <div className="flex items-baseline gap-1 mt-auto z-10">
          <span className="text-2xl font-bold text-gray-800">{score}</span>
          <span className="text-[10px] text-gray-400">/100</span>
        </div>
        <div className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${barColor}`} style={{ width: `${score}%` }}></div>
      </div>
    );
  };

  const buildCoverageBar = (title: string, barData?: { coverage_rate?: number; with_description?: number; total?: number; certification_rate?: number; certified?: number }) => {
    const rate = barData?.coverage_rate || 0;
    const with_desc = barData?.with_description || 0;
    const total = barData?.total || 0;
    const color = rate >= 80 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500';

    return (
      <div className="mb-3 last:mb-0">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[12px] text-gray-600">{title}</span>
          <span className="text-[11px] font-medium text-gray-800">{with_desc}/{total} ({rate}%)</span>
        </div>
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${rate}%` }}></div>
        </div>
      </div>
    );
  };

  const buildDistChart = (distData: Record<string, number>, colorMap: Record<string, string>) => {
    if (!distData) return <div className="text-gray-300 text-xs text-center py-4">暂无数据</div>;
    const total = Object.values(distData).reduce((a, b) => a + b, 0);
    return Object.entries(distData).slice(0, 5).map(([k, v]) => {
      const pct = total ? ((v / total) * 100).toFixed(1) : '0';
      const color = colorMap[k] || '#6366f1';
      return (
        <div key={k} className="mb-2 last:mb-0">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-gray-600 truncate mr-2" title={k}>{k}</span>
            <span className="text-gray-500 font-mono">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }}></div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* 头部：健康总览 */}
      <div className="grid grid-cols-12 gap-6">
        {/* 左侧：总体健康分 */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 p-6 h-full flex flex-col justify-center items-center relative overflow-hidden shadow-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-white to-gray-50 z-0"></div>
            <div className="relative z-10 text-center">
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">治理健康分</div>
              <div className={`text-6xl font-black tracking-tight mb-2 ${hc === 'good' ? 'text-green-600' : hc === 'warn' ? 'text-orange-500' : 'text-red-500'}`}>
                {data.health_score}
              </div>
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${hc === 'good' ? 'bg-green-100 text-green-800' : hc === 'warn' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                {data.health_score >= 80 ? '状态良好' : data.health_score >= 60 ? '需要关注' : '亟需治理'}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：四个治理维度 */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {buildDimCard('完整性 (Completeness)', scores.completeness, FileText)}
          {buildDimCard('规范性 (Standardization)', scores.standardization, Award)}
          {buildDimCard('时效性 (Timeliness)', scores.timeliness, Clock)}
          {buildDimCard('一致性 (Consistency)', scores.consistency, GitBranch)}
          {buildDimCard('有效性 (Validity)', scores.validity, CheckCircle)}

          {/* 资产统计条 (嵌入在维度下方) */}
          <div className="col-span-2 lg:col-span-4 bg-gray-50 rounded-lg p-3 flex justify-around items-center border border-gray-200 border-dashed mt-1">
            <div className="text-center cursor-pointer hover:opacity-75 transition-opacity" onClick={() => navigateToModule('fields')}>
              <div className="text-[16px] font-bold text-gray-700">{data.total_assets.fields}</div>
              <div className="text-[10px] text-gray-400 uppercase">字段</div>
            </div>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="text-center cursor-pointer hover:opacity-75 transition-opacity" onClick={() => navigateToModule('metrics')}>
              <div className="text-[16px] font-bold text-gray-700">{data.total_assets.calculated_fields}</div>
              <div className="text-[10px] text-gray-400 uppercase">指标</div>
            </div>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="text-center cursor-pointer hover:opacity-75 transition-opacity" onClick={() => navigateToModule('tables')}>
              <div className="text-[16px] font-bold text-gray-700">{data.total_assets.tables}</div>
              <div className="text-[10px] text-gray-400 uppercase">数据表</div>
            </div>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="text-center cursor-pointer hover:opacity-75 transition-opacity" onClick={() => navigateToModule('datasources')}>
              <div className="text-[16px] font-bold text-gray-700">{data.total_assets.datasources}</div>
              <div className="text-[10px] text-gray-400 uppercase">数据源</div>
            </div>
          </div>
        </div>
      </div>

      {/* 数据质量仪表盘 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 描述覆盖率 */}
        <div className="col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" /> 元数据描述覆盖率
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {buildCoverageBar('字段描述', data.quality_metrics?.field_coverage)}
            {buildCoverageBar('表描述', data.quality_metrics?.table_coverage)}
            {buildCoverageBar('指标描述', data.quality_metrics?.metric_coverage)}
            {buildCoverageBar('数据源描述', data.quality_metrics?.datasource_coverage)}
            {buildCoverageBar('工作簿描述', data.quality_metrics?.workbook_coverage)}
            <div className="bg-blue-50/50 rounded-xl p-4 flex flex-col justify-center">
              <div className="text-xs text-blue-600 mb-2 font-medium">官方认证率</div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-bold text-blue-700">{data.quality_metrics?.datasource_coverage?.certification_rate || 0}%</span>
                <span className="text-[10px] text-blue-400 mb-1">数据源认证</span>
              </div>
            </div>
          </div>
        </div>

        {/* 认证状态饼图 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-500" /> 数据源认证
          </h4>
          <div className="py-2 flex items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${qualityData.datasource_coverage.certification_rate}, 100`} className={qualityData.datasource_coverage.certification_rate >= 80 ? 'text-green-500' : 'text-yellow-500'} />
              </svg>
              <div className="absolute text-[12px] font-bold text-gray-700">{qualityData.datasource_coverage.certification_rate}%</div>
            </div>
            <div className="flex-1">
              <div className="text-[12px] text-gray-500 mb-1">已认证数据源</div>
              <div className="text-xl font-bold text-gray-800">
                {qualityData.datasource_coverage.certified} <span className="text-xs font-normal text-gray-400">/ {qualityData.datasource_coverage.total}</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">可信数据比例</div>
            </div>
          </div>
        </div>
      </div>

      {/* 待处理事项 (Action Center) */}
      <div className="space-y-3">
        <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-500" /> 行动中心 (Action Items)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div onClick={() => navigateToModule('metrics', 'hasDuplicate', 'true')} className="group flex items-center justify-between p-3 bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm rounded-lg cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[13px] text-gray-700 font-medium group-hover:text-indigo-600 transition-colors">修复重复公式</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-600">{data.issues.duplicate_formulas}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </div>
          </div>

          <div onClick={() => navigateToModule('datasources', 'hasExtract', 'true')} className="group flex items-center justify-between p-3 bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm rounded-lg cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
              <span className="text-[13px] text-gray-700 font-medium group-hover:text-indigo-600 transition-colors">更新停更数据源</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-600">{data.issues.stale_datasources}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </div>
          </div>

          <div onClick={() => navigateToModule('tables', 'schema', '')} className="group flex items-center justify-between p-3 bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm rounded-lg cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              <span className="text-[13px] text-gray-700 font-medium group-hover:text-indigo-600 transition-colors">清理孤立表</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-600">{data.issues.orphaned_tables}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </div>
          </div>

          <div onClick={() => navigateToModule('fields', 'hasDescription', 'false')} className="group flex items-center justify-between p-3 bg-white border border-gray-100 hover:border-indigo-200 hover:shadow-sm rounded-lg cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-orange-400"></div>
              <span className="text-[13px] text-gray-700 font-medium group-hover:text-indigo-600 transition-colors">补充字段描述</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-600">{data.issues.missing_description}</span>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 详情分布图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 字段来源 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-gray-400" /> 字段来源分布
          </h4>
          <div className="space-y-3">
            {buildDistChart(data.field_source_distribution, { 'datasource': '#6366f1', 'table': '#10b981', 'workbook': '#f59e0b', 'orphan': '#ef4444' })}
          </div>
        </div>

        {/* 数据类型 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h4 className="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gray-400" /> 数据类型分布
          </h4>
          <div className="space-y-3">
            {buildDistChart(data.data_type_distribution, { 'string': '#10b981', 'integer': '#3b82f6', 'real': '#f59e0b', 'datetime': '#8b5cf6', 'boolean': '#6366f1' })}
          </div>
        </div>

        {/* 热点资产 */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-[300px]">
          <h4 className="text-[13px] font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" /> 热点字段 Top 10
          </h4>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <tbody className="text-[12px]">
                {(data.top_fields || []).map((f, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => openDrawer(f.id, 'fields', f.name)}>
                    <td className="py-2.5 font-mono text-gray-400 w-6">{i + 1}</td>
                    <td className="py-2.5 font-medium text-gray-700 truncate max-w-[120px]" title={f.name}>{f.name}</td>
                    <td className="py-2.5 text-right w-16">
                      <div className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-medium text-[10px]">
                        {f.usage} 引用
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
