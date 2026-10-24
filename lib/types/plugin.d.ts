/**
 * dsh wiring for branch-chat：会话内分叉对话。/branch save 提存脉节点，
 * /branch use 切换即注入该分支脉络；"/branch leave"←不对，写清楚：
 * current 状态存 ~/.dsh/branch-chat/current.json，跨会话保留。
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "branch-chat";
export declare const inject: string[];
export interface Config {
    enabled: boolean;
    dataPath?: string;
    tailTurns: number;
    maxSummaryChars: number;
    order: number;
}
export declare const Config: Schema<Schemastery.ObjectS<{
    enabled: Schema<boolean, boolean>;
    dataPath: Schema<string, string>;
    tailTurns: Schema<number, number>;
    maxSummaryChars: Schema<number, number>;
    order: Schema<number, number>;
}>, Schemastery.ObjectT<{
    enabled: Schema<boolean, boolean>;
    dataPath: Schema<string, string>;
    tailTurns: Schema<number, number>;
    maxSummaryChars: Schema<number, number>;
    order: Schema<number, number>;
}>>;
export interface Hooks {
    /** 返回最近对话的拼接文本（限长约 5KB）；不传则摘要记"尚无脉络可存" */
    tailProvider?: () => string;
}
export declare function apply(ctx: Context, config: Config, hooks?: Hooks): void;
//# sourceMappingURL=plugin.d.ts.map