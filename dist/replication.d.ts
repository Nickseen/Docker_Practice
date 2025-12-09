interface ReplicationResult {
    follower: string;
    success: boolean;
    latency: number;
    error?: string;
}
export declare function replicateToFollowers(followers: string[], key: string, value: unknown, writeQuorum: number, minDelay: number, maxDelay: number, nodeId: string): Promise<{
    success: boolean;
    acknowledgedBy: number;
    totalFollowers: number;
    results: ReplicationResult[];
}>;
export {};
