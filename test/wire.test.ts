/** 装配测试：mock ctx + 真临时目录。 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, after } from 'node:test';

import { apply } from '../src/plugin.ts';

const dataDir = mkdtempSync(join(tmpdir(), 'branch-wire-'));
after(() => rmSync(dataDir, { recursive: true, force: true }));

interface Command { name: string; handler: (args: { rawInput?: string }) => { kind: string; text: string } }
interface Tool { name: string; execute: (args?: Record<string, unknown>) => Promise<string> }
interface Section { name: string; text: () => string }

const commands: Command[] = [];
const tools: Tool[] = [];
const sections: Section[] = [];
const tailLines: string[] = [];
apply({ logger: () => ({ info() {}, warn() {} }), commands: { register(definition: never) { commands.push(definition as never); } }, tools: { register(definition: never) { tools.push(definition as never); } }, systemPrompt: { section(section: never) { sections.push(section as never); } } } as never, {
  enabled: true,
  dataPath: join(dataDir, 'branches.jsonl'),
  tailTurns: 6,
  maxSummaryChars: 800,
  order: 720,
}, { tailProvider: () => tailLines.slice(-10).join(' ') });

const branch = () => commands.find((entry) => entry.name === 'branch')!;
const section = () => sections.find((entry) => entry.name === 'branch-chat')?.text();

test('装配：1 命令 1 段 2 工具', () => {
  assert.ok(branch());
  assert.ok(sections.find((entry) => entry.name === 'branch-chat'));
  assert.ok(tools.find((entry) => entry.name === 'branch_save'));
  assert.ok(tools.find((entry) => entry.name === 'branch_list'));
});

test('首次 section 无 current → 空段；save 后出段', () => {
  assert.match(branch().handler({ rawInput: 'list' }).text, /还没有分支/);
  const saved = branch().handler({ rawInput: 'save 第一个话题' });
  assert.match(saved.text, /已存分支 #1/);
  // tailProvider 空时摘要记"尚无脉络可存"
  const text = section()!;
  assert.match(text, /## 当前分支脉络/);
  assert.match(text, /#1「第一个话题」/);
});

test('use 切换 + 重复标题落到既有 + fork 派生', () => {
  tailLines.push('用户换了话题聊部署。');
  const again = branch().handler({ rawInput: 'save 第一个话题' });
  assert.match(again.text, /已存在.*已切到它/);

  const fork = branch().handler({ rawInput: 'fork 1 子分支' });
  assert.match(fork.text, /已从 #1 派生 #2/);

  const list = branch().handler({ rawInput: 'list' });
  assert.ok(String(list.text).includes('└─ [#2] 子分支 [当前]'), String(list.text));

  const use = branch().handler({ rawInput: 'use 1' });
  assert.match(use.text, /已切到 #1/);
  assert.match(section()!, /链路：#1 第一个话题|根分支|#1「第一个话题」/);
});

test('错误分支：use 不存在 / fork 不存在 / 动作未知', () => {
  assert.equal(branch().handler({ rawInput: 'use 99' }).kind, 'error');
  assert.equal(branch().handler({ rawInput: 'fork 99 标题' }).kind, 'error');
  assert.equal(branch().handler({ rawInput: 'bogus' }).kind, 'error');
});

test('branch_save 工具与 branch_list 工具', async () => {
  tailLines.push('再来一路：聊 prompt 优化。');
  const save = tools.find((entry) => entry.name === 'branch_save')!;
  const text = await save.execute({ title: 'prompt 优化' });
  assert.match(text, /#3/);
  const list = await tools.find((entry) => entry.name === 'branch_list')!.execute({});
  assert.match(list, /prompt 优化 \[当前\]/);
});

test('落盘真验：branches.jsonl 含标题行、current.json 记指回 #3', () => {
  const disk = readFileSync(join(dataDir, 'branches.jsonl'), 'utf8');
  for (const expected of ['第一个话题', '子分支', 'prompt 优化']) assert.match(disk, new RegExp(expected));
  const current = readFileSync(join(dataDir, 'current.json'), 'utf8');
  assert.match(current, /"3"/);
});
