/**
 * dev:dom 查询与 DOM 断言的 helper。
 * 渲染是异步的（ViewPlugin setTimeout + async MarkdownRenderer.render），
 * 因此所有断言都先「轮询等待」目标元素出现，再读取内容。
 */
import { obsidian } from "./cli";

export interface DomQueryOptions {
	/** 返回文本内容而非 outerHTML */
	text?: boolean;
	/** 返回 innerHTML */
	inner?: boolean;
	/** 返回所有匹配而非第一个 */
	all?: boolean;
	/** 取指定属性的值 */
	attr?: string;
}

/** 查询 DOM，返回 CLI 原始输出。 */
export function queryDom(selector: string, opts: DomQueryOptions = {}): string {
	const args = ["dev:dom", `selector=${selector}`];
	if (opts.text) args.push("text");
	if (opts.inner) args.push("inner");
	if (opts.all) args.push("all");
	if (opts.attr) args.push(`attr=${opts.attr}`);
	return obsidian(args);
}

/** 查询匹配元素数量。 */
export function countDom(selector: string): number {
	const out = obsidian(["dev:dom", `selector=${selector}`, "total"]);
	const n = Number.parseInt(out, 10);
	return Number.isNaN(n) ? 0 : n;
}

/** 轮询等待 selector 出现（匹配数 > 0），超时抛错。 */
export async function waitForSelector(
	selector: string,
	timeoutMs = 5000,
	intervalMs = 200,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (countDom(selector) > 0) return;
		await sleep(intervalMs);
	}
	throw new Error(`等待 selector 超时：${selector}`);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
