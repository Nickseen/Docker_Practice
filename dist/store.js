"use strict";
// In-memory key-value store with concurrent access support
Object.defineProperty(exports, "__esModule", { value: true });
exports.KVStore = void 0;
class KVStore {
    data = new Map();
    nodeId;
    constructor(nodeId) {
        this.nodeId = nodeId;
    }
    set(key, value) {
        this.data.set(key, value);
        console.log(`[${this.nodeId}] SET ${key} = ${JSON.stringify(value)}`);
    }
    get(key) {
        const value = this.data.get(key);
        console.log(`[${this.nodeId}] GET ${key} = ${JSON.stringify(value)}`);
        return value;
    }
    has(key) {
        return this.data.has(key);
    }
    delete(key) {
        const result = this.data.delete(key);
        console.log(`[${this.nodeId}] DELETE ${key} = ${result}`);
        return result;
    }
    getAll() {
        const result = {};
        this.data.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    size() {
        return this.data.size;
    }
    clear() {
        this.data.clear();
        console.log(`[${this.nodeId}] CLEAR all data`);
    }
}
exports.KVStore = KVStore;
