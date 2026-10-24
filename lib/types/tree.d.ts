/**
 * 分支树纯函数：节点表上的 CRUD、环检测、「切换」标记、树渲染。
 * 节点形状 { v,id,parent,title,summary,created,lastUsed }；parentId 以 'root' 表无父。
 */
export declare const ROOT_PARENT = "root";
export interface BranchNode {
    v: 1;
    id: string;
    parent: typeof ROOT_PARENT | string;
    title: string;
    summary: string;
    created: string;
    lastUsed: string;
}
export type AddResult = {
    kind: 'added';
    node: BranchNode;
    items: BranchNode[];
} | {
    kind: 'duplicate';
    node: BranchNode;
    items: BranchNode[];
} | {
    kind: 'empty';
    items: BranchNode[];
} | {
    kind: 'badParent';
    items: BranchNode[];
};
export declare function nextId(items: readonly BranchNode[]): string;
export declare function normalizeSummary(text: string, maxChars: number): string;
/**
 * 新增节点：parent 必须存在（root 除外）；重复标题在同一 parent 下视为重复返回既有节点。
 */
export declare function addBranch(items: readonly BranchNode[], input: {
    title: string;
    summary: string;
    parent?: string;
}, now: string, maxSummaryChars?: number): AddResult;
/** 派生：addBranch 的 parent 语义 + fork 也挂到源节点 */
export declare function forkBranch(items: readonly BranchNode[], parentId: string, input: {
    title: string;
    summary: string;
}, now: string, maxSummaryChars?: number): AddResult;
/** 序列化路径：从根到该 id（不含 root 哨兵）。id 不存在 → undefined。 */
export declare function pathTo(items: readonly BranchNode[], id: string): BranchNode[] | undefined;
/** 以 id 为起点的子孙集合（含自身），用于环检测：parent 存在于自己的子孙内即拒绝。 */
export declare function descendants(items: readonly BranchNode[], id: string): Set<string>;
export type RemoveResult = {
    kind: 'removed';
    items: BranchNode[];
    removed: BranchNode[];
} | {
    kind: 'missing';
    items: BranchNode[];
};
/** 删除：只删自身（不动子孙；它们的 parent 悬空时改挂 root）。 */
export declare function removeBranch(items: readonly BranchNode[], id: string): RemoveResult;
/** 树渲染：└─ 缩进，current 加 [当前]，时间取 lastUsed 日期。 */
export declare function renderTree(items: readonly BranchNode[], currentId?: string): string;
//# sourceMappingURL=tree.d.ts.map