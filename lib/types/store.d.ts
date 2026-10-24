/**
 * jsonl 存储（pinboard 同款：临时文件 + rename + advisory lock + mutate）。
 */
import { type BranchNode } from './tree.ts';
export declare const LOCK_TIMEOUT_MS = 400;
export declare const LOCK_STALE_MS = 5000;
export declare function expandHome(path: string): string;
export declare function acquireLock(lockPath: string): boolean;
export declare function parseLibrary(text: string): {
    items: BranchNode[];
    skipped: number;
};
export declare class BranchStore {
    readonly path: string;
    warn?: (message: string) => void;
    constructor(dataPath: string | undefined);
    load(): BranchNode[];
    skippedOf(): number;
    save(items: readonly BranchNode[]): void;
    /** 唯一写路径：lock 下 load-modify-write，写前重读。 */
    mutate(fn: (items: BranchNode[]) => BranchNode[]): BranchNode[];
}
//# sourceMappingURL=store.d.ts.map