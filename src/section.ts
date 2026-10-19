/**
 * systemPrompt 段渲染：当前分支的脉络（标题 + 简短链路 + 摘要）。
 * 无当前分支 → 空段（宿主通常跳过空 section）。
 */

import { pathTo, type BranchNode } from './tree.ts';

export const SECTION_HEADER = '## 当前分支脉络';

export interface Record {
  items: readonly BranchNode[];
  currentId?: string;
}

export function renderSection(items: readonly BranchNode[], currentId: string | undefined, maxChars: number): string {
  if (!currentId) return '';
  const current = items.find((item) => item.id === currentId);
  if (!current) return '';
  const chain = pathTo(items, currentId) ?? [current];
  const chainLine = chain.length <= 1
    ? '#根分支'
    : chain.slice(0, -1).map((node) => `#${node.id} ${node.title}`).join(' → ');
  const summary = current.summary.length > maxChars ? `${current.summary.slice(0, maxChars - 1)}…` : current.summary;
  return [
    SECTION_HEADER,
    `当前分支 #${current.id}「${current.title}」（链路：${chainLine}）。`,
    '继续对话请默认沿用该分支的上下文；用户说"切回去/新的一路"时用 /branch 观察。',
    '',
    summary,
  ].join('\n');
}
