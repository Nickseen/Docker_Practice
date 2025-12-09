export declare class KVStore {
    private data;
    private nodeId;
    constructor(nodeId: string);
    set(key: string, value: unknown): void;
    get(key: string): unknown | undefined;
    has(key: string): boolean;
    delete(key: string): boolean;
    getAll(): Record<string, unknown>;
    size(): number;
    clear(): void;
}
