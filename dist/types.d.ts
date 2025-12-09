export interface KeyValue {
    key: string;
    value: unknown;
}
export interface WriteRequest {
    key: string;
    value: unknown;
}
export interface WriteResponse {
    success: boolean;
    message: string;
    acknowledgedBy?: number;
    totalFollowers?: number;
}
export interface ReadResponse {
    success: boolean;
    key: string;
    value: unknown | null;
    message?: string;
}
export interface ReplicateRequest {
    key: string;
    value: unknown;
    timestamp: number;
}
export interface ReplicateResponse {
    success: boolean;
    followerId: string;
}
export interface HealthResponse {
    status: 'healthy';
    role: 'leader' | 'follower';
    id: string;
    dataCount: number;
}
export interface AllDataResponse {
    success: boolean;
    data: Record<string, unknown>;
}
export interface Config {
    role: 'leader' | 'follower';
    port: number;
    nodeId: string;
    followers?: string[];
    writeQuorum?: number;
    minDelay?: number;
    maxDelay?: number;
}
