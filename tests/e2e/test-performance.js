#!/usr/bin/env node

/**
 * 性能测试脚本
 * 检测所有API接口的响应时间,标记超过500ms的慢请求
 */

const BACKEND_URL = process.env.API_BASE || 'http://localhost:8201';
const SLOW_THRESHOLD = 500; // 500ms阈值

// 测试用例
const tests = [
    { name: '仪表盘分析', url: '/api/dashboard/analysis' },
    { name: '统计数据', url: '/api/stats' },
    { name: '数据库列表', url: '/api/databases' },
    { name: '数据表列表', url: '/api/tables?page=1&page_size=50' },
    { name: '字段列表', url: '/api/fields?page=1&page_size=50' },
    { name: '指标列表', url: '/api/metrics?page=1&page_size=50' },
    { name: '数据源列表', url: '/api/datasources?page=1&page_size=50' },
    { name: '工作簿列表', url: '/api/workbooks?page=1&page_size=50' },
    { name: '视图列表', url: '/api/views?page=1&page_size=50' },
    { name: '重复指标分析', url: '/api/quality/duplicates' },
];

async function testEndpoint(name, url) {
    const fullUrl = `${BACKEND_URL}${url}`;
    const startTime = Date.now();

    try {
        const response = await fetch(fullUrl);
        const endTime = Date.now();
        const duration = endTime - startTime;

        const data = await response.json();
        const isSlow = duration > SLOW_THRESHOLD;

        // 计算数据大小
        const dataSize = JSON.stringify(data).length;
        const dataSizeKB = (dataSize / 1024).toFixed(2);

        // 获取数据量
        let itemCount = 'N/A';
        if (Array.isArray(data)) {
            itemCount = data.length;
        } else if (data.items) {
            itemCount = `${data.items.length} (total: ${data.total || 'N/A'})`;
        }

        return {
            name,
            url,
            status: response.status,
            duration,
            isSlow,
            dataSize: dataSizeKB,
            itemCount,
        };
    } catch (error) {
        return {
            name,
            url,
            status: 'ERROR',
            duration: -1,
            isSlow: false,
            error: error.message,
        };
    }
}

async function runPerformanceTests() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  性能测试 - 检测超过500ms的慢请求');
    console.log('═══════════════════════════════════════════════════════\n');

    const results = [];

    for (const test of tests) {
        process.stdout.write(`测试: ${test.name}...`);
        const result = await testEndpoint(test.name, test.url);
        results.push(result);

        if (result.status === 'ERROR') {
            console.log(` ✗ 失败 (${result.error})`);
        } else {
            const slowMark = result.isSlow ? ' ⚠️  慢' : ' ✓';
            console.log(`${slowMark} ${result.duration}ms (${result.dataSize} KB)`);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  详细结果');
    console.log('═══════════════════════════════════════════════════════\n');

    // 按响应时间排序
    const sortedResults = results.filter(r => r.status !== 'ERROR').sort((a, b) => b.duration - a.duration);

    console.log('接口名称'.padEnd(25) + '响应时间'.padEnd(12) + '数据大小'.padEnd(12) + '数据量');
    console.log('─'.repeat(70));

    sortedResults.forEach(result => {
        const nameCol = result.name.padEnd(25);
        const timeCol = `${result.duration}ms`.padEnd(12);
        const sizeCol = `${result.dataSize} KB`.padEnd(12);
        const countCol = result.itemCount;
        const slowMark = result.isSlow ? '⚠️ ' : '  ';

        console.log(`${slowMark}${nameCol}${timeCol}${sizeCol}${countCol}`);
    });

    // 统计慢请求
    const slowRequests = results.filter(r => r.isSlow);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  性能总结');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`总测试数: ${results.length}`);
    console.log(`慢请求数 (>500ms): ${slowRequests.length}`);
    console.log(`最快请求: ${Math.min(...results.filter(r => r.status !== 'ERROR').map(r => r.duration))}ms`);
    console.log(`最慢请求: ${Math.max(...results.filter(r => r.status !== 'ERROR').map(r => r.duration))}ms`);
    console.log(`平均响应时间: ${Math.round(results.filter(r => r.status !== 'ERROR').reduce((sum, r) => sum + r.duration, 0) / results.filter(r => r.status !== 'ERROR').length)}ms`);

    if (slowRequests.length > 0) {
        console.log('\n⚠️  发现慢请求:');
        slowRequests.forEach(req => {
            console.log(`  - ${req.name}: ${req.duration}ms (${req.dataSize} KB)`);
        });
    } else {
        console.log('\n✓ 所有请求都在500ms以内!');
    }

    console.log('\n═══════════════════════════════════════════════════════\n');
}

runPerformanceTests().catch(console.error);
