"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const child_process_1 = require("child_process");
const LEADER_URL = process.env.LEADER_URL || 'http://localhost:8080';
const FOLLOWER_URLS = (process.env.FOLLOWER_URLS ||
    'http://localhost:8081,http://localhost:8082,http://localhost:8083,http://localhost:8084,http://localhost:8085')
    .split(',')
    .map((url) => url.trim());
// Configuration
const TOTAL_WRITES = 100;
const CONCURRENT_WRITES = 10;
const NUM_KEYS = 10;
const QUORUM_VALUES = [1, 2, 3, 4, 5];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Update docker-compose.yml with new quorum value
function updateQuorum(quorum) {
    console.log(`\nUpdating WRITE_QUORUM to ${quorum}...`);
    // Read current docker-compose.yml and update WRITE_QUORUM
    const composeFile = 'docker-compose.yml';
    const content = require('fs').readFileSync(composeFile, 'utf-8');
    const updatedContent = content.replace(/WRITE_QUORUM=\d+/, `WRITE_QUORUM=${quorum}`);
    require('fs').writeFileSync(composeFile, updatedContent);
}
// Restart containers
async function restartContainers() {
    console.log('Restarting containers...');
    try {
        (0, child_process_1.execSync)('docker-compose down', { stdio: 'inherit' });
        (0, child_process_1.execSync)('docker-compose up -d --build', { stdio: 'inherit' });
        // Wait for containers to be ready
        console.log('Waiting for containers to be ready...');
        await sleep(10000);
        // Check health
        let healthy = false;
        for (let i = 0; i < 30; i++) {
            try {
                const response = await axios_1.default.get(`${LEADER_URL}/health`, { timeout: 2000 });
                if (response.data.status === 'healthy') {
                    healthy = true;
                    break;
                }
            }
            catch {
                await sleep(1000);
            }
        }
        if (!healthy) {
            throw new Error('Containers not healthy after 30 seconds');
        }
        console.log('Containers are ready!');
    }
    catch (error) {
        console.error('Failed to restart containers:', error);
        throw error;
    }
}
// Clear all data
async function clearAllData() {
    try {
        await axios_1.default.post(`${LEADER_URL}/clear`);
        for (const url of FOLLOWER_URLS) {
            try {
                await axios_1.default.post(`${url}/clear`);
            }
            catch {
                // Ignore
            }
        }
    }
    catch {
        // Ignore
    }
}
// Perform writes with concurrency control
async function performWrites(totalWrites, concurrentWrites, numKeys) {
    const results = [];
    const queue = [];
    for (let i = 0; i < totalWrites; i++) {
        const key = `key-${i % numKeys}`;
        const value = i;
        const writePromise = (async () => {
            const startTime = Date.now();
            try {
                const response = await axios_1.default.post(`${LEADER_URL}/write`, { key, value });
                const latency = Date.now() - startTime;
                return {
                    key,
                    value,
                    latency,
                    success: response.data.success,
                };
            }
            catch (error) {
                const latency = Date.now() - startTime;
                return {
                    key,
                    value,
                    latency,
                    success: false,
                };
            }
        })();
        queue.push(writePromise);
        // Process in batches
        if (queue.length >= concurrentWrites) {
            const batchResults = await Promise.all(queue);
            results.push(...batchResults);
            queue.length = 0;
        }
    }
    // Process remaining
    if (queue.length > 0) {
        const batchResults = await Promise.all(queue);
        results.push(...batchResults);
    }
    return results;
}
// Check data consistency
async function checkConsistency() {
    const details = [];
    let consistent = true;
    try {
        const leaderResponse = await axios_1.default.get(`${LEADER_URL}/data`);
        const leaderData = leaderResponse.data.data;
        for (const url of FOLLOWER_URLS) {
            try {
                const followerResponse = await axios_1.default.get(`${url}/data`);
                const followerData = followerResponse.data.data;
                const leaderKeys = Object.keys(leaderData);
                const followerKeys = Object.keys(followerData);
                // Check for missing keys
                const missingInFollower = leaderKeys.filter((k) => !followerKeys.includes(k));
                const extraInFollower = followerKeys.filter((k) => !leaderKeys.includes(k));
                if (missingInFollower.length > 0) {
                    consistent = false;
                    details.push(`${url}: Missing keys: ${missingInFollower.join(', ')}`);
                }
                if (extraInFollower.length > 0) {
                    details.push(`${url}: Extra keys (not on leader): ${extraInFollower.join(', ')}`);
                }
                // Check for value mismatches
                for (const key of leaderKeys) {
                    if (followerKeys.includes(key) &&
                        JSON.stringify(leaderData[key]) !== JSON.stringify(followerData[key])) {
                        consistent = false;
                        details.push(`${url}: Value mismatch for '${key}': leader=${JSON.stringify(leaderData[key])}, follower=${JSON.stringify(followerData[key])}`);
                    }
                }
                if (missingInFollower.length === 0 &&
                    extraInFollower.length === 0) {
                    const matchCount = leaderKeys.filter((k) => JSON.stringify(leaderData[k]) === JSON.stringify(followerData[k])).length;
                    details.push(`${url}: ${matchCount}/${leaderKeys.length} keys match`);
                }
            }
            catch (error) {
                consistent = false;
                details.push(`${url}: Error fetching data - ${error}`);
            }
        }
    }
    catch (error) {
        consistent = false;
        details.push(`Leader: Error fetching data - ${error}`);
    }
    return { consistent, details };
}
// Run performance test for a specific quorum
async function runQuorumTest(quorum) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing with WRITE_QUORUM = ${quorum}`);
    console.log('='.repeat(50));
    // Update quorum and restart
    updateQuorum(quorum);
    await restartContainers();
    await clearAllData();
    // Perform writes
    console.log(`\nPerforming ${TOTAL_WRITES} writes (${CONCURRENT_WRITES} concurrent) on ${NUM_KEYS} keys...`);
    const startTime = Date.now();
    const results = await performWrites(TOTAL_WRITES, CONCURRENT_WRITES, NUM_KEYS);
    const totalTime = Date.now() - startTime;
    // Calculate statistics
    const successfulResults = results.filter((r) => r.success);
    const latencies = successfulResults.map((r) => r.latency);
    const avgLatency = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    const successRate = (successfulResults.length / results.length) * 100;
    console.log(`\nResults for quorum=${quorum}:`);
    console.log(`  Total time: ${totalTime}ms`);
    console.log(`  Successful writes: ${successfulResults.length}/${results.length}`);
    console.log(`  Average latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`  Min latency: ${minLatency}ms`);
    console.log(`  Max latency: ${maxLatency}ms`);
    console.log(`  Success rate: ${successRate.toFixed(2)}%`);
    return {
        quorum,
        avgLatency,
        minLatency,
        maxLatency,
        successRate,
        totalWrites: results.length,
    };
}
// Generate ASCII chart
function generateChart(results) {
    const maxLatency = Math.max(...results.map((r) => r.avgLatency));
    const chartHeight = 15;
    const barWidth = 8;
    let chart = '\n📊 Write Quorum vs Average Latency\n';
    chart += '═'.repeat(50) + '\n\n';
    // Generate bars
    for (let row = chartHeight; row >= 0; row--) {
        const threshold = (row / chartHeight) * maxLatency;
        let line = `${threshold.toFixed(0).padStart(6)}ms │`;
        for (const result of results) {
            if (result.avgLatency >= threshold) {
                line += ' '.repeat(2) + '██████' + ' '.repeat(2);
            }
            else {
                line += ' '.repeat(barWidth + 2);
            }
        }
        chart += line + '\n';
    }
    // X-axis
    chart += '        └' + '─'.repeat(results.length * (barWidth + 2)) + '\n';
    chart += '         ';
    for (const result of results) {
        chart += `   Q=${result.quorum}   `;
    }
    chart += '\n';
    // Legend
    chart += '\n' + '═'.repeat(50) + '\n';
    chart += 'Legend: Q = Write Quorum\n';
    return chart;
}
// Main performance test
async function runPerformanceTest() {
    console.log('\n🚀 Starting Performance Analysis\n');
    console.log(`Configuration:`);
    console.log(`  Total writes: ${TOTAL_WRITES}`);
    console.log(`  Concurrent writes: ${CONCURRENT_WRITES}`);
    console.log(`  Number of keys: ${NUM_KEYS}`);
    console.log(`  Quorum values to test: ${QUORUM_VALUES.join(', ')}`);
    const allResults = [];
    for (const quorum of QUORUM_VALUES) {
        const result = await runQuorumTest(quorum);
        allResults.push(result);
    }
    // Print summary table
    console.log('\n\n📈 PERFORMANCE SUMMARY');
    console.log('═'.repeat(80));
    console.log('Quorum │ Avg Latency │ Min Latency │ Max Latency │ Success Rate │ Total Writes');
    console.log('─'.repeat(80));
    for (const result of allResults) {
        console.log(`   ${result.quorum}   │ ${result.avgLatency.toFixed(2).padStart(9)}ms │ ${result.minLatency.toString().padStart(9)}ms │ ${result.maxLatency.toString().padStart(9)}ms │ ${result.successRate.toFixed(2).padStart(10)}% │ ${result.totalWrites.toString().padStart(12)}`);
    }
    console.log('═'.repeat(80));
    // Generate chart
    console.log(generateChart(allResults));
    // Analysis
    console.log('\n📝 ANALYSIS\n');
    console.log('Expected behavior:');
    console.log('1. As write quorum increases, average latency increases');
    console.log('   - Higher quorum = waiting for more followers to acknowledge');
    console.log('   - With random delays [0-1000ms], higher quorum waits for slower replications');
    console.log('');
    console.log('2. With quorum=1, we only wait for the fastest follower');
    console.log('   - Minimum latency, but lower durability guarantee');
    console.log('');
    console.log('3. With quorum=5, we wait for ALL followers');
    console.log('   - Maximum latency (limited by the slowest replica)');
    console.log('   - Highest durability guarantee');
    console.log('');
    // Consistency check
    console.log('\n🔍 CONSISTENCY CHECK');
    console.log('═'.repeat(50));
    console.log('Waiting for final replication to complete...');
    await sleep(5000);
    const consistency = await checkConsistency();
    console.log(`\nConsistency status: ${consistency.consistent ? '✅ CONSISTENT' : '❌ INCONSISTENT'}`);
    console.log('\nDetails:');
    consistency.details.forEach((d) => console.log(`  ${d}`));
    console.log('\n📝 CONSISTENCY ANALYSIS\n');
    console.log('Expected behavior:');
    console.log('1. With semi-synchronous replication, data should eventually be consistent');
    console.log('2. Immediately after writes, some followers might lag behind');
    console.log('   - Due to random delays, some replications complete slower');
    console.log('3. After waiting, all replicas should have the same data');
    console.log('4. The final value for each key should be the last write value');
    console.log('   - Since we write sequentially to same keys, last write wins');
    console.log('');
    // Restore original quorum
    updateQuorum(3);
    console.log('\n✅ Performance test completed!\n');
}
// Entry point
runPerformanceTest().catch((error) => {
    console.error('Performance test failed:', error);
    process.exit(1);
});
