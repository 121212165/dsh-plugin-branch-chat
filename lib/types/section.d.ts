/**
 * systemPrompt 段渲染：当前分支的脉络（标题 + 简短链路 + 摘要）。
 * 无当前分支 → 空段（宿主通常跳过空 section）。
 */
import { type BranchNode } from './tree.ts';
export declare const SECTION_HEADER = "## \u5F53\u524D\u5206\u652F\u8109\u7EDC";
export interface Record {
    items: readonly BranchNode[];
    currentId?: string;
}
export declare function renderSection(items: readonly BranchNode[], currentId: string | undefined, maxChars: number): string;
//# sourceMappingURL=section.d.ts.map