/** store.ts：jsonl 坏行兼容 + 锁下 mutate 落盘真实读写。 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';

import { BranchStore, parseLibrary } from '../src/store.ts';
import { ROOT_PARENT, addBranch, type BranchNode } from '../src/tree.ts';

const dir = mkdtempSync(join(tmpdir(), 'branch-store-'));
after(() => rmSync(dir, { recursive: true, force: true }));

test('parseLibrary：坏行计数好行恢复', () => {
  const { items, skipped } = parseLibrary([
    JSON.stringify({ v: 1, id: '1', title: 'a', summary: 's', parent: ROOT_PARENT, created: 't', lastUsed: 't' }),
    'not json',
    JSON.stringify({ v: 2, id: '2', title: '版本不符丢弃' }),
    '',
  ].join('\n'));
  assert.equal(items.length, 1);
  assert.equal(skipped, 2);
  assert.deepEqual((items[0] as BranchNode).parent, ROOT_PARENT);
});

test('BranchStore：mutate 真写真读 + skipped 报告', () => {
  const store = new BranchStore(join(dir, 'branches.jsonl'));
  const afterFirst = store.mutate((items) => {
    const result = addBranch(items, { title: '第一支', summary: 's' }, '2026-10-19T00:00:00.000Z');
    return result.kind === 'added' ? result.items : items;
  });
  assert.equal(afterFirst.length, 1);
  const afterSecond = store.mutate((items) => {
    const result = addBranch(items, { title: '第二支', summary: 's2' }, '2026-10-19T00:00:00.000Z');
    return result.kind === 'added' ? result.items : items;
  });
  assert.equal(afterSecond.length, 2);
  const onDisk = readFileSync(store.path, 'utf8');
  assert.match(onDisk, /第一支/);
  assert.match(onDisk, /第二支/);
  assert.equal(store.skippedOf(), 0);
  assert.equal(store.load().length, 2);
});

test('BranchStore：坏 jsonl 行保留计数，可 mutate 覆盖保存', () => {
  const badPath = join(dir, 'bad.jsonl');
  writeFileSync(badPath, 'garbage line\n');
  const store = new BranchStore(badPath);
  assert.equal(store.skippedOf(), 1, 'garbage 被跳过不崩');
  assert.equal(store.load().length, 0);
});
