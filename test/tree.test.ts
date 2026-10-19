/** tree.ts 纯函数：CRUD / 环 / 路径 / 渲染。 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ROOT_PARENT,
  addBranch,
  descendants,
  nextId,
  normalizeSummary,
  pathTo,
  removeBranch,
  renderTree,
  type BranchNode,
} from '../src/tree.ts';

const node = (over: Partial<BranchNode>): BranchNode => ({
  v: 1,
  id: '1',
  parent: ROOT_PARENT,
  title: '根话题',
  summary: '摘要',
  created: '2026-10-19T00:00:00.000Z',
  lastUsed: '2026-10-19T00:00:00.000Z',
  ...over,
});

const NOW = '2026-10-19T12:00:00.000Z';

test('nextId 与 normalizeSummary', () => {
  assert.equal(nextId([]), '1');
  assert.equal(nextId([node({ id: '7' }), node({ id: '3' })]), '8');
  assert.equal(nextId([node({ id: 'x1' })]), '1', '非数字不计');
  const squeezed = normalizeSummary('  词1 \n 词2   词3 ', 40);
  assert.equal(squeezed, '词1 词2 词3');
  assert.equal(normalizeSummary('字'.repeat(50), 10).length, 10, '截断后带省略号');
});

test('addBranch：空标题拒、bad parent 拒、重复返回既有', () => {
  assert.equal(addBranch([], { title: ' ', summary: 's' }, NOW).kind, 'empty');
  assert.equal(addBranch([], { title: 'x', summary: 's', parent: '9' }, NOW).kind, 'badParent');

  const added = addBranch([], { title: '根', summary: '根摘要' }, NOW);
  assert.equal(added.kind, 'added');
  if (added.kind !== 'added') return;
  assert.equal(added.node.id, '1');
  assert.equal(added.node.parent, ROOT_PARENT);
  assert.equal(added.node.created, NOW);

  const twin = addBranch(added.items, { title: '根', summary: '其他摘要' }, NOW);
  assert.equal(twin.kind, 'duplicate');
  if (twin.kind === 'duplicate') assert.equal(twin.node.summary, '根摘要');

  // 同标题不同 parent → 不算重复
  const other = addBranch(added.items, { title: '根', summary: 's', parent: '1' }, '2026-10-19T13:00:00.000Z');
  assert.equal(other.kind, 'added');
  if (other.kind === 'added') assert.equal(other.node.id, '2');
});

test('pathTo：根到叶全链，id 缺失 undefined', () => {
  const tree = [
    node({ id: '1' }),
    node({ id: '2', parent: '1', title: '子' }),
    node({ id: '3', parent: '2', title: '孙' }),
  ];
  const chain = pathTo(tree, '3')!;
  assert.equal(chain.length, 3);
  assert.deepEqual(chain.map((item) => item.id), ['1', '2', '3']);
  assert.equal(pathTo(tree, '404'), undefined);
});

test('descendants：子孙集合（含自身）', () => {
  const tree = [node({ id: '1' }), node({ id: '2', parent: '1' }), node({ id: '3', parent: '2' })];
  assert.deepEqual([...descendants(tree, '2')].sort(), ['2', '3']);
  assert.deepEqual([...descendants(tree, '404')], ['404']);
});

test('removeBranch：删自己，子孙 parent 悬空改挂 root', () => {
  const tree = [node({ id: '1' }), node({ id: '2', parent: '1', title: '子' }), node({ id: '3', parent: '2', title: '孙' })];
  const result = removeBranch(tree, '1');
  assert.equal(result.kind, 'removed');
  if (result.kind !== 'removed') return;
  assert.equal(result.items.length, 2);
  assert.equal(result.items.find((item) => item.id === '2')!.parent, ROOT_PARENT);
  assert.equal(removeBranch(tree, '404').kind, 'missing');
});

test('renderTree：树形 + [当前] 标记 + 空树引导语', () => {
  const tree = [node({ id: '1', title: '根话题' }), node({ id: '2', parent: '1', title: '子话题' })];
  const text = renderTree(tree, '2');
  assert.match(text, /分支树（当前 #2）/);
  assert.match(text, /\[#1\] 根话题/);
  assert.match(text, /└─ \[#2\] 子话题 \[当前\]/);
  assert.match(renderTree([], '9'), /还没有分支/);
});
