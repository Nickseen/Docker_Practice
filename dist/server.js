"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
const express_1 = __importDefault(require("express"));
const replication_1 = require("./replication");
function createServer(config, store) {
    const app = (0, express_1.default)();
    app.use(express_1.default.json());
    // Root endpoint - info about the node
    app.get('/', (_req, res) => {
        res.json({
            name: 'Key-Value Store with Single-Leader Replication',
            role: config.role,
            nodeId: config.nodeId,
            endpoints: {
                'GET /': 'This info',
                'GET /health': 'Health check',
                'GET /read?key=X': 'Read value by key',
                'GET /data': 'Get all stored data',
                'POST /write': 'Write key-value (leader only)',
                'POST /replicate': 'Receive replication (follower only)',
                'POST /clear': 'Clear all data',
            },
        });
    });
    // Health check endpoint
    app.get('/health', (_req, res) => {
        res.json({
            status: 'healthy',
            role: config.role,
            id: config.nodeId,
            dataCount: store.size(),
        });
    });
    // Read endpoint - available on both leader and followers
    app.get('/read', (req, res) => {
        const key = req.query.key;
        if (!key) {
            res.status(400).json({
                success: false,
                key: '',
                value: null,
                message: 'Key is required',
            });
            return;
        }
        const value = store.get(key);
        res.json({
            success: true,
            key,
            value: value !== undefined ? value : null,
        });
    });
    // Get all data endpoint - for testing/verification
    app.get('/data', (_req, res) => {
        res.json({
            success: true,
            data: store.getAll(),
        });
    });
    if (config.role === 'leader') {
        // Write endpoint - only on leader
        app.post('/write', async (req, res) => {
            const { key, value } = req.body;
            if (!key) {
                res.status(400).json({
                    success: false,
                    message: 'Key is required',
                });
                return;
            }
            // Store locally first
            store.set(key, value);
            // Replicate to followers using semi-synchronous replication
            const followers = config.followers || [];
            const writeQuorum = config.writeQuorum || 1;
            const minDelay = config.minDelay || 0;
            const maxDelay = config.maxDelay || 1000;
            if (followers.length === 0) {
                res.json({
                    success: true,
                    message: 'Write successful (no followers configured)',
                    acknowledgedBy: 0,
                    totalFollowers: 0,
                });
                return;
            }
            try {
                const result = await (0, replication_1.replicateToFollowers)(followers, key, value, writeQuorum, minDelay, maxDelay, config.nodeId);
                if (result.success) {
                    res.json({
                        success: true,
                        message: `Write successful, acknowledged by ${result.acknowledgedBy}/${result.totalFollowers} followers`,
                        acknowledgedBy: result.acknowledgedBy,
                        totalFollowers: result.totalFollowers,
                    });
                }
                else {
                    res.status(500).json({
                        success: false,
                        message: `Write quorum not reached: ${result.acknowledgedBy}/${writeQuorum} required`,
                        acknowledgedBy: result.acknowledgedBy,
                        totalFollowers: result.totalFollowers,
                    });
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                res.status(500).json({
                    success: false,
                    message: `Replication failed: ${errorMessage}`,
                });
            }
        });
    }
    if (config.role === 'follower') {
        // Replicate endpoint - only on followers
        app.post('/replicate', (req, res) => {
            const { key, value, timestamp } = req.body;
            if (!key) {
                res.status(400).json({
                    success: false,
                    followerId: config.nodeId,
                });
                return;
            }
            console.log(`[${config.nodeId}] Received replication request: ${key}=${JSON.stringify(value)} (timestamp: ${timestamp})`);
            store.set(key, value);
            res.json({
                success: true,
                followerId: config.nodeId,
            });
        });
    }
    // Clear data endpoint - for testing
    app.post('/clear', (_req, res) => {
        store.clear();
        res.json({ success: true, message: 'Data cleared' });
    });
    return app;
}
