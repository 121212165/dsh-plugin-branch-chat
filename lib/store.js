/**
 * jsonl 存储（pinboard 同款：临时文件 + rename + advisory lock + mutate）。
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { ROOT_PARENT } from './tree.js';
export const LOCK_TIMEOUT_MS = 400;
export const LOCK_STALE_MS = 5000;
export function expandHome(path) {
    return path.startsWith('~') ? join(homedir(), path.slice(1)) : path;
}
export function acquireLock(lockPath) {
    const deadline = Date.now() + LOCK_TIMEOUT_MS;
    for (;;) {
        try {
            closeSync(openSync(lockPath, 'wx'));
            return true;
        }
        catch (error) {
            if (error.code !== 'EEXIST')
                return true;
            if (Date.now() >= deadline)
                return false;
            try {
                if (Date.now() - statSync(lockPath).mtimeMs > LOCK_STALE_MS)
                    unlinkSync(lockPath);
            }
            catch {
                // 白拿下一轮 create
            }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        }
    }
}
export function parseLibrary(text) {
    const items = [];
    let skipped = 0;
    for (const line of text.split(/\r?\n/)) {
        if (!line.trim())
            continue;
        try {
            const value = JSON.parse(line);
            if (value.v !== 1 || typeof value.id !== 'string' || typeof value.title !== 'string') {
                skipped++;
                continue;
            }
            items.push({
                v: 1,
                id: value.id,
                parent: typeof value.parent === 'string' ? value.parent : ROOT_PARENT,
                title: value.title,
                summary: typeof value.summary === 'string' ? value.summary : '',
                created: typeof value.created === 'string' ? value.created : '',
                lastUsed: typeof value.lastUsed === 'string' ? value.lastUsed : value.created ?? '',
            });
        }
        catch {
            skipped++;
        }
    }
    return { items, skipped };
}
export class BranchStore {
    path;
    warn;
    constructor(dataPath) {
        this.path = dataPath ? expandHome(dataPath) : join(homedir(), '.dsh', 'branch-chat', 'branches.jsonl');
    }
    load() {
        if (!existsSync(this.path))
            return [];
        return parseLibrary(readFileSync(this.path, 'utf8')).items;
    }
    skippedOf() {
        if (!existsSync(this.path))
            return 0;
        return parseLibrary(readFileSync(this.path, 'utf8')).skipped;
    }
    save(items) {
        mkdirSync(dirname(this.path), { recursive: true });
        const tmp = join(dirname(this.path), `.branches-${process.pid}-${Date.now()}.tmp`);
        writeFileSync(tmp, items.map((item) => JSON.stringify(item)).join('\n') + '\n', 'utf8');
        renameSync(tmp, this.path);
    }
    /** 唯一写路径：lock 下 load-modify-write，写前重读。 */
    mutate(fn) {
        mkdirSync(dirname(this.path), { recursive: true });
        const lockPath = `${this.path}.lock`;
        const locked = acquireLock(lockPath);
        if (!locked)
            this.warn?.('branch-chat lock busy — 无锁写入');
        try {
            const next = fn(this.load());
            this.save(next);
            return next;
        }
        finally {
            if (locked) {
                try {
                    unlinkSync(lockPath);
                }
                catch {
                    // stale-lock 抢占竞态：无人可解，让下轮处理
                }
            }
        }
    }
}
//# sourceMappingURL=store.js.map