'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, type DashboardAnalysis, type SankeyData, type Stats } from '@/lib/api';
import { useDrawer } from '@/lib/drawer-context';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Flame,
  GitBranch,
  LayoutGrid,
  Layers,
  ShieldCheck,
  Sparkles,
  Table,
  TrendingUp,
  Zap
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import ReactECharts from 'echarts-for-react';

type CardTone = 'neutral' | 'good' | 'warn' | 'bad';

const COLORS = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  success: '#10b981',
  successLight: '#34d399',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  danger: '#ef4444',
  dangerLight: '#f87171',
  gray: '#6b7280',
  grayLight: '#9ca3af'
};

function governanceTone(score: number): CardTone {
  return score >= 85 ? 'good' : score >= 70 ? 'warn' : 'bad';
}

function formatInt(value: number) {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatCompact(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return formatInt(value);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl px-4 py-3">
      <p className="text-[12px] font-semibold text-gray-800 mb-1.5">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-[11px]">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold text-gray-900">{formatInt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function OverviewPage() {
  const [data, setData] = useState<DashboardAnalysis | null>(null);
  const [sankeyData, setSankeyData] = useState<SankeyData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { openDrawer } = useDrawer();

  useEffect(() => {
    Promise.all([
      api.getDashboardAnalysis(),
      api.getLineageSankey(30),
      api.getStats()
    ])
      .then(([dashData, sankey, statsData]) => {
        setData(dashData);
        setSankeyData(sankey);
        setStats(statsData);
      })
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
      { key: 'completeness', label: '完整性', score: scores.completeness, icon: FileText, hint: '描述覆盖' },
      { key: 'standardization', label: '规范性', score: scores.standardization, icon: ShieldCheck, hint: '认证标准' },
      { key: 'timeliness', label: '时效性', score: scores.timeliness, icon: Clock, hint: '刷新周期' },
      { key: 'consistency', label: '一致性', score: scores.consistency, icon: GitBranch, hint: '口径统一' },
      { key: 'validity', label: '有效性', score: scores.validity, icon: Award, hint: '资产可用' }
    ];
    return items.slice().sort((a, b) => a.score - b.score);
  }, [scores.completeness, scores.consistency, scores.standardization, scores.timeliness, scores.validity]);

  const healthSummary = useMemo(() => {
    const s = safe.health_score;
    const label = s >= 80 ? '健康良好' : s >= 60 ? '需要关注' : '亟需治理';
    const hint = s >= 80 ? '持续保持标准化与覆盖率' : s >= 60 ? '优先补齐描述与认证' : '优先处理重复指标与停更数据源';
    return { label, hint };
  }, [safe.health_score]);

  const assetCards = useMemo(() => {
    return [
      { key: 'databases', label: '数据库', value: safe.total_assets.databases, icon: Database, href: '/databases', color: '#6366f1' },
      { key: 'tables', label: '数据表', value: safe.total_assets.tables, icon: Table, href: '/tables', color: '#8b5cf6' },
      { key: 'datasources', label: '数据源', value: safe.total_assets.datasources, icon: Boxes, href: '/datasources', color: '#06b6d4' },
      { key: 'workbooks', label: '工作簿', value: safe.total_assets.workbooks, icon: LayoutGrid, href: '/workbooks', color: '#10b981' },
      { key: 'views', label: '视图', value: safe.total_assets.views, icon: BarChart3, href: '/views', color: '#f59e0b' },
      { key: 'fields', label: '原始字段', value: safe.total_assets.fields, icon: Layers, href: '/fields', color: '#ec4899' },
      { key: 'metrics', label: '计算字段', value: safe.total_assets.calculated_fields, icon: Activity, href: '/metrics', color: '#ef4444' }
    ] as const;
  }, [safe.total_assets]);

  const complexityData = useMemo(() => {
    const map = safe.complexity_distribution as Record<string, number>;
    return [
      { name: '低复杂度', value: map.low || 0, fill: COLORS.success },
      { name: '中复杂度', value: map.medium || 0, fill: COLORS.warning },
      { name: '高复杂度', value: map.high || 0, fill: COLORS.danger }
    ];
  }, [safe.complexity_distribution]);

  const totalAssets = useMemo(() => {
    return Object.values(safe.total_assets).reduce((a, b) => a + b, 0);
  }, [safe.total_assets]);

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 lg:px-6 space-y-6 pb-10">
        <div className="h-48 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-80 rounded-2xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <div className="text-center py-20 text-gray-400">加载失败</div>;

  const navigate = (href: string) => router.push(href);

  return (
    <div className="max-w-[1600px] mx-auto px-4 lg:px-6 space-y-6 pb-10">
      {/* Hero: 治理健康度 */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/50" />
        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* 左侧：健康分数 */}
            <div className="flex items-center gap-8">
              <div className="relative">
                <div className="w-32 h-32 lg:w-40 lg:h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="75%"
                      outerRadius="100%"
                      barSize={12}
                      data={[{ value: safe.health_score, fill: healthTone === 'good' ? COLORS.success : healthTone === 'warn' ? COLORS.warning : COLORS.danger }]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar dataKey="value" cornerRadius={10} background={{ fill: '#f3f4f6' }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl lg:text-5xl font-black text-gray-900">{safe.health_score}</span>
                    <span className="text-[11px] text-gray-400 font-medium">/ 100</span>
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">治理健康度</span>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${
                    healthTone === 'good' ? 'bg-emerald-100 text-emerald-700' :
                    healthTone === 'warn' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {healthTone === 'good' ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                     healthTone === 'warn' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                     <Zap className="w-3.5 h-3.5" />}
                    {healthSummary.label}
                  </span>
                </div>
                <p className="mt-2 text-[13px] text-gray-600 max-w-xs">{healthSummary.hint}</p>
                {safe.last_sync?.time && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>同步于 {new Date(safe.last_sync.time).toLocaleString('zh-CN')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：治理维度评分 */}
            <div className="grid grid-cols-5 gap-3 lg:gap-4">
              {governanceCards.map((g) => {
                const Icon = g.icon;
                const tone = governanceTone(g.score);
                return (
                  <div
                    key={g.key}
                    className="relative group bg-gray-50 rounded-xl p-3 lg:p-4 border border-gray-100 hover:border-gray-200 hover:bg-gray-100/50 transition-all cursor-default"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-1.5 rounded-lg ${
                        tone === 'good' ? 'bg-emerald-100' :
                        tone === 'warn' ? 'bg-amber-100' :
                        'bg-red-100'
                      }`}>
                        <Icon className={`w-4 h-4 ${
                          tone === 'good' ? 'text-emerald-600' :
                          tone === 'warn' ? 'text-amber-600' :
                          'text-red-600'
                        }`} />
                      </div>
                      <span className={`text-xl lg:text-2xl font-black ${
                        tone === 'good' ? 'text-emerald-600' :
                        tone === 'warn' ? 'text-amber-600' :
                        'text-red-600'
                      }`}>{g.score}</span>
                    </div>
                    <div className="mt-2">
                      <div className="text-[12px] font-semibold text-gray-900">{g.label}</div>
                      <div className="text-[10px] text-gray-500">{g.hint}</div>
                    </div>
                    <div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          tone === 'good' ? 'bg-emerald-500' :
                          tone === 'warn' ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${g.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 资产全景 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">资产全景</h2>
              <p className="text-[12px] text-gray-500">共 {formatCompact(totalAssets)} 个元数据资产</p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 lg:gap-4">
          {assetCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                onClick={() => navigate(card.href)}
                className="group relative text-left bg-gradient-to-br from-gray-50 to-white hover:from-white hover:to-gray-50 border border-gray-100 hover:border-gray-200 rounded-xl p-4 transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="p-2 rounded-lg transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${card.color}15` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: card.color }} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-black text-gray-900">{formatCompact(card.value)}</div>
                  <div className="text-[12px] font-medium text-gray-500">{card.label}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 详细资产分布 - 嵌入式/去重统计 */}
      {sankeyData?.stats && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">资产明细分布</h2>
              <p className="text-[12px] text-gray-500">包含嵌入式资产、去重统计、活跃/僵尸资产分类</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 表统计 */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Table className="w-4 h-4 text-gray-600" />
                <span className="text-[13px] font-bold text-gray-900">数据表</span>
                <span className="ml-auto text-[11px] text-gray-400">{sankeyData.stats.tables.total} 总计</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />非嵌入式表
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{sankeyData.stats.tables.normal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />嵌入式表
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{sankeyData.stats.tables.embedded}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />孤立表
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{sankeyData.stats.tables.orphan}</span>
                </div>
              </div>
            </div>

            {/* 数据源统计 */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Boxes className="w-4 h-4 text-gray-600" />
                <span className="text-[13px] font-bold text-gray-900">数据源</span>
                <span className="ml-auto text-[11px] text-gray-400">{sankeyData.stats.datasources.total} 总计</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />正常发布
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{sankeyData.stats.datasources.normal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />嵌入式(引用)
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{sankeyData.stats.datasources.embedded_ref}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />嵌入式(直连)
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{sankeyData.stats.datasources.embedded_direct}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />CustomSQL
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{sankeyData.stats.datasources.custom_sql}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" />孤立数据源
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{sankeyData.stats.datasources.orphan}</span>
                </div>
              </div>
            </div>

            {/* 字段统计 */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-4 h-4 text-gray-600" />
                <span className="text-[13px] font-bold text-gray-900">原生字段</span>
                <span className="ml-auto text-[11px] text-gray-400">{sankeyData.stats.fields.total.toLocaleString()} 总计</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />去重后
                  </span>
                  <span className="text-[12px] font-semibold text-blue-600">{stats?.uniqueFields?.toLocaleString() || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />冗余字段
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{((sankeyData.stats.fields.total || 0) - (stats?.uniqueFields || 0)).toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                按字段名去重，跨数据源复用
              </div>
            </div>

            {/* 计算字段统计 */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-gray-600" />
                <span className="text-[13px] font-bold text-gray-900">计算字段</span>
                <span className="ml-auto text-[11px] text-gray-400">{sankeyData.stats.calculated_fields.total.toLocaleString()} 总计</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />去重后
                  </span>
                  <span className="text-[12px] font-semibold text-purple-600">{stats?.uniqueMetrics?.toLocaleString() || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />重复公式
                  </span>
                  <span className="text-[12px] font-semibold text-gray-900">{safe.issues.duplicate_formulas.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                按公式内容去重，识别重复逻辑
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 分析洞察区：3列布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 项目资产分布 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50">
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-[13px] font-bold text-gray-900">项目分布</span>
            </div>
            <span className="text-[11px] text-gray-400">Top 5</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-3 ml-8">各项目下的数据源和工作簿资产数量</p>
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={safe.project_distribution.slice(0, 5).map((p: { name: string; datasources: number; workbooks: number }) => ({
                  name: p.name.length > 4 ? p.name.slice(0, 4) + '..' : p.name,
                  fullName: p.name,
                  数据源: p.datasources,
                  工作簿: p.workbooks
                }))} 
                margin={{ top: 5, right: 5, left: -15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg px-3 py-2">
                          <div className="text-[12px] font-semibold text-gray-900 mb-1">{data.fullName}</div>
                          <div className="text-[11px] text-gray-600">数据源: {data.数据源}</div>
                          <div className="text-[11px] text-gray-600">工作簿: {data.工作簿}</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="数据源" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="工作簿" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-600">数据源</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-gray-600">工作簿</span>
            </div>
          </div>
        </div>

        {/* 公式复杂度分析 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-50">
                <Activity className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-[13px] font-bold text-gray-900">复杂度分布</span>
            </div>
            <span className="text-[11px] text-gray-400">计算字段</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-2 ml-8">按公式嵌套层级划分的计算字段复杂度</p>
          <div className="flex items-center gap-4">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={complexityData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {complexityData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {complexityData.map((c) => (
                <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.fill }} />
                    <span className="text-[11px] text-gray-600">{c.name.replace('复杂度', '')}</span>
                  </div>
                  <span className="text-[13px] font-bold" style={{ color: c.fill }}>{formatCompact(c.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 字段角色分布 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-50">
                <LayoutGrid className="w-4 h-4 text-cyan-600" />
              </div>
              <span className="text-[13px] font-bold text-gray-900">字段角色</span>
            </div>
            <span className="text-[11px] text-gray-400">建模规范</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-2 ml-8">维度与度量的分类反映数据建模规范程度</p>
          <div className="flex items-center gap-4">
            <div className="h-[140px] w-[140px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: '维度', value: (safe.role_distribution as Record<string, number>)['dimension'] || 0, fill: '#3b82f6' },
                      { name: '度量', value: (safe.role_distribution as Record<string, number>)['measure'] || 0, fill: '#10b981' },
                      { name: '未分类', value: (safe.role_distribution as Record<string, number>)['unknown'] || 0, fill: '#9ca3af' }
                    ].filter(x => x.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {[
                      { fill: '#3b82f6' },
                      { fill: '#10b981' },
                      { fill: '#9ca3af' }
                    ].map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-blue-50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[11px] text-gray-700">维度</span>
                </div>
                <span className="text-[13px] font-bold text-blue-600">{formatCompact((safe.role_distribution as Record<string, number>)['dimension'] || 0)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-gray-700">度量</span>
                </div>
                <span className="text-[13px] font-bold text-emerald-600">{formatCompact((safe.role_distribution as Record<string, number>)['measure'] || 0)}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-gray-100">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                  <span className="text-[11px] text-gray-700">未分类</span>
                </div>
                <span className="text-[13px] font-bold text-gray-600">{formatCompact((safe.role_distribution as Record<string, number>)['unknown'] || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 行动中心 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-orange-600">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">行动中心</h2>
              <p className="text-[12px] text-gray-500">按治理优先级排序，建议从高优先级开始</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 高优先级 */}
          <div className="rounded-xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-red-100">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-[12px] font-bold text-red-700">高优先级</span>
              <span className="ml-auto text-[10px] text-red-500">治理风险</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/metrics?sort=duplicate_count&order=desc')}
                className="w-full group flex items-center justify-between p-3 rounded-lg bg-white/80 hover:bg-white border border-red-100 hover:border-red-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-red-500" />
                  <span className="text-[13px] font-medium text-gray-800">重复公式</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">{formatInt(safe.issues.duplicate_formulas)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
              <button
                onClick={() => navigate('/datasources?sort=extract_last_update_time&order=asc')}
                className="w-full group flex items-center justify-between p-3 rounded-lg bg-white/80 hover:bg-white border border-red-100 hover:border-red-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-500" />
                  <span className="text-[13px] font-medium text-gray-800">停更数据源</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">{formatInt(safe.issues.stale_datasources)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            </div>
          </div>

          {/* 中优先级 */}
          <div className="rounded-xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-100">
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-[12px] font-bold text-amber-700">中优先级</span>
              <span className="ml-auto text-[10px] text-amber-500">提升理解</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/fields?sort=description&order=asc')}
                className="w-full group flex items-center justify-between p-3 rounded-lg bg-white/80 hover:bg-white border border-amber-100 hover:border-amber-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span className="text-[13px] font-medium text-gray-800">缺失字段描述</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">{formatCompact(safe.issues.missing_description)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
              <button
                onClick={() => navigate('/tables?filter=orphan')}
                className="w-full group flex items-center justify-between p-3 rounded-lg bg-white/80 hover:bg-white border border-amber-100 hover:border-amber-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <Table className="w-4 h-4 text-amber-600" />
                  <span className="text-[13px] font-medium text-gray-800">孤立表</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">{formatInt(safe.issues.orphaned_tables)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            </div>
          </div>

          {/* 低优先级 */}
          <div className="rounded-xl bg-gradient-to-br from-gray-50 to-slate-50 border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-gray-100">
                <CheckCircle2 className="w-4 h-4 text-gray-600" />
              </div>
              <span className="text-[12px] font-bold text-gray-700">低优先级</span>
              <span className="ml-auto text-[10px] text-gray-400">持续优化</span>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/metrics?sort=description&order=asc')}
                className="w-full group flex items-center justify-between p-3 rounded-lg bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-gray-500" />
                  <span className="text-[13px] font-medium text-gray-800">缺失指标描述</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">{formatCompact(safe.issues.calc_field_no_desc)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
              <button
                onClick={() => navigate('/datasources?filter=uncertified')}
                className="w-full group flex items-center justify-between p-3 rounded-lg bg-white/80 hover:bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-gray-500" />
                  <span className="text-[13px] font-medium text-gray-800">未认证数据源</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">{formatInt(safe.uncertified_datasources)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 热点资产 & 分布分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 热点字段 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-50">
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <span className="text-[13px] font-bold text-gray-900">热点字段 Top 10</span>
            </div>
            <button onClick={() => navigate('/fields')} className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
              查看全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 custom-scrollbar">
            <div className="space-y-1">
              {(safe.top_fields || []).map((f, i) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                  onClick={() => openDrawer(f.id, 'fields', f.name)}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    i < 3 ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>{i + 1}</span>
                  <span className="flex-1 text-[13px] font-medium text-gray-700 truncate group-hover:text-gray-900" title={f.name}>{f.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600">{formatCompact(f.usage)} 引用</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 热点工作簿 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50">
                <LayoutGrid className="w-4 h-4 text-indigo-500" />
              </div>
              <span className="text-[13px] font-bold text-gray-900">热点工作簿 Top 10</span>
            </div>
            <button onClick={() => navigate('/workbooks')} className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
              查看全部 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 custom-scrollbar">
            <div className="space-y-1">
              {(safe.top_workbooks || []).map((w, i) => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group"
                  onClick={() => openDrawer(w.id, 'workbooks', w.name)}
                >
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    i < 3 ? 'bg-gradient-to-br from-indigo-400 to-purple-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>{i + 1}</span>
                  <span className="flex-1 text-[13px] font-medium text-gray-700 truncate group-hover:text-gray-900" title={w.name}>{w.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600">{formatInt(w.view_count)} 视图</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 项目分布 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-50">
                <Building2 className="w-4 h-4 text-blue-500" />
              </div>
              <span className="text-[13px] font-bold text-gray-900">项目资产分布</span>
            </div>
            <button onClick={() => navigate('/projects')} className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1">
              查看项目 <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={safe.project_distribution.slice(0, 8)} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                <defs>
                  <linearGradient id="projectDs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="projectWb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="datasources" name="数据源" stroke={COLORS.primary} fillOpacity={1} fill="url(#projectDs)" strokeWidth={2} />
                <Area type="monotone" dataKey="workbooks" name="工作簿" stroke={COLORS.success} fillOpacity={1} fill="url(#projectWb)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-4">
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.primary }} />
              <span className="text-gray-600">数据源</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.success }} />
              <span className="text-gray-600">工作簿</span>
            </div>
          </div>
        </div>
      </div>

      {/* 血缘桑基图 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600">
              <GitBranch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">数据资产血缘流向</h2>
              <p className="text-[12px] text-gray-500">
                展示数据从物理层到展示层的完整血缘链路
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#3b82f6' }} />正常</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#a855f7' }} />嵌入式</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#f43f5e' }} />孤立/僵尸</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: '#f59e0b' }} />CustomSQL</span>
            </div>
          </div>
        </div>
        <div className="h-[600px]">
          {sankeyData && sankeyData.nodes.length > 0 && sankeyData.links.length > 0 ? (
            <ReactECharts
              style={{ height: '100%', width: '100%' }}
              option={{
                tooltip: {
                  trigger: 'item',
                  triggerOn: 'mousemove',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  borderColor: '#e2e8f0',
                  borderWidth: 1,
                  padding: [12, 16],
                  textStyle: {
                    color: '#334155',
                    fontSize: 13
                  },
                  extraCssText: 'box-shadow: 0 4px 20px rgba(0,0,0,0.15); border-radius: 8px;'
                },
                series: [
                  {
                    type: 'sankey',
                    data: sankeyData.nodes.map(n => ({
                      name: n.name,
                      itemStyle: n.itemStyle,
                      depth: n.depth
                    })),
                    links: sankeyData.links.map(l => ({
                      source: sankeyData.nodes[l.source]?.name || '',
                      target: sankeyData.nodes[l.target]?.name || '',
                      value: l.value
                    })),
                    top: 40,
                    bottom: 40,
                    left: 60,
                    right: 200,
                    nodeWidth: 18,
                    nodeGap: 24,
                    emphasis: {
                      focus: 'adjacency',
                      itemStyle: {
                        shadowBlur: 20,
                        shadowColor: 'rgba(0,0,0,0.3)'
                      }
                    },
                    nodeAlign: 'left',
                    layoutIterations: 64,
                    lineStyle: {
                      color: 'gradient',
                      curveness: 0.5,
                      opacity: 0.4
                    },
                    label: {
                      position: 'right',
                      color: '#334155',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fontSize: 12,
                      fontWeight: 500,
                      padding: [0, 0, 0, 8],
                      formatter: (params: { name: string }) => params.name
                    },
                    itemStyle: {
                      borderRadius: 4,
                      borderWidth: 0
                    }
                  }
                ]
              }}
              onEvents={{
                click: (params: { dataType: string; name: string }) => {
                  if (params.dataType === 'node') {
                    const name = params.name;
                    if (name.includes('数据库')) navigate('/databases');
                    else if (name.includes('表')) navigate('/tables');
                    else if (name.includes('数据源')) navigate('/datasources');
                    else if (name.includes('原生字段')) navigate('/fields');
                    else if (name.includes('计算字段')) navigate('/metrics');
                    else if (name.includes('工作簿')) navigate('/workbooks');
                    else if (name.includes('视图')) navigate('/views');
                  }
                }
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              暂无血缘数据，请先完成数据同步
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
