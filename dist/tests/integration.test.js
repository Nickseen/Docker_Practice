"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const LEADER_URL = process.env.LEADER_URL || 'http://localhost:8080';
const FOLLOWER_URLS = (process.env.FOLLOWER_URLS ||
    'http://localhost:8081,http://localhost:8082,http://localhost:8083,http://localhost:8084,http://localhost:8085')
    .split(',')
    .map((url) => url.trim());
// Utility to sleep
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
async function test(name, fn) {
    try {
        await fn();
        results.push({ name, passed: true });
        console.log(`✅ ${name}`);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.push({ name, passed: false, error: errorMessage });
        console.log(`❌ ${name}: ${errorMessage}`);
    }
}
async function clearAllData() {
    // Clear leader
    await axios_1.default.post(`${LEADER_URL}/clear`);
    // Clear all followers
    for (const url of FOLLOWER_URLS) {
        try {
            await axios_1.default.post(`${url}/clear`);
        }
        catch {
            // Ignore errors during cleanup
        }
    }
}
async function runTests() {
    console.log('\n🧪 Starting Integration Tests\n');
    console.log(`Leader: ${LEADER_URL}`);
    console.log(`Followers: ${FOLLOWER_URLS.join(', ')}\n`);
    // Test 1: Health checks
    await test('Leader health check', async () => {
        const response = await axios_1.default.get(`${LEADER_URL}/health`);
        if (response.data.role !== 'leader') {
            throw new Error(`Expected role 'leader', got '${response.data.role}'`);
        }
    });
    await test('Follower health checks', async () => {
        for (const url of FOLLOWER_URLS) {
            const response = await axios_1.default.get(`${url}/health`);
            if (response.data.role !== 'follower') {
                throw new Error(`Expected role 'follower' for ${url}, got '${response.data.role}'`);
            }
        }
    });
    // Clear data before tests
    await clearAllData();
    // Test 2: Basic write and read
    await test('Write to leader', async () => {
        const response = await axios_1.default.post(`${LEADER_URL}/write`, {
            key: 'test-key-1',
            value: 'test-value-1',
        });
        if (!response.data.success) {
            throw new Error('Write failed');
        }
    });
    await test('Read from leader', async () => {
        const response = await axios_1.default.get(`${LEADER_URL}/read?key=test-key-1`);
        if (response.data.value !== 'test-value-1') {
            throw new Error(`Expected 'test-value-1', got '${response.data.value}'`);
        }
    });
    // Test 3: Replication check (with delay for propagation)
    await test('Data replicated to followers', async () => {
        // Wait for replication to complete
        await sleep(2000);
        for (const url of FOLLOWER_URLS) {
            const response = await axios_1.default.get(`${url}/read?key=test-key-1`);
            if (response.data.value !== 'test-value-1') {
                throw new Error(`Follower ${url} has wrong value: '${response.data.value}'`);
            }
        }
    });
    // Test 4: Multiple writes
    await test('Multiple concurrent writes', async () => {
        const writePromises = [];
        for (let i = 0; i < 5; i++) {
            writePromises.push(axios_1.default.post(`${LEADER_URL}/write`, {
                key: `concurrent-key-${i}`,
                value: `concurrent-value-${i}`,
            }));
        }
        const responses = await Promise.all(writePromises);
        for (const response of responses) {
            if (!response.data.success) {
                throw new Error('One of the concurrent writes failed');
            }
        }
    });
    // Test 5: Verify consistency after concurrent writes
    await test('Consistency after concurrent writes', async () => {
        await sleep(3000); // Wait for all replications
        const leaderData = (await axios_1.default.get(`${LEADER_URL}/data`)).data.data;
        for (const url of FOLLOWER_URLS) {
            const followerData = (await axios_1.default.get(`${url}/data`)).data.data;
            for (let i = 0; i < 5; i++) {
                const key = `concurrent-key-${i}`;
                if (followerData[key] !== leaderData[key]) {
                    throw new Error(`Mismatch at ${url} for ${key}: leader='${leaderData[key]}', follower='${followerData[key]}'`);
                }
            }
        }
    });
    // Test 6: Complex value types
    await test('Write complex objects', async () => {
        const complexValue = {
            name: 'test',
            count: 42,
            nested: { a: 1, b: [1, 2, 3] },
        };
        const response = await axios_1.default.post(`${LEADER_URL}/write`, {
            key: 'complex-key',
            value: complexValue,
        });
        if (!response.data.success) {
            throw new Error('Write failed');
        }
        await sleep(2000);
        const readResponse = await axios_1.default.get(`${LEADER_URL}/read?key=complex-key`);
        if (JSON.stringify(readResponse.data.value) !== JSON.stringify(complexValue)) {
            throw new Error('Complex value mismatch');
        }
    });
    // Test 7: Read non-existent key
    await test('Read non-existent key returns null', async () => {
        const response = await axios_1.default.get(`${LEADER_URL}/read?key=non-existent-key`);
        if (response.data.value !== null) {
            throw new Error(`Expected null, got '${response.data.value}'`);
        }
    });
    // Print summary
    console.log('\n📊 Test Summary');
    console.log('================');
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    console.log(`Passed: ${passed}/${results.length}`);
    console.log(`Failed: ${failed}/${results.length}`);
    if (failed > 0) {
        console.log('\n❌ Failed tests:');
        results
            .filter((r) => !r.passed)
            .forEach((r) => console.log(`  - ${r.name}: ${r.error}`));
        process.exit(1);
    }
    console.log('\n✅ All tests passed!\n');
}
runTests().catch((error) => {
    console.error('Test runner failed:', error);
    process.exit(1);
});
