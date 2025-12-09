"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replicateToFollowers = replicateToFollowers;
const axios_1 = __importDefault(require("axios"));
// Utility function to create a random delay
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
// Sleep for a specified number of milliseconds
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
// Replicate data to a single follower with configurable delay
async function replicateToFollower(followerUrl, data, minDelay, maxDelay, nodeId) {
    const startTime = Date.now();
    const delay = randomDelay(minDelay, maxDelay);
    console.log(`[${nodeId}] Replicating to ${followerUrl} with ${delay}ms delay`);
    try {
        // Add delay before sending to simulate network lag
        await sleep(delay);
        const response = await axios_1.default.post(`${followerUrl}/replicate`, data, {
            timeout: 10000, // 10 second timeout
            headers: { 'Content-Type': 'application/json' },
        });
        const latency = Date.now() - startTime;
        console.log(`[${nodeId}] Replication to ${followerUrl} succeeded in ${latency}ms`);
        return {
            follower: followerUrl,
            success: response.data.success,
            latency,
        };
    }
    catch (error) {
        const latency = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[${nodeId}] Replication to ${followerUrl} failed: ${errorMessage}`);
        return {
            follower: followerUrl,
            success: false,
            latency,
            error: errorMessage,
        };
    }
}
// Semi-synchronous replication to multiple followers
// Returns when writeQuorum followers have acknowledged
async function replicateToFollowers(followers, key, value, writeQuorum, minDelay, maxDelay, nodeId) {
    const timestamp = Date.now();
    const replicateRequest = { key, value, timestamp };
    console.log(`[${nodeId}] Starting replication to ${followers.length} followers, quorum: ${writeQuorum}`);
    // Start all replication requests concurrently
    const replicationPromises = followers.map((follower) => replicateToFollower(follower, replicateRequest, minDelay, maxDelay, nodeId));
    // Use Promise.allSettled to wait for all, but we'll track acknowledgments
    const results = [];
    let acknowledgedCount = 0;
    // Create a promise that resolves when quorum is reached
    return new Promise((resolve) => {
        let resolved = false;
        // Process each replication result as it completes
        replicationPromises.forEach((promise) => {
            promise.then((result) => {
                results.push(result);
                if (result.success) {
                    acknowledgedCount++;
                    console.log(`[${nodeId}] ACK received from ${result.follower}, count: ${acknowledgedCount}/${writeQuorum}`);
                }
                // Check if quorum is reached
                if (!resolved && acknowledgedCount >= writeQuorum) {
                    resolved = true;
                    console.log(`[${nodeId}] Write quorum reached!`);
                    resolve({
                        success: true,
                        acknowledgedBy: acknowledgedCount,
                        totalFollowers: followers.length,
                        results,
                    });
                }
                // Check if all responses received and quorum not reached
                if (!resolved && results.length === followers.length) {
                    resolved = true;
                    console.log(`[${nodeId}] All responses received, quorum NOT reached: ${acknowledgedCount}/${writeQuorum}`);
                    resolve({
                        success: acknowledgedCount >= writeQuorum,
                        acknowledgedBy: acknowledgedCount,
                        totalFollowers: followers.length,
                        results,
                    });
                }
            });
        });
        // Safety: if no followers, resolve immediately
        if (followers.length === 0) {
            resolve({
                success: writeQuorum === 0,
                acknowledgedBy: 0,
                totalFollowers: 0,
                results: [],
            });
        }
    });
}
