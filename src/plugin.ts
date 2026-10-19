/**
 * dsh wiring for branch-chat：会话内分叉对话。/branch save 提存脉节点，
 * /branch use 切换即注入该分支脉络；"/branch leave"←不对，写清楚：
 * current 状态存 ~/.dsh/branch-chat/current.json，跨会话保留。
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-commands';
import type {} from '@deepseek-ai/dsh-system-prompt';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  addBranch,
  normalizeSummary,
  renderTree,
} from './tree.ts';
import { BranchStore, expandHome } from './store.ts';
import { renderSection } from './section.ts';

export const name = 'branch-chat';
export const inject = ['commands', 'tools', 'systemPrompt'];

export interface Config {
  enabled: boolean;
  dataPath?: string;
  tailTurns: number;
  maxSummaryChars: number;
  order: number;
}

export const Config = Schema.object({
  enabled: Schema.boolean().default(true),
  dataPath: Schema.string(),
  tailTurns: Schema.natural().default(6),
  maxSummaryChars: Schema.natural().default(800),
  order: Schema.number().default(720),
});

class CurrentState {
  readonly path: string;
  constructor(dataPath: string | undefined) {
    const base = dataPath ? dirname(expandHome(dataPath)) : join(homedir(), '.dsh', 'branch-chat');
    this.path = join(base, 'current.json');
  }
  read(): string | undefined {
    try {
      const value = JSON.parse(readFileSync(this.path, 'utf8')) as { currentId?: string };
      return typeof value.currentId === 'string' && value.currentId ? value.currentId : undefined;
    } catch {
      return undefined;
    }
  }
  write(currentId: string | undefined): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify({ currentId: currentId ?? null })}\n`, 'utf8');
  }
}

const lo = (t: string) => t;

export interface Hooks {
  /** 返回最近对话的拼接文本（限长约 5KB）；不传则摘要记"尚无脉络可存" */
  tailProvider?: () => string;
}

export function apply(ctx: Context, config: Config, hooks?: Hooks): void {
  const log = ctx.logger(name);
  if (!config.enabled) return void log.info('disabled by config');
  if (config.tailTurns < 1) throw new TypeError('branch-chat: tailTurns 必须 ≥ 1');
  if (config.maxSummaryChars < 40) throw new TypeError('branch-chat: maxSummaryChars 至少 40');
  const store = new BranchStore(config.dataPath);
  store.warn = (message) => log.warn(message);
  const state = new CurrentState(config.dataPath);

  /** 取"最近对话文本"的回调：真实宿主由 sessions 逻辑填充；测试可注入。 */
  let tailProvider: () => string = hooks?.tailProvider ?? (() => '');

  const summarize = (limit = config.tailTurns): string => {
    const tail = tailProvider().trim();
    if (tail) return normalizeSummary(tail, config.maxSummaryChars * limit);
    return '（尚无脉络可存）';
  };

  const addFromInput = (title: string, parent?: string, summaryOverride?: string) => {
    const now = new Date().toISOString();
    let result!: ReturnType<typeof addBranch>;
    store.mutate((items) => {
      result = addBranch(items, parent === undefined ? { title, summary: summaryOverride ?? summarize() } : { title, summary: summaryOverride ?? summarize(), parent }, now, config.maxSummaryChars);
      if (result.kind === 'added') return result.items;
      return items;
    });
    return result;
  };

  ctx.systemPrompt.section({
    name,
    order: config.order,
    text: () => {
      try {
        return renderSection(store.load(), state.read(), config.maxSummaryChars);
      } catch (error) {
        log.warn(`branch-chat section skipped: ${String(error)}`);
        return '';
      }
    },
  });

  ctx.commands.register({
    name: 'branch',
    description: '会话分支：/branch save <标题> | use <id> | fork <id> <标题> | list',
    input: { hint: '<save|use|fork|list> …' },
    handler: ({ rawInput }) => {
      const raw = String(rawInput ?? '').trim();
      const [verb = '', ...rest] = raw.split(/\s+/);
      const items = store.load();
      const currentId = state.read();
      if (!verb || verb === 'list') {
        const text = renderTree(items, currentId);
        const skipped = store.skippedOf();
        return { kind: 'success', text: skipped ? `${text}\n⚠ ${skipped} 行损坏被跳过` : text };
      }
      if (verb === 'save') {
        const title = rest.join(' ').trim();
        if (!title) return { kind: 'error', text: '用法：/branch save <标题>' };
        const result = addFromInput(title);
        if (result.kind === 'empty') return { kind: 'error', text: '标题为空。/branch save <标题>' };
        if (result.kind === 'badParent') return { kind: 'error', text: '父分支不存在，/branch list 查看可用 id' };
        if (result.kind === 'duplicate') {
          state.write(result.node.id);
          return { kind: 'success', text: `同标题分支已存在：#${result.node.id}「${result.node.title}」——已切到它。` };
        }
        state.write(result.node.id);
        return { kind: 'success', text: `已存分支 #${result.node.id}「${title}」（摘要 ${result.node.summary.length} 字，注入下一个回合）。` };
      }
      if (verb === 'use') {
        const id = rest[0]?.replace(/^#/, '') ?? '';
        if (!id) return { kind: 'error', text: '用法：/branch use <id>（id 见 /branch list）' };
        if (!items.some((item) => item.id === id)) return { kind: 'error', text: `没有 #${id}，/branch list 查看可用 id` };
        state.write(id);
        store.mutate((loaded) => loaded.map((item) => (item.id === id ? { ...item, lastUsed: new Date().toISOString() } : item)));
        return { kind: 'success', text: `已切到 #${id}。其脉络将注入下一个回合。` };
      }
      if (verb === 'fork') {
        const parent = rest.shift()?.replace(/^#/, '') ?? '';
        const title = rest.join(' ').trim();
        if (!parent || !title) return { kind: 'error', text: '用法：/branch fork <父id> <标题>' };
        let text = '';
        store.mutate((loaded) => {
          const result = addBranch(loaded, { title, summary: summarize(), parent }, new Date().toISOString(), config.maxSummaryChars);
          if (result.kind === 'added') {
            state.write(result.node.id);
            text = `已从 #${parent} 派生 #${result.node.id}「${title}」（注入下一个回合）。`;
            return result.items;
          }
          if (result.kind === 'duplicate') text = `同标题子分支已存在：#${result.node.id}，已切到它。`;
          text = result.kind === 'badParent' ? `父分支 #${parent} 不存在，/branch list 查看` : '标题为空。';
          return loaded;
        });
        return { kind: text.startsWith('已从') ? 'success' : 'error', text };
      }
      return { kind: 'error', text: `不认识的动作「${lo(verb)}」。可用：save / use / fork / list` };
    },
  });

  ctx.tools.register(
    defineTool({
      name: 'branch_save',
      description: '把当前对话脉络存成一个分支节点。用户说"换个话题/另一条路"时主动使用，之后用 /branch use 切换。',
      parameters: {
        title: { type: 'string', required: true, description: '这一路的话题标题' },
      },
      output: { schema: { type: 'string' } as const, render: (_args, value) => [{ type: 'text', text: value }] },
      presentCall: () => ({ card: 'generic' as const, title: '存分支', kind: 'edit' as const }),
      presentResult: (_args, value) => ({ card: 'generic' as const, title: String(value).split('\n')[0]!.slice(0, 60), kind: 'edit' as const, rawInput: value }),
      async execute(args) {
        const title = String(args.title ?? '').trim();
        const result = addFromInput(title);
        if (result.kind === 'empty') return '标题为空，未存。';
        if (result.kind === 'badParent') return `父分支不存在。/branch list 查看。`;
        if (result.kind === 'duplicate') return `同标题分支已存在 #${result.node.id}，已切到它。`;
        state.write(result.node.id);
        return `已存分支 #${result.node.id}「${title}」。/branch use ${result.node.id} 随时切回。`;
      },
    }),
  );

  ctx.tools.register(
    defineTool({
      name: 'branch_list',
      description: '列出会话分支树（哪个是当前分支）。切换前先看。',
      parameters: {},
      output: { schema: { type: 'string' } as const, render: (_args, value) => [{ type: 'text', text: value }] },
      presentCall: () => ({ card: 'generic' as const, title: '分支树', kind: 'search' as const }),
      presentResult: (_args, value) => ({ card: 'generic' as const, title: String(value).split('\n')[0]!.slice(0, 60), kind: 'search' as const, rawInput: value }),
      async execute() {
        return renderTree(store.load(), state.read());
      },
    }),
  );

  log.info(`mounted · ${store.path} · current=${state.read() ?? '—'} order=${config.order}`);
}
