// 全局状态
const state = {
    activeModule: 'overview',
    data: [],
    filteredData: [],
    facets: {},
    activeFilters: {},
    searchTerm: '',
    stats: {},
    sortOption: '',
    sortOrder: 'desc'
};

const api = {
    get: async (url) => {
        try {
            const res = await fetch(`/api${url}`);
            if (!res.ok) throw new Error(res.statusText);
            return await res.json();
        } catch (e) {
            console.error("API Error", e);
            return [];
        }
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await updateGlobalStats();
    switchModule('overview');
});

async function switchModule(moduleName) {
    state.activeModule = moduleName;
    state.searchTerm = '';
    state.activeFilters = {};
    state.sortOption = '';

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('onclick')?.includes(moduleName)) item.classList.add('active');
    });

    document.getElementById('main-content').innerHTML = `<div class="loading"><i data-lucide="loader-2" class="spin"></i></div>`;
    lucide.createIcons();

    if (moduleName === 'overview') {
        renderOverview();
        document.getElementById('filter-section').style.display = 'none';
    } else {
        document.getElementById('filter-section').style.display = 'block';
        await loadModuleData(moduleName);
    }
    await updateGlobalStats();
}

async function loadModuleData(module) {
    let url = `/${module}`;
    if (state.sortOption) url += `?sort=${state.sortOption}&order=${state.sortOrder}`;
    state.data = await api.get(url);
    applyFilters();
}

async function handleSortChange(sortKey) {
    state.sortOption = state.sortOption === sortKey ? (state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc', sortKey) : (state.sortOrder = 'desc', sortKey);
    await loadModuleData(state.activeModule);
}

function applyFilters() {
    let result = state.data;
    if (state.searchTerm) {
        const t = state.searchTerm.toLowerCase();
        result = result.filter(i => i.name?.toLowerCase().includes(t) || i.description?.toLowerCase().includes(t) || i.formula?.toLowerCase().includes(t));
    }
    for (const [k, v] of Object.entries(state.activeFilters)) {
        if (v.length) result = result.filter(i => v.includes(String(i[k])));
    }
    state.filteredData = result;
    calculateFacets(result);
    renderList();
    renderFacets();
}

function calculateFacets(data) {
    const cfg = { databases: ['connection_type'], tables: ['schema'], fields: ['role', 'data_type'], datasources: ['is_certified'], metrics: ['role'] };
    const keys = cfg[state.activeModule] || [];
    state.facets = {};
    keys.forEach(k => {
        state.facets[k] = {};
        data.forEach(i => { if (i[k] != null) state.facets[k][String(i[k])] = (state.facets[k][String(i[k])] || 0) + 1; });
    });
}

// ===================== 核心渲染 =====================
function renderList() {
    const c = document.getElementById('main-content');
    const n = state.filteredData.length;
    const t = state.activeModule;
    const titles = { databases: '数据库', tables: '数据表', fields: '字段字典', metrics: '指标库', datasources: '数据源', workbooks: '工作簿' };

    // 排序按钮
    const sortCfg = { fields: ['usageCount:热度', 'name:名称'], metrics: ['complexity:复杂度', 'referenceCount:引用'], tables: ['field_count:字段数'] };
    const sortBtns = (sortCfg[t] || []).map(s => {
        const [k, l] = s.split(':');
        const active = state.sortOption === k;
        return `<button onclick="handleSortChange('${k}')" class="sort-btn ${active ? 'active' : ''}">${l}${active ? (state.sortOrder === 'desc' ? '↓' : '↑') : ''}</button>`;
    }).join('');

    c.innerHTML = `
        <div class="page-header">
            <h1>${titles[t] || t}</h1>
            <span class="count">${n} 项</span>
            ${sortBtns ? `<div class="sort-bar">${sortBtns}</div>` : ''}
        </div>
        ${n === 0 ? '<div class="empty">无数据</div>' : getModuleContent(t)}
    `;
    lucide.createIcons();
}

function getModuleContent(t) {
    switch (t) {
        case 'databases': return renderDBTable();
        case 'tables': return renderTablesTable();
        case 'fields': return renderFieldsTable();
        case 'metrics': return renderMetricsTable();
        case 'datasources': return renderDSTable();
        case 'workbooks': return renderWBTable();
        default: return '';
    }
}

// ===================== 数据库表格 =====================
function renderDBTable() {
    return `<table class="data-table">
        <thead><tr><th>名称</th><th>类型</th><th>表数量</th><th>主机</th><th>状态</th></tr></thead>
        <tbody>${state.filteredData.map(i => `
            <tr onclick="showDetail('${i.id}','databases')">
                <td><div class="cell-main"><i data-lucide="database" class="icon db"></i><span class="name">${i.name}</span></div></td>
                <td><span class="tag type">${i.type || '-'}</span></td>
                <td class="num">${i.table_count || i.tables || 0}</td>
                <td class="muted">${i.host || i.id?.substring(0, 8) || '-'}</td>
                <td>${(i.table_count || i.tables) ? '<span class="status ok">●</span>' : '<span class="status warn">●</span>'}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

// ===================== 数据表表格 =====================
function renderTablesTable() {
    return `<table class="data-table">
        <thead><tr><th>表名</th><th>数据库</th><th>Schema</th><th>字段数</th><th>连接</th><th>预览字段</th></tr></thead>
        <tbody>${state.filteredData.map(i => {
        const fc = i.field_count || i.fieldCount || 0;
        const pf = i.preview_fields || {};
        const preview = [...(pf.measures || []).slice(0, 2).map(f => `<span class="tag measure">#${f}</span>`), ...(pf.dimensions || []).slice(0, 2).map(f => `<span class="tag dim">Abc ${f}</span>`)].join('');
        return `
            <tr onclick="showDetail('${i.id}','tables')">
                <td><div class="cell-main"><i data-lucide="table-2" class="icon tbl"></i><span class="name">${i.name}</span>${i.isEmbedded ? '<span class="tag warn">嵌入</span>' : ''}</div></td>
                <td class="muted">${i.databaseName || '-'}</td>
                <td><span class="tag schema">${i.schema || 'public'}</span></td>
                <td class="num">${fc}</td>
                <td class="muted">${i.connectionType || '-'}</td>
                <td class="preview">${preview || '-'}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 字段表格 - 超密集 =====================
function renderFieldsTable() {
    return `<table class="data-table compact">
        <thead>
            <tr>
                <th style="width: 25%">字段名称</th>
                <th style="width: 10%">类型</th>
                <th style="width: 15%">来源表/数据源</th>
                <th style="width: 8%">热度</th>
                <th style="width: 25%">指标依赖 (影响分析)</th>
                <th style="width: 17%">视图引用 (影响分析)</th>
            </tr>
        </thead>
        <tbody>${state.filteredData.map(i => {
        const m = i.role === 'measure';
        const u = i.usageCount || 0;
        const metrics = i.used_by_metrics || [];
        const views = i.used_in_views || [];

        // 构建指标依赖显示的 HTML (只显示前2个，超出的显示数量)
        const metricBadges = metrics.length ?
            `<div class="flex flex-wrap gap-1">
                    ${metrics.slice(0, 2).map(m => `<span class="tag calc clickable" onclick="event.stopPropagation(); showDetail('${m.id}', 'metrics')">${m.name}</span>`).join('')}
                    ${metrics.length > 2 ? `<span class="tag text-gray-400">+${metrics.length - 2}</span>` : ''}
                </div>` : '<span class="text-gray-300">-</span>';

        // 构建视图引用显示的 HTML
        const viewBadges = views.length ?
            `<div class="flex items-center gap-1">
                    <span class="num font-medium text-gray-700">${views.length}</span>
                    <span class="text-[10px] text-gray-400">个视图</span>
                </div>` : '<span class="text-gray-300">-</span>';

        return `
            <tr onclick="showDetail('${i.id}','fields')">
                <td>
                    <div class="cell-main">
                        <span class="dot ${m ? 'measure' : 'dim'}"></span>
                        <div class="flex flex-col min-w-0">
                            <span class="name text-[13px]">${i.name}</span>
                            ${i.isCalculated ? '<span class="text-[10px] text-purple-500 font-mono flex items-center gap-1">fx <span class="truncate max-w-[150px] text-gray-400 inline-block align-bottom" title="' + (i.formula || '') + '">' + (i.formula || '') + '</span></span>' : ''}
                        </div>
                    </div>
                </td>
                <td><span class="font-mono text-[11px] text-gray-500">${i.dataType || '-'}</span></td>
                <td>
                    <div class="flex flex-col">
                        <span class="text-[12px] text-gray-700 truncate" title="${i.table || i.datasource || ''}">${i.table || i.datasource || '-'}</span>
                    </div>
                </td>
                <td class="num ${u > 10 ? 'text-orange-600 font-bold' : ''}">${u}</td>
                <td>${metricBadges}</td>
                <td>${viewBadges}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 指标表格 =====================
function renderMetricsTable() {
    return `<table class="data-table">
        <thead>
            <tr>
                <th style="width: 25%">指标名称</th>
                <th style="width: 8%">复杂度</th>
                <th style="width: 25%">计算逻辑 (公式)</th>
                <th style="width: 15%">依赖字段</th>
                <th style="width: 12%">重复风险</th>
                <th style="width: 15%">数据源</th>
            </tr>
        </thead>
        <tbody>${state.filteredData.map(i => {
        const cx = i.complexity || 0;
        const dups = i.similarMetrics || [];
        const deps = i.dependencyFields || [];
        const hasDup = dups.length > 0;

        return `
            <tr onclick="showDetail('${i.id}','metrics')">
                <td>
                    <div class="cell-main">
                        <i data-lucide="function-square" class="icon metric"></i>
                        <span class="name text-[13px]">${i.name}</span>
                    </div>
                </td>
                <td>
                    <div class="flex items-center gap-1">
                        <div class="h-1.5 w-8 bg-gray-100 rounded-full overflow-hidden">
                            <div class="h-full ${cx > 10 ? 'bg-red-500' : cx > 4 ? 'bg-orange-400' : 'bg-green-500'}" style="width: ${Math.min(cx * 10, 100)}%"></div>
                        </div>
                        <span class="num text-[10px]">${cx}</span>
                    </div>
                </td>
                <td class="font-mono text-[11px] text-gray-500">
                    <div class="truncate max-w-[200px]" title="${i.formula || ''}">${i.formula || '-'}</div>
                </td>
                <td>
                    <div class="flex -space-x-1 overflow-hidden">
                        ${deps.slice(0, 4).map(d => `<span class="w-4 h-4 rounded-full bg-blue-100 border border-white flex items-center justify-center text-[8px] text-blue-600" title="${d.name}">${d.name[0]}</span>`).join('')}
                        ${deps.length > 4 ? `<span class="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center text-[8px] text-gray-500">+${deps.length - 4}</span>` : ''}
                    </div>
                </td>
                <td>
                    ${hasDup ?
                `<span class="tag error flex items-center gap-1 clickable" onclick="event.stopPropagation(); showDetail('${i.id}', 'metrics')">
                            <i data-lucide="alert-triangle" class="w-3 h-3"></i> ${dups.length} 重复
                        </span>` :
                '<span class="status ok text-gray-300">● 正常</span>'}
                </td>
                <td class="muted truncate" title="${i.datasourceName}">${i.datasourceName || '-'}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 数据源表格 =====================
function renderDSTable() {
    return `<table class="data-table">
        <thead><tr><th>数据源</th><th>项目</th><th>所有者</th><th>表数</th><th>类型</th><th>认证</th><th>刷新状态</th></tr></thead>
        <tbody>${state.filteredData.map(i => {
        const live = !i.hasExtract;
        let stale = 0;
        if (i.hasExtract && i.lastRefresh) stale = Math.floor((new Date() - new Date(i.lastRefresh)) / 86400000);
        return `
            <tr onclick="showDetail('${i.id}','datasources')">
                <td><div class="cell-main"><i data-lucide="layers" class="icon ds"></i><span class="name">${i.name}</span></div></td>
                <td class="muted">${i.projectName || '-'}</td>
                <td class="muted">${i.owner || '-'}</td>
                <td class="num">${i.tableCount || 0}</td>
                <td><span class="tag ${live ? 'live' : 'extract'}">${live ? 'Live' : 'Extract'}</span></td>
                <td>${i.isCertified ? '<span class="tag cert">✓</span>' : '-'}</td>
                <td>${stale > 30 ? `<span class="tag error">停更${stale}天</span>` : stale > 7 ? `<span class="tag warn">${stale}天</span>` : '<span class="status ok">●</span>'}</td>
            </tr>`;
    }).join('')}
        </tbody>
    </table>`;
}

// ===================== 工作簿表格 =====================
function renderWBTable() {
    return `<table class="data-table">
        <thead><tr><th>工作簿</th><th>项目</th><th>所有者</th><th>视图数</th></tr></thead>
        <tbody>${state.filteredData.map(i => `
            <tr onclick="showDetail('${i.id}','workbooks')">
                <td><div class="cell-main"><i data-lucide="book-open" class="icon wb"></i><span class="name">${i.name}</span></div></td>
                <td class="muted">${i.projectName || '-'}</td>
                <td class="muted">${i.owner || '-'}</td>
                <td class="num">${i.viewCount || 0}</td>
            </tr>`).join('')}
        </tbody>
    </table>`;
}

// ===================== Facets =====================
function renderFacets() {
    const c = document.getElementById('dynamic-filters');
    const labels = { connection_type: '连接类型', role: '角色', is_certified: '认证', data_type: '类型', schema: 'Schema', measure: '度量', dimension: '维度', 'true': '是', 'false': '否' };
    c.innerHTML = Object.entries(state.facets).filter(([, v]) => Object.keys(v).length).map(([k, counts]) => `
        <div class="facet-group">
            <div class="facet-title">${labels[k] || k}</div>
            ${Object.entries(counts).map(([val, cnt]) => `
                <label class="facet-item">
                    <input type="checkbox" onchange="toggleFilter('${k}','${val}')" ${state.activeFilters[k]?.includes(val) ? 'checked' : ''}>
                    <span>${labels[val] || val}</span><span class="cnt">${cnt}</span>
                </label>`).join('')}
        </div>`).join('');
}

function toggleFilter(k, v) {
    if (!state.activeFilters[k]) state.activeFilters[k] = [];
    const i = state.activeFilters[k].indexOf(v);
    i > -1 ? state.activeFilters[k].splice(i, 1) : state.activeFilters[k].push(v);
    applyFilters();
}

// ===================== 概览 =====================
async function renderOverview() {
    const c = document.getElementById('main-content');
    try {
        const d = await api.get('/dashboard/analysis');
        const hc = d.health_score >= 80 ? 'good' : d.health_score >= 60 ? 'warn' : 'bad';
        c.innerHTML = `
            <div class="page-header"><h1>治理概览</h1></div>
            <div class="overview-grid">
                <div class="card score ${hc}">
                    <div class="label">健康分</div>
                    <div class="value">${d.health_score}</div>
                    <div class="bar"><div style="width:${d.health_score}%"></div></div>
                </div>
                <div class="card issues">
                    <div class="label">问题检测</div>
                    <div class="issue-row"><span>停更数据源</span><span class="${d.issues.stale_datasources ? 'bad' : ''}">${d.issues.stale_datasources}</span></div>
                    <div class="issue-row"><span>重复指标</span><span class="${d.issues.duplicate_metrics ? 'warn' : ''}">${d.issues.duplicate_metrics}</span></div>
                    <div class="issue-row"><span>缺失描述</span><span class="${d.issues.missing_description ? 'info' : ''}">${d.issues.missing_description}</span></div>
                </div>
                <div class="card stats">
                    <div class="label">资产统计</div>
                    <div class="stat-grid">
                        <div><span class="num">${state.stats.fields || 0}</span><span>字段</span></div>
                        <div><span class="num">${state.stats.tables || 0}</span><span>表</span></div>
                        <div><span class="num">${state.stats.metrics || 0}</span><span>指标</span></div>
                        <div class="total"><span class="num">${d.total_assets}</span><span>总计</span></div>
                    </div>
                </div>
                <div class="card hotlist">
                    <div class="label">热点资产 Top10</div>
                    <table class="mini-table">
                        <thead><tr><th>#</th><th>字段</th><th>来源</th><th>引用</th></tr></thead>
                        <tbody>${d.top_fields.map((f, i) => `<tr><td>${i + 1}</td><td>${f.name}</td><td>${f.table}</td><td class="num">${f.usage}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>`;
        lucide.createIcons();
    } catch (e) { c.innerHTML = '<div class="empty">加载失败</div>'; }
}

// ===================== 详情抽屉 (系统性分析核心) =====================
async function showDetail(id, type) {
    const drawer = document.getElementById('detail-drawer');
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('drawer-title');
    const content = document.getElementById('drawer-content');

    drawer.classList.add('open');
    overlay.classList.add('active');

    // 如果是切换，先清理
    content.innerHTML = '<div class="loading py-10 flex justify-center"><i data-lucide="loader-2" class="spin w-6 h-6 text-indigo-500"></i></div>';
    lucide.createIcons();

    // 数据获取
    let item = state.data.find(i => i.id == id);
    // 如果数据不在当前列表（比如从字段跳转到指标），需要单独 fetch
    if (!item) {
        try {
            item = await api.get(`/${type}/${id}`);
            // 兼容 metrics 列表接口返回的是 list，这里模拟单个 fetch
            if (Array.isArray(item)) item = item.find(i => i.id == id);
            // 如果后端没有单查接口 (如 metrics)，可能要遍历全量，这里假设列表已加载或后端支持 id 查询
            // 现在的 API 在 metrics 上不支持单查，我们临时处理一下：
            if (type === 'metrics' && !item) {
                const allMetrics = await api.get('/metrics');
                item = allMetrics.find(m => m.id == id);
            }
        } catch (e) { console.error(e); }
    }

    if (!item) { content.innerHTML = '<div class="text-center text-gray-400 py-8">未找到数据</div>'; return; }

    title.innerHTML = `<div class="flex flex-col">
        <span>${item.name}</span>
        <span class="text-[10px] font-normal text-gray-400 uppercase tracking-wide mt-0.5">${getModuleName(type)} 详情</span>
    </div>`;

    let html = `<div class="space-y-6">`;

    // 1. 基本属性卡片
    html += `
    <div class="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
        <h3 class="text-[12px] font-bold text-gray-900 mb-3 flex items-center gap-2">
            <i data-lucide="info" class="w-3.5 h-3.5 text-indigo-500"></i> 基本信息
        </h3>
        <div class="grid grid-cols-2 gap-y-3 gap-x-4">
            ${renderPropRow('ID', item.id, true)}
            ${renderPropRow('类型', item.dataType || item.type)}
            ${renderPropRow('所有者', item.owner)}
            ${renderPropRow('数据源', item.datasourceName || item.datasource)}
            ${item.formula ? `<div class="col-span-2">
                <div class="text-[10px] text-gray-400 mb-1">计算公式</div>
                <div class="bg-gray-50 rounded p-2 font-mono text-[11px] text-gray-700 break-all border border-gray-100">${item.formula}</div>
            </div>` : ''}
            ${item.description ? `<div class="col-span-2">
                <div class="text-[10px] text-gray-400 mb-1">描述</div>
                <p class="text-[12px] text-gray-600">${item.description}</p>
            </div>` : ''}
        </div>
    </div>`;

    // 2. 关联分析 (针对字段)
    if (type === 'fields') {
        const metrics = item.used_by_metrics || [];
        const views = item.used_in_views || [];

        // 指标影响
        if (metrics.length) {
            html += `
            <div class="bg-indigo-50 rounded-lg border border-indigo-100 p-4">
                <h3 class="text-[12px] font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <i data-lucide="function-square" class="w-3.5 h-3.5 text-indigo-600"></i> 
                    影响的指标 (${metrics.length})
                </h3>
                <div class="space-y-2">
                    ${metrics.map(m => `
                        <div class="flex items-center justify-between bg-white p-2 rounded border border-indigo-100 cursor-pointer hover:border-indigo-300 transition-colors"
                             onclick="showDetail('${m.id}', 'metrics')">
                            <span class="text-[12px] text-gray-700 font-medium">${m.name}</span>
                            <i data-lucide="chevron-right" class="w-3 h-3 text-gray-400"></i>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }

        // 视图影响
        if (views.length) {
            html += `
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-[12px] font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <i data-lucide="layout" class="w-3.5 h-3.5 text-gray-500"></i> 
                    使用的视图 (${views.length})
                </h3>
                <div class="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                    ${views.map(v => `
                        <div class="flex items-center justify-between text-[12px] py-1 border-b border-gray-50 last:border-0">
                            <span class="text-gray-600 truncate">${v.workbookName} / ${v.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>`;
        }
    }

    // 3. 重复分析 (针对指标)
    if (type === 'metrics') {
        const dups = item.similarMetrics || [];
        const deps = item.dependencyFields || [];
        const views = item.usedInViews || [];

        // 依赖字段
        if (deps.length) {
            html += `
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-[12px] font-bold text-gray-900 mb-3">依赖基础字段 (${deps.length})</h3>
                <div class="flex flex-wrap gap-2">
                    ${deps.map(d => `
                        <span class="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[11px] border border-blue-100 cursor-pointer hover:bg-blue-100"
                              onclick="${d.id ? `showDetail('${d.id}', 'fields')` : ''}">
                            <i data-lucide="columns" class="w-3 h-3 inline mr-1 align-text-top"></i>${d.name}
                        </span>
                    `).join('')}
                </div>
            </div>`;
        }

        // 重复指标警告
        if (dups.length) {
            html += `
            <div class="bg-red-50 rounded-lg border border-red-100 p-4 animate-pulse-once">
                <div class="flex items-start gap-3">
                    <i data-lucide="alert-triangle" class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"></i>
                    <div class="flex-1">
                        <h3 class="text-[13px] font-bold text-red-800 mb-1">发现重复定义的指标</h3>
                        <p class="text-[11px] text-red-600 mb-3">以下 ${dups.length} 个指标使用了完全相同的计算公式：</p>
                        <div class="space-y-2">
                            ${dups.map(d => `
                                <div class="bg-white/60 p-2 rounded border border-red-100 flex flex-col gap-1 cursor-pointer hover:bg-white"
                                     onclick="showDetail('${d.id}', 'metrics')">
                                    <div class="flex justify-between items-center">
                                        <span class="text-[12px] font-bold text-red-900">${d.name}</span>
                                        <span class="text-[10px] text-red-400 bg-red-100 px-1.5 rounded">ID: ${d.id.substring(0, 6)}</span>
                                    </div>
                                    <div class="text-[10px] text-gray-500">数据源: ${d.datasourceName || '-'}</div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="mt-3 flex gap-2">
                            <button class="flex-1 py-1.5 bg-red-600 text-white text-[11px] rounded hover:bg-red-700 transition-colors">合并指标</button>
                            <button class="flex-1 py-1.5 bg-white text-red-600 border border-red-200 text-[11px] rounded hover:bg-red-50 transition-colors">标记废弃</button>
                        </div>
                    </div>
                </div>
            </div>`;
        }

        // 所在报表 (Impact)
        if (views.length) {
            html += `
            <div class="bg-white rounded-lg border border-gray-200 p-4">
                <h3 class="text-[12px] font-bold text-gray-900 mb-3">应用报表 (${views.length})</h3>
                <ul class="list-disc pl-4 space-y-1">
                    ${views.map(v => `<li class="text-[12px] text-gray-600">${v.workbookName} / <span class="font-medium text-gray-800">${v.name}</span></li>`).join('')}
                </ul>
            </div>`;
        }
    }

    html += `</div>`;
    content.innerHTML = html;
    lucide.createIcons();
}

function closeDrawer() {
    document.getElementById('detail-drawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
}

function getModuleName(type) {
    const titles = { databases: '数据库', tables: '数据表', fields: '字段', metrics: '指标', datasources: '数据源', workbooks: '工作簿' };
    return titles[type] || type;
}

function renderPropRow(label, value, isCode = false) {
    if (!value) return '';
    return `
    <div class="col-span-1">
        <div class="text-[10px] text-gray-400 mb-0.5">${label}</div>
        <div class="text-[12px] text-gray-700 ${isCode ? 'font-mono text-[11px]' : ''} truncate" title="${value}">${value}</div>
    </div>`;
}

function handleSearch(e) {
    if (e.key === 'Enter' || e.type === 'keyup') { state.searchTerm = e.target.value; applyFilters(); }
}

async function updateGlobalStats() {
    const s = await api.get('/stats');
    state.stats = s;
    for (const [k, v] of Object.entries(s)) {
        const el = document.getElementById(`count-${k}`);
        if (el) el.textContent = v > 1000 ? (v / 1000).toFixed(1) + 'k' : v;
    }
}
