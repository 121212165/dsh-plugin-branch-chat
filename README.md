# dsh-plugin-branch-chat

> **dsh 插件家族**：22 个插件同一目录 **[dsh-plugin-family](https://github.com/121212165/dsh-plugin-family)**。社区同类：kuanfu0430/dsh-sidebar-branch-chat（独立封存 session 路线）；本插件走同会话内分叉路线，互补。

**EN** — In-session conversation branching for dsh: `/branch save <title>` freezes the current thread of the talk into a branch node; `/branch use <id>` re-injects that branch's context through the system prompt (section order 720). Tree management `/branch fork|list`, agent-side `branch_save` / `branch_list` tools. State lives in `~\.dsh\branch-chat\branches.jsonl` (+ `current.json`), temp+rename+advisory-lock writes ported from dsh-plugin-pinboard.

**中文** —— 同一会话内的「分支对话」：聊到岔路口（换话题 / "另开一路"）先 `save`，之后 `use` 切换，该分支的脉络摘要即注入系统提示，上下文不会串。树状结构支持 `fork` 派生与 `list` 渲染（└─ 缩进 + [当前] 标记）。

## 用法

- **`/branch save <标题>`** —— 把最近几轮（`tailTurns`）的脉络压成 ≤`maxSummaryChars` 的摘要存为新分支，并切过去。
- **`/branch use <id>`** —— 切换；摘要注入下一回合。
- **`/branch fork <父id> <标题>`** —— 在既有节点下派生。
- **`/branch list`** —— 树状打印；坏行计数附警。
- **`branch_save` 工具** —— Agent 观察到"开叉"主动存档；`branch_list` 自助查树。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | |
| `dataPath` | `~/.dsh/branch-chat/branches.jsonl` | 节点存档 |
| `tailTurns` | `6` | save 时参考的最近轮数 |
| `maxSummaryChars` | `800` | 摘要字符预算 |
| `order` | `720` | prompt section 顺序 |

## 限制

- 一期摘要是"最近轮次文本拼接+压缩"，不是语义摘要；接 sessions 服务后升级。
- 分支覆盖的是"脉络提醒"，不是完整历史重放：切换后 Agent 还是靠它 + 自己去翻更早上下文。
