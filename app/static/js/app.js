// 全局状态管理
const state = {
    activeModule: 'overview', // database, table, field, etc.
    data: [],       // 当前模块的所有数据
    filteredData: [], // 经过筛选的数据
    facets: {},     // 可用的筛选维度 { 'owner': {'John': 5, 'Alice': 3}, 'tier': ... }
    activeFilters: {}, // 当前选中的筛选 { 'owner': ['John'], 'tier': ['Tier 1'] }
    searchTerm: '',
    stats: {}
};

// API 客户端
const api = {
    get: async (url) => {
        try {
            const res = await fetch(`/api${url}`);
            return await res.json();
        } catch (e) {
            console.error("API Error", e);
            return [];
        }
    }
};

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await updateGlobalStats();
    switchModule('overview');
});

// 模块切换
async function switchModule(moduleName) {
    state.activeModule = moduleName;
    state.searchTerm = '';
    state.activeFilters = {};

    // 更新导航高亮
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[onclick="switchModule('${moduleName}')"]`);
    if (navItem) navItem.classList.add('active');

    // 显示加载中
    document.getElementById('main-content').innerHTML = `
        <div class="loading-spinner">
            <i data-lucide="loader-2" class="spin" style="width: 32px; height: 32px;"></i>
            <span>Loading Metadata Assets...</span>
        </div>
    `;
    lucide.createIcons();

    // 加载数据
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
    const data = await api.get(`/${module}`);
    state.data = data;
    applyFilters(); // 这里会触发 render
}

// 核心：筛选逻辑
function applyFilters() {
    let result = state.data;

    // 1. 全局搜索
    if (state.searchTerm) {
        const term = state.searchTerm.toLowerCase();
        result = result.filter(item =>
            (item.name && item.name.toLowerCase().includes(term)) ||
            (item.description && item.description.toLowerCase().includes(term)) ||
            (item.owner && item.owner.toLowerCase().includes(term))
        );
    }

    // 2. Facet 筛选
    for (const [key, selectedValues] of Object.entries(state.activeFilters)) {
        if (selectedValues.length > 0) {
            result = result.filter(item => {
                const itemValue = item[key]; // string or array
                if (Array.isArray(itemValue)) {
                    // 如果 item[key] 是数组 (如 tags)，只要有一个交集即可
                    return itemValue.some(v => selectedValues.includes(v));
                } else {
                    return selectedValues.includes(itemValue);
                }
            });
        }
    }

    state.filteredData = result;

    // 3. 重新计算 Facet 计数 (基于 filteredData 还是 全局 data? 通常 faceted search 基于当前搜索结果)
    calculateFacets(result);

    // 4. 渲染
    renderList();
    renderFacets();
}

// 计算 Facets
function calculateFacets(data) {
    // 定义每个模块要展示的 Facets
    const facetConfig = {
        'databases': ['connection_type', 'owner', 'tier'],
        'tables': ['connection_type', 'owner', 'tier'],
        'fields': ['role', 'data_type', 'owner'],
        'datasources': ['is_certified', 'owner'],
        'workbooks': ['project_name', 'owner'],
        'metrics': ['role', 'complexity', 'owner']
    };

    const keys = facetConfig[state.activeModule] || ['owner', 'tags'];
    const facets = {};

    keys.forEach(key => {
        facets[key] = {};
        data.forEach(item => {
            let values = [];
            if (Array.isArray(item[key])) {
                values = item[key];
            } else if (item[key] !== undefined && item[key] !== null) {
                values = [String(item[key])]; // 统一转字符串
            }

            values.forEach(v => {
                facets[key][v] = (facets[key][v] || 0) + 1;
            });
        });
    });

    state.facets = facets;
}

// 渲染列表
function renderList() {
    const listContainer = document.getElementById('main-content');
    const count = state.filteredData.length;

    let html = `
        <div class="module-header">
            <div class="module-title">
                <h1>${getModuleName(state.activeModule)}</h1>
                <div class="module-desc">找到 ${count} 个资产</div>
            </div>
            <!-- 可以加排序等控件 -->
        </div>
        
        <div class="resource-list">
    `;

    if (count === 0) {
        html += `<div style="text-align:center; padding: 40px; color: #999;">没有找到匹配的资源</div>`;
    } else {
        html += state.filteredData.map(item => renderCard(item)).join('');
    }

    html += `</div>`;
    listContainer.innerHTML = html;
    lucide.createIcons();
}

// 渲染单个卡片 (DataHub 风格)
function renderCard(item) {
    const type = state.activeModule;
    let icon = 'box';
    let breadcrumb = '';
    let previewHtml = '';
    let footerHtml = '';

    // 根据类型定制内容
    if (type === 'databases') {
        icon = 'database';
        breadcrumb = `PLATFORM > ${item.type || 'DB'} > ${item.host || 'unknown'}`;

        // 预览表
        if (item.table_names && item.table_names.length) {
            previewHtml = `<div class="preview-data">
                包含表: ${item.table_names.map(t => `<span class="preview-item dimension">${t}</span>`).join('')}
            </div>`;
        }
        footerHtml = `
            <div class="footer-item"><i data-lucide="table-2" width="14"></i> ${item.tables || 0} 表</div>
            <div class="footer-item"><i data-lucide="user" width="14"></i> ${item.owner || '-'}</div>
        `;

    } else if (type === 'tables') {
        icon = 'table-2';
        breadcrumb = `${item.databaseName || 'DB'} > ${item.schema || 'public'} > ${item.name}`;

        // 预览字段
        if (item.preview_fields) {
            const m = item.preview_fields.measures || [];
            const d = item.preview_fields.dimensions || [];
            previewHtml = `<div class="preview-data">
                ${m.map(f => `<span class="preview-item measure"># ${f}</span>`).join('')}
                ${d.map(f => `<span class="preview-item dimension">Abc ${f}</span>`).join('')}
            </div>`;
        }
        footerHtml = `
            <div class="footer-item"><i data-lucide="columns" width="14"></i> ${item.fieldCount || 0} 字段</div>
            <div class="footer-item"><i data-lucide="database" width="14"></i> ${item.row_count ? (item.row_count / 1000).toFixed(1) + 'k 行' : '-'}</div>
            <div class="footer-item"><i data-lucide="hard-drive" width="14"></i> ${item.size || '-'}</div>
            <div class="footer-item"><i data-lucide="user" width="14"></i> ${item.owner || '-'}</div>
        `;

    } else if (type === 'fields') {
        icon = item.isCalculated ? 'function-square' : 'columns';
        breadcrumb = `${item.datasource || item.table || 'Unknown'} > ${item.name}`;

        previewHtml = `<div class="preview-data" style="color: #666;">
           ${item.description || '暂无描述信息...'}
        </div>`;

        footerHtml = `
            <div class="footer-item"><i data-lucide="tag" width="14"></i> ${item.dataType}</div>
            <div class="footer-item"><i data-lucide="activity" width="14"></i> ${item.usageCount || 0} 次引用</div>
            ${item.is_primary_key ? '<div class="footer-item"><i data-lucide="key" width="14"></i> PK</div>' : ''}
        `;

    } else if (type === 'datasources') {
        icon = 'layers';
        breadcrumb = `${item.projectName || 'Default'} > ${item.name}`;

        if (item.connected_tables && item.connected_tables.length) {
            previewHtml = `<div class="preview-data">
                物理表: ${item.connected_tables.map(t => `<span class="preview-item dimension">${t}</span>`).join('')}
            </div>`;
        }
        footerHtml = `
            <div class="footer-item"><i data-lucide="user" width="14"></i> ${item.owner}</div>
            <div class="footer-item"><i data-lucide="check-circle" width="14"></i> ${item.isCertified ? '已认证' : '未认证'}</div>
        `;

    } else if (type === 'workbooks') {
        icon = 'book-open';
        breadcrumb = `${item.projectName || 'Project'} > ${item.name}`;

        if (item.upstream_datasources && item.upstream_datasources.length) {
            previewHtml = `<div class="preview-data">
                使用数据源: ${item.upstream_datasources.map(ds => `<span class="preview-item measure">${ds}</span>`).join('')}
            </div>`;
        }
        footerHtml = `
            <div class="footer-item"><i data-lucide="eye" width="14"></i> ${item.viewCount || 0} 视图</div>
            <div class="footer-item"><i data-lucide="user" width="14"></i> ${item.owner}</div>
        `;

    } else if (type === 'metrics') {
        icon = 'bar-chart-2';
        breadcrumb = `${item.datasourceName || 'Unknown'} > ${item.name}`;

        previewHtml = `<div class="preview-data" style="font-family:monospace; color: #555;">
             = ${item.formula || ''}
        </div>`;
        footerHtml = `
            <div class="footer-item"><i data-lucide="activity" width="14"></i> ${item.referenceCount} 引用</div>
            <div class="footer-item"><i data-lucide="zap" width="14"></i> 复杂度: ${item.complexity}</div>
        `;
    }

    // 标签渲染
    let tagsHtml = '';
    if (item.tags && item.tags.length > 0) {
        tagsHtml = `<div class="tags-row">
            ${item.tags.map(t => `<span class="tag ${t}">${t}</span>`).join('')}
            ${item.tier ? `<span class="tag ${item.tier}">${item.tier}</span>` : ''}
        </div>`;
    }

    return `
    <div class="resource-card" onclick="showDetail(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${type}')">
        <div class="card-header">
            <div class="card-icon">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="card-title-area">
                <div class="card-title">
                    ${item.name}
                    ${item.isCertified ? '<i data-lucide="badge-check" width="16" fill="#52C41A" color="white"></i>' : ''}
                </div>
                <div class="card-breadcrumb">${breadcrumb}</div>
                ${previewHtml}
                ${tagsHtml}
            </div>
        </div>
        <div class="card-footer">
            ${footerHtml}
            <div class="footer-item" style="margin-left:auto"><i data-lucide="clock" width="14"></i> ${item.last_updated || 'recently'}</div>
        </div>
    </div>
    `;
}

// 渲染左侧 Facets
function renderFacets() {
    const container = document.getElementById('dynamic-filters');
    let html = '';

    // 自定义标签名映射
    const labelMap = {
        'owner': '负责人',
        'tier': '重要性层级',
        'tags': '标签',
        'connection_type': '连接类型',
        'role': '字段角色',
        'is_certified': '是否认证',
        'project_name': '项目',
        'data_type': '数据类型',
        'complexity': '复杂度'
    };

    for (const [key, counts] of Object.entries(state.facets)) {
        // 只显示至少有1个值的 facet
        if (Object.keys(counts).length === 0) continue;

        const label = labelMap[key] || key;

        const itemsHtml = Object.entries(counts).map(([val, count]) => {
            const isChecked = state.activeFilters[key] && state.activeFilters[key].includes(val) ? 'checked' : '';
            return `
                <label class="facet-item">
                    <input type="checkbox" class="facet-checkbox" 
                        onchange="toggleFilter('${key}', '${val}')" ${isChecked}>
                    <span>${val}</span>
                    <span class="facet-count">${count}</span>
                </label>
            `;
        }).join('');

        html += `
            <div class="facet-group">
                <div class="facet-title">${label}</div>
                <div class="facet-list">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// 切换筛选状态
function toggleFilter(key, value) {
    if (!state.activeFilters[key]) state.activeFilters[key] = [];

    const idx = state.activeFilters[key].indexOf(value);
    if (idx > -1) {
        state.activeFilters[key].splice(idx, 1);
    } else {
        state.activeFilters[key].push(value);
    }

    applyFilters();
}

// 搜索处理
function handleSearch(e) {
    if (e.key === 'Enter' || e.type === 'keyup') {
        state.searchTerm = e.target.value;
        applyFilters();
    }
}

// 侧边栏统计
async function updateGlobalStats() {
    const stats = await api.get('/stats');
    state.stats = stats;

    // 更新左侧导航的数字徽章
    for (const [k, v] of Object.entries(stats)) {
        const el = document.getElementById(`count-${k}`);
        if (el) el.textContent = formatCount(v);
    }
}

function formatCount(num) {
    return num > 1000 ? (num / 1000).toFixed(1) + 'k' : num;
}

function getModuleName(key) {
    const map = {
        'overview': '概览',
        'databases': '数据库资产',
        'tables': '数据表',
        'fields': '字段字典',
        'metrics': '业务指标',
        'datasources': 'Tableau 数据源',
        'workbooks': 'Tableau 工作簿'
    };
    return map[key] || key;
}

// 详情抽屉
function showDetail(item, type) {
    const drawer = document.getElementById('detail-drawer');
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('drawer-title');
    const content = document.getElementById('drawer-content');

    title.textContent = item.name;
    drawer.classList.add('open');
    overlay.classList.add('active');

    // 渲染 JSON 详情 (后续可以做得更精美)
    let detailHtml = `
        <div class="detail-section">
            <div class="detail-section-title">基本属性</div>
            ${Object.entries(item).map(([k, v]) => {
        if (typeof v === 'object') return ''; // 跳过复杂对象
        return `
                <div class="kv-pair">
                    <div class="kv-key">${k}</div>
                    <div class="kv-value">${v}</div>
                </div>`;
    }).join('')}
        </div>
    `;

    // 针对具体类型的扩展，比如血缘
    content.innerHTML = `<div class="loading-spinner"><i data-lucide="loader-2" class="spin"></i></div>`;

    // 异步加载血缘等详情
    setTimeout(async () => {
        let extra = '';
        if (['table', 'field', 'database', 'datasource'].includes(type.slice(0, -1))) { // plural to singular guess
            try {
                // Try to guess singular type name for API
                let singType = type.slice(0, -1);
                if (type === 'databases') singType = 'database';
                if (type === 'metrics') singType = 'metric'; // API doesn't have lineage for metric yet

                // Fetch Lineage
                if (singType !== 'metric' && singType !== 'workbook') {
                    const lineage = await api.get(`/lineage/${singType}/${item.id}`);
                    if (lineage.upstream && lineage.upstream.length) {
                        extra += `<div class="detail-section"><div class="detail-section-title">上游依赖</div>
                        ${lineage.upstream.map(u => `<div class="tag">${u.type}: ${u.name}</div>`).join('')}
                        </div>`;
                    }
                    if (lineage.downstream && lineage.downstream.length) {
                        extra += `<div class="detail-section"><div class="detail-section-title">下游影响</div>
                        ${lineage.downstream.map(d => `<div class="tag">${d.type}: ${d.name}</div>`).join('')}
                        </div>`;
                    }
                }
            } catch (e) { }
        }
        content.innerHTML = detailHtml + extra;
    }, 300);
}

function closeDrawer() {
    document.getElementById('detail-drawer').classList.remove('open');
    document.getElementById('overlay').classList.remove('active');
}

// 概览页渲染
async function renderOverview() {
    const listContainer = document.getElementById('main-content');
    const stats = state.stats;

    listContainer.innerHTML = `
        <div class="module-header">
            <div class="module-title">
                <h1>欢迎回来, Admin</h1>
                <div class="module-desc">这是您的元数据治理概览</div>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-val">${stats.tables || 0}</div>
                <div class="stat-label">数据表</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">${stats.fields || 0}</div>
                <div class="stat-label">字段</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">${stats.metrics || 0}</div>
                <div class="stat-label">认证指标</div>
            </div>
            <div class="stat-card">
                <div class="stat-val">${stats.workbooks || 0}</div>
                <div class="stat-label">工作簿</div>
            </div>
        </div>
        
        <div style="background: white; padding: 24px; border-radius: 8px; border: 1px solid #E8E8E8;">
            <h3>治理健康度</h3>
            <p style="color: #666; margin-top: 8px;">演示环境暂无足够数据生成图表。</p>
        </div>
    `;
}
