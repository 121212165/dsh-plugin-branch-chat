/**
 * 分支树纯函数：节点表上的 CRUD、环检测、「切换」标记、树渲染。
 * 节点形状 { v,id,parent,title,summary,created,lastUsed }；parentId 以 'root' 表无父。
 */

export const ROOT_PARENT = 'root';

export interface BranchNode {
  v: 1;
  id: string;
  parent: typeof ROOT_PARENT | string;
  title: string;
  summary: string;
  created: string;
  lastUsed: string;
}

export type AddResult =
  | { kind: 'added'; node: BranchNode; items: BranchNode[] }
  | { kind: 'duplicate'; node: BranchNode; items: BranchNode[] }
  | { kind: 'empty'; items: BranchNode[] }
  | { kind: 'badParent'; items: BranchNode[] };

export function nextId(items: readonly BranchNode[]): string {
  let max = 0;
  for (const item of items) {
    const numeric = Number(item.id);
    if (Number.isInteger(numeric) && numeric > max) max = numeric;
  }
  return String(max + 1);
}

export function normalizeSummary(text: string, maxChars: number): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length > maxChars ? `${single.slice(0, Math.max(0, maxChars - 1))}…` : single;
}

/**
 * 新增节点：parent 必须存在（root 除外）；重复标题在同一 parent 下视为重复返回既有节点。
 */
export function addBranch(items: readonly BranchNode[], input: { title: string; summary: string; parent?: string }, now: string, maxSummaryChars = 800): AddResult {
  const title = input.title.trim();
  if (!title) return { kind: 'empty', items: [...items] };
  const parent = input.parent ?? ROOT_PARENT;
  if (parent !== ROOT_PARENT && !items.some((item) => item.id === parent)) {
    return { kind: 'badParent', items: [...items] };
  }
  const summary = normalizeSummary(input.summary, maxSummaryChars);
  const twin = items.find((item) => item.parent === parent && item.title === title);
  if (twin) return { kind: 'duplicate', node: twin, items: [...items] };
  const node: BranchNode = { v: 1, id: nextId(items), parent, title, summary, created: now, lastUsed: now };
  return { kind: 'added', node, items: [...items, node] };
}

/** 派生：addBranch 的 parent 语义 + fork 也挂到源节点 */
export function forkBranch(items: readonly BranchNode[], parentId: string, input: { title: string; summary: string }, now: string, maxSummaryChars = 800): AddResult {
  return addBranch(items, { ...input, parent: parentId === ROOT_PARENT ? ROOT_PARENT : parentId }, now, maxSummaryChars);
}

/** 序列化路径：从根到该 id（不含 root 哨兵）。id 不存在 → undefined。 */
export function pathTo(items: readonly BranchNode[], id: string): BranchNode[] | undefined {
  const byId = new Map(items.map((item) => [item.id, item] as const));
  if (!byId.has(id)) return undefined;
  const chain: BranchNode[] = [];
  let cursor: string | undefined = id;
  const guard = new Set<string>();
  while (cursor && cursor !== ROOT_PARENT) {
    if (guard.has(cursor)) return undefined; // 环：数据损坏
    guard.add(cursor);
    const node = byId.get(cursor);
    if (!node) return undefined;
    chain.unshift(node);
    cursor = node.parent;
  }
  return chain;
}

/** 以 id 为起点的子孙集合（含自身），用于环检测：parent 存在于自己的子孙内即拒绝。 */
export function descendants(items: readonly BranchNode[], id: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const item of items) {
    if (item.parent === ROOT_PARENT) continue;
    children.set(item.parent, [...children.get(item.parent) ?? [], item.id]);
  }
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const child of children.get(current) ?? []) stack.push(child);
  }
  return seen;
}

export type RemoveResult = { kind: 'removed'; items: BranchNode[]; removed: BranchNode[] } | { kind: 'missing'; items: BranchNode[] };

/** 删除：只删自身（不动子孙；它们的 parent 悬空时改挂 root）。 */
export function removeBranch(items: readonly BranchNode[], id: string): RemoveResult {
  if (!items.some((item) => item.id === id)) return { kind: 'missing', items: [...items] };
  const removed = items.filter((item) => item.id === id);
  const kept = items
    .filter((item) => item.id !== id)
    .map((item) => (item.parent === id ? { ...item, parent: ROOT_PARENT } : item));
  return { kind: 'removed', items: kept, removed };
}

/** 树渲染：└─ 缩进，current 加 [当前]，时间取 lastUsed 日期。 */
export function renderTree(items: readonly BranchNode[], currentId?: string): string {
  if (!items.length) return '还没有分支。/branch save <标题> 建第一个。';
  const childrenOf = new Map<string, BranchNode[]>();
  for (const item of items) {
    childrenOf.set(item.parent, [...childrenOf.get(item.parent) ?? [], item]);
  }
  const sortSiblings = (nodes: BranchNode[]) => [...nodes].sort((a, b) => Number(a.id) - Number(b.id));
  const lines: string[] = [`分支树（当前${currentId ? ` #${currentId}` : '无'}）：`];
  const walk = (parent: string, depth: number) => {
    for (const node of sortSiblings(childrenOf.get(parent) ?? [])) {
      const indent = '  '.repeat(depth);
      const bullet = depth === 0 ? '·' : '└─';
      const mark = node.id === currentId ? ' [当前]' : '';
      const when = node.lastUsed.slice(0, 10);
      const brief = node.summary.length > 40 ? `${node.summary.slice(0, 40)}…` : node.summary;
      lines.push(`${indent}${bullet} [#${node.id}] ${node.title}${mark} (${when}) ${brief}`);
      walk(node.id, depth + 1);
    }
  };
  walk(ROOT_PARENT, 0);
  return lines.join('\n');
}
