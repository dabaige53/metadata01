#!/usr/bin/env node

/**
 * E2E 测试脚本 - 验证 Next.js 前端核心功能
 *
 * 测试项：
 * 1. 页面是否能正常加载
 * 2. API 数据是否能正常获取
 * 3. 组件是否能正常渲染
 */

const http = require('http');

const API_BASE = 'http://localhost:8001';
const FRONTEND_BASE = 'http://localhost:3000';  // Next.js 默认端口

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP 请求封装
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
          headers: res.headers,
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

// 测试结果统计
const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

// 测试用例
async function testAPIEndpoint(name, endpoint) {
  try {
    log('blue', `\n测试: ${name}`);
    const url = `${API_BASE}${endpoint}`;
    log('yellow', `  请求: ${url}`);

    const response = await request(url);

    if (response.status === 200) {
      // 尝试解析 JSON
      try {
        const data = JSON.parse(response.body);
        log('green', `  ✓ 成功 (状态: ${response.status})`);
        log('green', `    数据类型: ${Array.isArray(data) ? 'Array' : typeof data}`);
        if (Array.isArray(data)) {
          log('green', `    数据量: ${data.length} 项`);
        } else if (data.items) {
          log('green', `    数据量: ${data.items.length} 项 (分页)`);
        }
        results.passed++;
        return true;
      } catch (e) {
        log('red', `  ✗ JSON 解析失败: ${e.message}`);
        results.failed++;
        results.errors.push({ test: name, error: 'JSON 解析失败' });
        return false;
      }
    } else {
      log('red', `  ✗ 失败 (状态: ${response.status})`);
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

async function testFrontendPage(name, path) {
  try {
    log('blue', `\n测试: ${name}`);
    const url = `${FRONTEND_BASE}${path}`;
    log('yellow', `  请求: ${url}`);

    const response = await request(url);

    if (response.status === 200) {
      const bodyLength = response.body.length;
      const hasReact = response.body.includes('__NEXT_DATA__');

      log('green', `  ✓ 成功 (状态: ${response.status})`);
      log('green', `    页面大小: ${(bodyLength / 1024).toFixed(2)} KB`);
      log('green', `    Next.js 数据: ${hasReact ? '是' : '否'}`);

      results.passed++;
      return true;
    } else {
      log('red', `  ✗ 失败 (状态: ${response.status})`);
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

// 主测试流程
async function runTests() {
  log('blue', '═══════════════════════════════════════════════════════');
  log('blue', '  Tableau 元数据治理平台 - E2E 测试');
  log('blue', '═══════════════════════════════════════════════════════');

  // 测试 API 端点
  log('yellow', '\n【阶段 1】测试后端 API (localhost:8001)');
  log('yellow', '─────────────────────────────────────────────────────');

  await testAPIEndpoint('仪表盘分析', '/api/dashboard/analysis');
  await testAPIEndpoint('统计数据', '/api/stats');
  await testAPIEndpoint('数据库列表', '/api/databases');
  await testAPIEndpoint('字段列表', '/api/fields?page=1&page_size=50');
  await testAPIEndpoint('数据表列表', '/api/tables');
  await testAPIEndpoint('指标列表', '/api/metrics?page=1&page_size=50');
  await testAPIEndpoint('工作簿列表', '/api/workbooks');
  await testAPIEndpoint('数据源列表', '/api/datasources');
  await testAPIEndpoint('重复指标分析', '/api/quality/duplicates');

  // 测试前端页面
  log('yellow', '\n【阶段 2】测试前端页面 (localhost:3001)');
  log('yellow', '─────────────────────────────────────────────────────');

  await testFrontendPage('首页', '/');
  await testFrontendPage('字段字典', '/fields');
  await testFrontendPage('数据表', '/tables');
  await testFrontendPage('指标库', '/metrics');
  await testFrontendPage('工作簿', '/workbooks');
  await testFrontendPage('数据源', '/datasources');

  // 输出测试结果
  log('blue', '\n═══════════════════════════════════════════════════════');
  log('blue', '  测试结果');
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
    log('green', '\n✓ 所有测试通过！');
    process.exit(0);
  } else {
    log('red', '\n✗ 存在测试失败，请检查错误信息');
    process.exit(1);
  }
}

// 运行测试
runTests().catch((error) => {
  log('red', `\n测试运行失败: ${error.message}`);
  process.exit(1);
});
