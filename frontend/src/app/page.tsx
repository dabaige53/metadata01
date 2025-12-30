'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type DashboardAnalysis } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import {
  Award,
  BarChart3,
  Boxes,
  Building2,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Flame,
  GitBranch,
  LayoutGrid,
  ShieldCheck,
  Table,
  Users
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

type CardTone = 'neutral' | 'good' | 'warn' | 'bad';

function toneStyles(tone: CardTone) {
  if (tone === 'good') return { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', border: 'border-emerald-200' };
  if (tone === 'warn') return { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-200', border: 'border-amber-200' };
  if (tone === 'bad') return { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-200', border: 'border-red-200' };
  return { bg: 'bg-gray-50', text: 'text-gray-700', ring: 'ring-gray-200', border: 'border-gray-200' };
}

function governanceTone(score: number): CardTone {
  return score >= 85 ? 'good' : score >= 70 ? 'warn' : 'bad';
}

function governanceActionBadge(score: number) {
  const tone = governanceTone(score);
  if (tone === 'good') return { label: '保持', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (tone === 'warn') return { label: '关注', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: '治理', cls: 'bg-red-50 text-red-700 border-red-200' };
}

function formatInt(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

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

  const safe = data ?? {
    health_score: 0,
    governance_scores: { completeness: 0, timeliness: 0, consistency: 0, validity: 0, standardization: 0 },
    issues: {
      missing_description: 0,
      missing_desc_ratio: 0,
      stale_datasources: 0,
      dead_datasources: 0,
      duplicate_formulas: 0,
      orphaned_tables: 0,
      calc_field_no_desc: 0,
      field_coverage_rate: 0
    },
    quality_metrics: {
      field_coverage: { with_description: 0, total: 0, coverage_rate: 0 },
      table_coverage: { with_description: 0, total: 0, coverage_rate: 0 } as any,
      metric_coverage: { with_description: 0, total: 0, coverage_rate: 0 },
      datasource_coverage: { with_description: 0, total: 0, coverage_rate: 0, certified: 0, certification_rate: 0 },
      workbook_coverage: { with_description: 0, total: 0, coverage_rate: 0 }
    },
    role_distribution: {},
    data_type_distribution: {},
    field_source_distribution: {},
    complexity_distribution: {},
    duplicate_formulas_top: [],
    last_sync: null,
    lineage_coverage: {
      tables_with_downstream: 0,
      tables_total: 0,
      tables_rate: 0,
      datasources_with_upstream: 0,
      datasources_total: 0,
      datasources_rate: 0,
      fields_with_views: 0,
      fields_total: 0,
      fields_rate: 0,
      databases_total: 0
    },
    project_distribution: [],
    owner_distribution: [],
    uncertified_datasources: 0,
    top_fields: [],
    top_workbooks: [],
    total_assets: {
      fields: 0,
      calculated_fields: 0,
      tables: 0,
      datasources: 0,
      workbooks: 0,
      views: 0,
      databases: 0
    }
  };

  const healthTone: CardTone = safe.health_score >= 80 ? 'good' : safe.health_score >= 60 ? 'warn' : 'bad';
  const scores = safe.governance_scores;
  const qualityData = safe.quality_metrics;

  const governanceCards = useMemo(() => {
    const items = [
      { key: 'completeness', label: '完整性', score: scores.completeness, icon: FileText, hint: '描述覆盖、字段齐全' },
      { key: 'standardization', label: '规范性', score: scores.standardization, icon: ShieldCheck, hint: '认证、命名、标准口径' },
      { key: 'timeliness', label: '时效性', score: scores.timeliness, icon: Clock, hint: '刷新周期、停更资产' },
      { key: 'consistency', label: '一致性', score: scores.consistency, icon: GitBranch, hint: '重复指标、口径一致' },
      { key: 'validity', label: '有效性', score: scores.validity, icon: Award, hint: '孤立资产、可用性' }
    ];
    return items
      .slice()
      .sort((a, b) => a.score - b.score);
  }, [scores.completeness, scores.consistency, scores.standardization, scores.timeliness, scores.validity]);

  const healthSummary = useMemo(() => {
    const s = safe.health_score;
    const label = s >= 80 ? '状态良好' : s >= 60 ? '需要关注' : '亟需治理';
    const hint = s >= 80 ? '持续保持标准化与覆盖率' : s >= 60 ? '优先补齐描述与认证' : '优先处理重复指标与停更数据源';
    return { label, hint };
  }, [safe.health_score]);

  const assetCards = useMemo(() => {
    return [
      { key: 'databases', label: '数据库', value: safe.total_assets.databases, icon: Database, href: '/databases' },
      { key: 'tables', label: '数据表', value: safe.total_assets.tables, icon: Table, href: '/tables' },
      { key: 'datasources', label: '数据源', value: safe.total_assets.datasources, icon: Boxes, href: '/datasources' },
      { key: 'workbooks', label: '工作簿', value: safe.total_assets.workbooks, icon: LayoutGrid, href: '/workbooks' },
      { key: 'views', label: '视图', value: safe.total_assets.views, icon: BarChart3, href: '/views' },
      { key: 'fields', label: '原始字段', value: safe.total_assets.fields, icon: FileText, href: '/fields' },
      { key: 'metrics', label: '计算字段', value: safe.total_assets.calculated_fields, icon: Award, href: '/metrics' }
    ] as const;
  }, [
    safe.total_assets.calculated_fields,
    safe.total_assets.databases,
    safe.total_assets.datasources,
    safe.total_assets.fields,
    safe.total_assets.tables,
    safe.total_assets.views,
    safe.total_assets.workbooks
  ]);

  const qualityRadarData = useMemo(() => {
    const entries = [
      { name: '字段', value: qualityData.field_coverage.coverage_rate, total: qualityData.field_coverage.total, withDesc: qualityData.field_coverage.with_description },
      { name: '数据表', value: qualityData.table_coverage.coverage_rate, total: qualityData.table_coverage.total, withDesc: qualityData.table_coverage.with_description },
      { name: '数据源', value: qualityData.datasource_coverage.coverage_rate, total: qualityData.datasource_coverage.total, withDesc: qualityData.datasource_coverage.with_description },
      { name: '工作簿', value: qualityData.workbook_coverage.coverage_rate, total: qualityData.workbook_coverage.total, withDesc: qualityData.workbook_coverage.with_description },
      { name: '计算字段', value: qualityData.metric_coverage.coverage_rate, total: qualityData.metric_coverage.total, withDesc: qualityData.metric_coverage.with_description }
    ];
    return entries.map((d) => ({ name: d.name, 覆盖率: d.value, total: d.total, withDesc: d.withDesc }));
  }, [qualityData]);

  const complexityData = useMemo(() => {
    const map = safe.complexity_distribution as Record<string, number>;
    return [
      { level: '低', value: map.low || 0, color: '#10b981' },
      { level: '中', value: map.medium || 0, color: '#f59e0b' },
      { level: '高', value: map.high || 0, color: '#ef4444' }
    ];
  }, [safe.complexity_distribution]);

  const dataTypeTop = useMemo(() => {
    const dist = safe.data_type_distribution as Record<string, number>;
    return Object.entries(dist)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [safe.data_type_distribution]);

  const rolePie = useMemo(() => {
    const dist = safe.role_distribution as Record<string, number>;
    const dimension = dist['dimension'] || dist['DIMENSION'] || 0;
    const measure = dist['measure'] || dist['MEASURE'] || 0;
    const unknown = Object.entries(dist)
      .filter(([k]) => k !== 'dimension' && k !== 'measure' && k !== 'DIMENSION' && k !== 'MEASURE')
      .reduce((sum, [, v]) => sum + (v || 0), 0);
    return [
      { name: '维度', value: dimension, color: '#6366f1' },
      { name: '度量', value: measure, color: '#10b981' },
      { name: '未知', value: unknown, color: '#9ca3af' }
    ].filter((x) => x.value > 0);
  }, [safe.role_distribution]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pb-10">
        <div className="h-32 rounded-xl bg-white border border-gray-200 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-44 rounded-xl bg-white border border-gray-200 animate-pulse" />
          <div className="h-44 rounded-xl bg-white border border-gray-200 animate-pulse" />
          <div className="h-44 rounded-xl bg-white border border-gray-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-72 rounded-xl bg-white border border-gray-200 animate-pulse" />
          <div className="h-72 rounded-xl bg-white border border-gray-200 animate-pulse" />
          <div className="h-72 rounded-xl bg-white border border-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }
  if (!data) return <div className="text-center py-20 text-gray-400">加载失败</div>;

  const navigate = (href: string) => router.push(href);

  const buildScoreCard = (key: string, label: string, score: number, Icon: React.ElementType) => {
    const tone: CardTone = governanceTone(score);
    const s = toneStyles(tone);
    return (
      <div key={key} className={`bg-white rounded-xl border ${s.border} p-4 shadow-sm relative overflow-hidden`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${s.bg} ${s.text}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="text-[12px] font-semibold text-gray-700">{label}</div>
          </div>
          <div className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>{score}/100</div>
        </div>
        <div className="mt-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      {/* Hero：治理健康分 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 bg-gradient-to-br from-white via-gray-50 to-indigo-50/40">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="min-w-0">
              <div className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider">治理概览中心</div>
              <div className="mt-2 flex items-baseline gap-3">
                <div className="text-5xl lg:text-6xl font-black tracking-tight text-gray-900">{safe.health_score}</div>
                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-semibold border ${toneStyles(healthTone).bg} ${toneStyles(healthTone).text} ${toneStyles(healthTone).border}`}>{healthSummary.label}</div>
              </div>
              <div className="mt-2 text-sm text-gray-600">{healthSummary.hint}</div>
              {safe.last_sync?.time ? (
                <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>最近同步：</span>
                  <span className="font-mono">{new Date(safe.last_sync.time).toLocaleString('zh-CN')}</span>
                  {safe.last_sync.status ? (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{safe.last_sync.status}</span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full lg:w-auto">
              {governanceCards.map((g) => buildScoreCard(g.key, g.label, g.score, g.icon))}
            </div>
          </div>
        </div>
      </div>

      {/* 资产全景 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-gray-900">资产全景</div>
            <div className="mt-1 text-[12px] text-gray-500">基于真实同步数据统计，点击可快速进入对应模块</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
          {assetCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => navigate(card.href)}
                className="text-left bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-200 rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-semibold text-gray-600">{card.label}</div>
                  <Icon className="w-4 h-4 text-gray-400" />
                </div>
                <div className="mt-3 text-2xl font-black text-gray-900">{formatInt(card.value)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 治理洞察 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 描述覆盖率：条形图 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <div className="text-[13px] font-bold text-gray-900">描述覆盖率</div>
            </div>
            <div className="text-[11px] text-gray-500">覆盖率（%）</div>
          </div>
          <div className="mt-4 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={qualityRadarData} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} domain={[0, 100]} />
                <Tooltip
                  formatter={(value: any) => [`${value}%`, '覆盖率']}
                  labelFormatter={(label) => `类型：${label}`}
                  contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb' }}
                />
                <Bar dataKey="覆盖率" radius={[8, 8, 0, 0]}>
                  {qualityRadarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry['覆盖率'] >= 80 ? '#10b981' : entry['覆盖率'] >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
              <div className="text-[11px] text-gray-500">字段缺失描述</div>
              <div className="mt-1 text-lg font-black text-gray-900">{formatInt(safe.issues.missing_description)}</div>
              <div className="mt-0.5 text-[11px] text-gray-500">占比 {safe.issues.missing_desc_ratio}%</div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
              <div className="text-[11px] text-gray-500">计算字段缺失描述</div>
              <div className="mt-1 text-lg font-black text-gray-900">{formatInt(safe.issues.calc_field_no_desc)}</div>
              <div className="mt-0.5 text-[11px] text-gray-500">重点影响口径可信度</div>
            </div>
          </div>
        </div>

        {/* 认证与血缘覆盖 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <div className="text-[13px] font-bold text-gray-900">认证与血缘</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <div className="text-[11px] text-gray-500">已认证数据源</div>
              <div className="mt-2 text-3xl font-black text-gray-900">{formatInt(qualityData.datasource_coverage.certified)}</div>
              <div className="mt-1 text-[12px] text-gray-600">
                共 {formatInt(qualityData.datasource_coverage.total)}，认证率 <span className="font-semibold">{qualityData.datasource_coverage.certification_rate}%</span>
              </div>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <div className="text-[11px] text-gray-500">未认证数据源</div>
              <div className="mt-2 text-3xl font-black text-gray-900">{formatInt(safe.uncertified_datasources)}</div>
              <div className="mt-1 text-[12px] text-gray-600">建议优先认证高影响数据源</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <div className="flex items-center justify-between text-[12px] text-gray-600">
                <span className="font-medium">表 → 数据源血缘覆盖</span>
                <span className="font-mono">{safe.lineage_coverage.tables_with_downstream}/{safe.lineage_coverage.tables_total}（{safe.lineage_coverage.tables_rate}%）</span>
              </div>
              <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${safe.lineage_coverage.tables_rate}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[12px] text-gray-600">
                <span className="font-medium">数据源 → 上游表覆盖</span>
                <span className="font-mono">{safe.lineage_coverage.datasources_with_upstream}/{safe.lineage_coverage.datasources_total}（{safe.lineage_coverage.datasources_rate}%）</span>
              </div>
              <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${safe.lineage_coverage.datasources_rate}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-[12px] text-gray-600">
                <span className="font-medium">字段 → 视图覆盖</span>
                <span className="font-mono">{safe.lineage_coverage.fields_with_views}/{safe.lineage_coverage.fields_total}（{safe.lineage_coverage.fields_rate}%）</span>
              </div>
              <div className="mt-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${safe.lineage_coverage.fields_rate}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* 结构分布 */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-gray-500" />
              <div className="text-[13px] font-bold text-gray-900">结构分布</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-5">
            <div className="h-[170px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-semibold text-gray-700">数据类型 Top</div>
                <div className="text-[11px] text-gray-500">占比不展示，按数量</div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dataTypeTop} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} width={80} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="h-[170px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[12px] font-semibold text-gray-700">角色分布</div>
                <div className="text-[11px] text-gray-500">维度 / 度量</div>
              </div>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={rolePie} dataKey="value" nameKey="name" outerRadius={62} innerRadius={40} paddingAngle={2}>
                    {rolePie.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-2 flex flex-wrap gap-2">
                {rolePie.map((r) => (
                  <div key={r.name} className="inline-flex items-center gap-2 text-[11px] text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                    <span>{r.name}</span>
                    <span className="font-mono text-gray-500">{formatInt(r.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 行动中心 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-gray-900">行动中心</div>
            <div className="mt-1 text-[12px] text-gray-500">按治理影响度分组，建议从“高优先级”开始</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold text-red-700">高优先级</div>
              <div className="text-[11px] text-red-600">治理风险</div>
            </div>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => navigate('/metrics')}
                className="w-full group flex items-center justify-between p-3 rounded-xl bg-white border border-red-100 hover:border-red-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Flame className="w-4 h-4 text-red-500" />
                  <span className="text-[13px] font-medium text-gray-800 truncate">重复公式（需治理）</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">{formatInt(safe.issues.duplicate_formulas)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/datasources')}
                className="w-full group flex items-center justify-between p-3 rounded-xl bg-white border border-red-100 hover:border-red-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 text-red-500" />
                  <span className="text-[13px] font-medium text-gray-800 truncate">停更数据源（30天+）</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700">{formatInt(safe.issues.stale_datasources)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-red-400" />
                </div>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold text-amber-700">中优先级</div>
              <div className="text-[11px] text-amber-600">提升可理解性</div>
            </div>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => navigate('/fields')}
                className="w-full group flex items-center justify-between p-3 rounded-xl bg-white border border-amber-100 hover:border-amber-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span className="text-[13px] font-medium text-gray-800 truncate">缺失字段描述</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">{formatInt(safe.issues.missing_description)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-400" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/tables')}
                className="w-full group flex items-center justify-between p-3 rounded-xl bg-white border border-amber-100 hover:border-amber-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Table className="w-4 h-4 text-amber-600" />
                  <span className="text-[13px] font-medium text-gray-800 truncate">孤立表（无下游）</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700">{formatInt(safe.issues.orphaned_tables)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-400" />
                </div>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold text-gray-700">低优先级</div>
              <div className="text-[11px] text-gray-500">持续优化</div>
            </div>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => navigate('/metrics')}
                className="w-full group flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Award className="w-4 h-4 text-gray-500" />
                  <span className="text-[13px] font-medium text-gray-800 truncate">缺失指标描述</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">{formatInt(safe.issues.calc_field_no_desc)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/datasources')}
                className="w-full group flex items-center justify-between p-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-gray-500" />
                  <span className="text-[13px] font-medium text-gray-800 truncate">未认证数据源</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">{formatInt(safe.uncertified_datasources)}</span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500" />
                </div>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-gray-400" />
              <div className="text-[12px] font-bold text-gray-900">治理优先级建议</div>
            </div>
            <div className="text-[11px] text-gray-500">按得分从低到高排序</div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {governanceCards.map((g) => {
              const Icon = g.icon;
              const badge = governanceActionBadge(g.score);
              return (
                <div key={g.key} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-lg bg-white border border-gray-200">
                        <Icon className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-gray-800 truncate">{g.label}</div>
                        <div className="text-[11px] text-gray-500 truncate">{g.hint}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-[12px] font-black text-gray-900">{g.score}</div>
                      <div className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 热点与分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col h-[360px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <div className="text-[13px] font-bold text-gray-900">热点字段 Top 10</div>
            </div>
            <button type="button" onClick={() => navigate('/fields')} className="text-[12px] text-indigo-600 hover:text-indigo-700 font-semibold">查看字段</button>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <tbody className="text-[12px]">
                {(safe.top_fields || []).map((f, i) => (
                  <tr
                    key={f.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => openDrawer(f.id, 'fields', f.name)}
                  >
                    <td className="py-2.5 font-mono text-gray-400 w-6">{i + 1}</td>
                    <td className="py-2.5 font-medium text-gray-700 truncate max-w-[140px]" title={f.name}>{f.name}</td>
                    <td className="py-2.5 text-right w-20">
                      <div className="inline-flex items-center px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 font-medium text-[10px]">
                        {formatInt(f.usage)} 引用
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col h-[360px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-indigo-500" />
              <div className="text-[13px] font-bold text-gray-900">热点工作簿 Top 10</div>
            </div>
            <button type="button" onClick={() => navigate('/workbooks')} className="text-[12px] text-indigo-600 hover:text-indigo-700 font-semibold">查看工作簿</button>
          </div>
          <div className="mt-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <tbody className="text-[12px]">
                {(safe.top_workbooks || []).map((w, i) => (
                  <tr
                    key={w.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => openDrawer(w.id, 'workbooks', w.name)}
                  >
                    <td className="py-2.5 font-mono text-gray-400 w-6">{i + 1}</td>
                    <td className="py-2.5 font-medium text-gray-700 truncate max-w-[180px]" title={w.name}>{w.name}</td>
                    <td className="py-2.5 text-right w-20">
                      <div className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium text-[10px]">
                        {formatInt(w.view_count)} 视图
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gray-500" />
              <div className="text-[13px] font-bold text-gray-900">复杂度分布</div>
            </div>
          </div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={complexityData} margin={{ top: 10, right: 8, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="level" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {complexityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {complexityData.map((c) => (
              <div key={c.level} className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                <div className="text-[11px] text-gray-500">{c.level}复杂度</div>
                <div className="mt-1 text-lg font-black text-gray-900">{formatInt(c.value)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 项目与所有者 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              <div className="text-[13px] font-bold text-gray-900">项目资产 Top 10</div>
            </div>
            <button type="button" onClick={() => navigate('/projects')} className="text-[12px] text-indigo-600 hover:text-indigo-700 font-semibold">查看项目</button>
          </div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safe.project_distribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-10} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb' }} />
                <Bar dataKey="datasources" stackId="a" fill="#6366f1" radius={[8, 8, 0, 0]} />
                <Bar dataKey="workbooks" stackId="a" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-600">
            <div className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> 数据源</div>
            <div className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 工作簿</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              <div className="text-[13px] font-bold text-gray-900">所有者资产 Top 10</div>
            </div>
            <button type="button" onClick={() => navigate('/users')} className="text-[12px] text-indigo-600 hover:text-indigo-700 font-semibold">查看用户</button>
          </div>
          <div className="mt-4 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safe.owner_distribution} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} angle={-10} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e5e7eb' }} />
                <Bar dataKey="datasources" stackId="a" fill="#6366f1" radius={[8, 8, 0, 0]} />
                <Bar dataKey="workbooks" stackId="a" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-600">
            <div className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> 数据源</div>
            <div className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> 工作簿</div>
          </div>
        </div>
      </div>
    </div>
  );
}
