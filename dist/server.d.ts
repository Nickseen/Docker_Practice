import { Config } from './types';
import { KVStore } from './store';
export declare function createServer(config: Config, store: KVStore): import("express-serve-static-core").Express;
