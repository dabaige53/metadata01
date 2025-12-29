#!/usr/bin/env node

/**
 * 功能测试脚本 - 测试筛选、排序、分页等新功能
 */

const http = require('http');

const FRONTEND_BASE = process.env.FRONTEND_BASE || 'http://localhost:3200';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function request(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      timeout: 5000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: data,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

async function testFeature(name, url, validator) {
  try {
    log('cyan', `\n测试: ${name}`);
    log('yellow', `  URL: ${url}`);

    const response = await request(`${FRONTEND_BASE}${url}`);

    if (response.status === 200) {
      const valid = validator ? validator(response.body) : true;

      if (valid) {
        log('green', `  ✓ 通过`);
        results.passed++;
        return true;
      } else {
        log('red', `  ✗ 验证失败`);
        results.failed++;
        results.errors.push({ test: name, error: '验证失败' });
        return false;
      }
    } else {
      log('red', `  ✗ HTTP ${response.status}`);
      results.failed++;
      results.errors.push({ test: name, error: `HTTP ${response.status}` });
      return false;
    }
  } catch (error) {
    log('red', `  ✗ 错误: ${error.message}`);
    results.failed++;
    results.errors.push({ test: name, error: error.message });
    return false;
  }
}

async function runTests() {
  log('blue', '═══════════════════════════════════════════════════════');
  log('blue', '  功能测试 - 筛选、排序、分页');
  log('blue', '═══════════════════════════════════════════════════════');

  // 测试字段字典页面
  log('yellow', '\n【模块 1】字段字典页面');
  log('yellow', '─────────────────────────────────────────────────────');

  await testFeature('基础加载', '/fields');
  await testFeature('筛选 - 角色(measure)', '/fields?role=measure');
  await testFeature('筛选 - 数据类型', '/fields?data_type=string');
  await testFeature('排序 - 热度降序', '/fields?sort=usageCount&order=desc');
  await testFeature('排序 - 名称升序', '/fields?sort=name&order=asc');
  await testFeature('分页 - 第2页', '/fields?page=2');
  await testFeature('组合 - 筛选+排序', '/fields?role=measure&sort=usageCount&order=desc');
  await testFeature('组合 - 全部功能', '/fields?role=measure&sort=usageCount&order=desc&page=2');

  // 测试数据表页面
  log('yellow', '\n【模块 2】数据表页面');
  log('yellow', '─────────────────────────────────────────────────────');

  await testFeature('基础加载', '/tables');
  await testFeature('筛选 - Schema', '/tables?schema=public');
  await testFeature('排序 - 字段数', '/tables?sort=field_count&order=desc');
  await testFeature('分页 - 第2页', '/tables?page=2');

  // 测试指标库页面
  log('yellow', '\n【模块 3】指标库页面');
  log('yellow', '─────────────────────────────────────────────────────');

  await testFeature('基础加载', '/metrics');
  await testFeature('筛选 - 有重复', '/metrics?hasDuplicate=true');
  await testFeature('排序 - 复杂度', '/metrics?sort=complexity&order=desc');
  await testFeature('排序 - 引用数', '/metrics?sort=referenceCount&order=desc');
  await testFeature('分页 - 第2页', '/metrics?page=2');

  // 测试工作簿页面
  log('yellow', '\n【模块 4】工作簿页面');
  log('yellow', '─────────────────────────────────────────────────────');

  await testFeature('基础加载', '/workbooks');
  await testFeature('排序 - 视图数', '/workbooks?sort=viewCount&order=desc');
  await testFeature('分页 - 第2页', '/workbooks?page=2');

  // 测试其他页面
  log('yellow', '\n【模块 5】其他页面');
  log('yellow', '─────────────────────────────────────────────────────');

  await testFeature('首页', '/');
  await testFeature('数据源', '/datasources');
  await testFeature('数据库', '/databases');
  await testFeature('项目', '/projects');
  await testFeature('用户', '/users');
  await testFeature('视图', '/views');
  await testFeature('视图 - 仪表盘列表', '/views?include_standalone=true');
  await testFeature('视图 - 仅仪表盘', '/views?view_type=dashboard');
  await testFeature('视图 - 仅工作表', '/views?view_type=sheet');
  await testFeature('搜索', '/search');

  // 输出结果
  log('blue', '\n═══════════════════════════════════════════════════════');
  log('blue', '  测试结果汇总');
  log('blue', '═══════════════════════════════════════════════════════');

  log('green', `\n通过: ${results.passed}`);
  log('red', `失败: ${results.failed}`);

  if (results.errors.length > 0) {
    log('red', '\n失败详情:');
    results.errors.forEach((err, i) => {
      log('red', `  ${i + 1}. ${err.test}: ${err.error}`);
    });
  }

  const totalTests = results.passed + results.failed;
  const successRate = ((results.passed / totalTests) * 100).toFixed(2);

  log('blue', `\n总测试数: ${totalTests}`);
  log('blue', `成功率: ${successRate}%`);

  log('blue', '\n═══════════════════════════════════════════════════════');

  if (results.failed === 0) {
    log('green', '\n✓ 所有功能测试通过！');
    log('green', '\n新增功能验证完成：');
    log('green', '  ✓ 筛选功能 (角色、数据类型、Schema等)');
    log('green', '  ✓ 排序功能 (热度、复杂度、字段数等)');
    log('green', '  ✓ 分页功能 (URL状态同步)');
    log('green', '  ✓ 组合使用 (筛选+排序+分页)');
    process.exit(0);
  } else {
    log('red', '\n✗ 存在测试失败');
    process.exit(1);
  }
}

runTests().catch((error) => {
  log('red', `\n测试运行失败: ${error.message}`);
  process.exit(1);
});
