"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const store_1 = require("./store");
const server_1 = require("./server");
async function main() {
    const config = (0, config_1.loadConfig)();
    const store = new store_1.KVStore(config.nodeId);
    const app = (0, server_1.createServer)(config, store);
    app.listen(config.port, () => {
        console.log(`[${config.nodeId}] ${config.role.toUpperCase()} started on port ${config.port}`);
        if (config.role === 'leader') {
            console.log(`[${config.nodeId}] Followers: ${config.followers?.join(', ') || 'none'}`);
            console.log(`[${config.nodeId}] Write quorum: ${config.writeQuorum}`);
            console.log(`[${config.nodeId}] Delay range: [${config.minDelay}ms, ${config.maxDelay}ms]`);
        }
    });
}
main().catch(console.error);
