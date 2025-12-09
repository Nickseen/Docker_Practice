"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
function loadConfig() {
    const role = (process.env.ROLE || 'follower');
    const port = parseInt(process.env.PORT || '8080', 10);
    const nodeId = process.env.NODE_ID || `node-${Date.now()}`;
    const config = {
        role,
        port,
        nodeId,
    };
    if (role === 'leader') {
        // Parse followers from comma-separated list
        const followersEnv = process.env.FOLLOWERS || '';
        config.followers = followersEnv
            .split(',')
            .map((f) => f.trim())
            .filter((f) => f.length > 0);
        config.writeQuorum = parseInt(process.env.WRITE_QUORUM || '1', 10);
        config.minDelay = parseInt(process.env.MIN_DELAY || '0', 10);
        config.maxDelay = parseInt(process.env.MAX_DELAY || '1000', 10);
        console.log(`[${nodeId}] Leader config:`, {
            followers: config.followers,
            writeQuorum: config.writeQuorum,
            minDelay: config.minDelay,
            maxDelay: config.maxDelay,
        });
    }
    return config;
}
