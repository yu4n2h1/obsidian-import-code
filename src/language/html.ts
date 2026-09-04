import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

/**
 * HTML 元素提取器。
 *
 * 支持通过 CSS 选择器从 HTML 内容中提取指定元素。
 * 在 embed 语法中使用 `@` 指定选择器：
 *   ![[file.html@.container]]       → 提取 class="container" 的元素
 *   ![[file.html@[id="main"]]]      → 提取 id="main" 的元素（推荐代替 #main）
 *   ![[file.html@div.content]]      → 提取 <div class="content">
 *   ![[file.html@section > p]]      → 提取 <section> 下的 <p>
 *
 * 选择器命中多个元素时按文档顺序全部提取（querySelectorAll 语义），
 * 由 pipeline 侧做多区间拼接展示。
 *
 * 注意：由于 `#` 在 embed 语法中已用作高亮分隔符，
 * 请使用属性选择器 [id="xxx"] 代替 ID 选择器 #xxx。
 */

/** 无闭合标签的 void 元素 */
const VOID_ELEMENTS = new Set([
	"area", "base", "br", "col", "embed", "hr", "img", "input",
	"link", "meta", "param", "source", "track", "wbr",
]);

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class HtmlExtractor extends BaseExtractor {
	readonly languages = ["html"];
	readonly defPatterns: DefPattern[] = [];

	detectByFirstLine(firstLine: string): string | null {
		if (/^<!DOCTYPE\s+html/i.test(firstLine) || /^<html\b/i.test(firstLine)) return "html";
		return null;
	}

	stripComments(_lines: string[]): boolean[] {
		return new Array<boolean>(_lines.length).fill(false);
	}

	extractBlock(
		_lines: string[],
		_startIdx: number,
		_defIndent: string
	): string[] | null {
		return null;
	}

	/**
	 * 使用 CSS 选择器在 HTML 源码中定位元素，返回首个匹配的 1-based 行范围。
	 * 多匹配语义见 findSymbolLineRanges。
	 */
	findSymbolLineRange(
		content: string,
		selector: string
	): { start: number; end: number } | null {
		const ranges = this.findSymbolLineRanges(content, selector);
		return ranges ? (ranges[0] ?? null) : null;
	}

	/**
	 * 使用 CSS 选择器在 HTML 源码中定位**所有**匹配元素，按文档顺序返回 1-based 行范围数组。
	 *
	 * 策略（对每个匹配元素）：
	 * 1. DOMParser 解析 → querySelectorAll 取全部匹配
	 * 2. 通过标签名 + id/class 签名在源码中定位开标签
	 * 3. 追踪同标签深度找到闭合标签
	 *
	 * 兜底：任一元素在源码中定位失败（来源与 DOM 序列化差异）时，
	 * 整体回退到全文件单区间——避免出现「一半精确一半全文」的混乱拼接。
	 */
	findSymbolLineRanges(
		content: string,
		selector: string
	): { start: number; end: number }[] | null {
		// ---- 1. DOM 解析 & 查询 ----
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, "text/html");

		let elements: NodeListOf<Element>;
		try {
			elements = doc.querySelectorAll(selector);
		} catch {
			return null;
		}
		if (elements.length === 0) return null;

		const lines = content.split("\n");
		const ranges: { start: number; end: number }[] = [];

		// ---- 2. 逐元素定位源码区间（NodeList 顺序即文档顺序）----
		for (const el of Array.from(elements)) {
			const range = this.locateElementRange(lines, el);
			if (!range) {
				// 定位失败：整体回退全文件
				return [{ start: 1, end: lines.length }];
			}
			ranges.push(range);
		}

		return ranges;
	}

	// ==================== private helpers ====================

	/**
	 * 在源码行数组中定位单个 DOM 元素的 0-based 行区间，失败返回 null。
	 * 通过标签名 + id/class 签名匹配开标签，再追踪同标签深度找闭合行。
	 */
	private locateElementRange(
		lines: string[],
		el: Element
	): { start: number; end: number } | null {
		const tag = el.tagName.toLowerCase();
		const id = el.id;
		const classStr =
			typeof el.className === "string" ? el.className.trim() : "";

		// ---- 确定该元素在同标签兄弟中的序号 ----
		let nth = 0;
		let prev = el.previousElementSibling;
		while (prev) {
			if (prev.tagName.toLowerCase() === tag) nth++;
			prev = prev.previousElementSibling;
		}

		// ---- 构造开标签匹配正则 ----
		const openRe = this.buildOpenTagRegex(tag, id, classStr);

		// ---- 在源码中定位开标签所在行 ----
		let startLine = -1;

		if (id || classStr) {
			// 有 id/class 签名：直接匹配第一个即命中
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (line && openRe.test(line)) {
					startLine = i;
					break;
				}
			}
		} else {
			// 无签名：按 nth 序号匹配
			let count = 0;
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (!line) continue;
				openRe.lastIndex = 0;
				while (openRe.exec(line) !== null) {
					if (count === nth) {
						startLine = i;
						break;
					}
					count++;
				}
				if (startLine !== -1) break;
			}
		}

		if (startLine === -1) {
			return null;
		}

		// ---- void 元素 / 自闭合标签 → 单行 ----
		if (VOID_ELEMENTS.has(tag)) {
			return { start: startLine, end: startLine };
		}

		const startText = lines[startLine];
		if (startText && /\/\s*>$/.test(startText)) {
			return { start: startLine, end: startLine };
		}

		// ---- 追踪标签深度，定位闭合行 ----
		const endLine = this.findClosingLine(lines, startLine, tag);
		return { start: startLine, end: endLine };
	}

	/**
	 * 构造用于匹配开标签的正则。
	 * 优先使用 id 签名，其次 class 签名，否则匹配任意同名标签。
	 */
	private buildOpenTagRegex(
		tag: string,
		id: string,
		classStr: string
	): RegExp {
		if (id) {
			return new RegExp(
				`<\\s*${escapeRegex(tag)}[^>]*\\bid\\s*=\\s*["']${escapeRegex(id)}["'][^>]*>`,
				"i"
			);
		}

		if (classStr) {
			const classes = classStr.split(/\s+/).filter(Boolean);
			let p = `<\\s*${escapeRegex(tag)}[^>]*\\bclass\\s*=\\s*["']`;
			for (const c of classes) {
				p += `[^"']*\\b${escapeRegex(c)}\\b`;
			}
			p += `[^"']*["'][^>]*>`;
			return new RegExp(p, "i");
		}

		return new RegExp(
			`<\\s*${escapeRegex(tag)}(?:\\s[^>]*)?\\/?>`,
			"gi"
		);
	}

	/**
	 * 从 startLine 开始追踪标签深度，返回闭合行索引（0-based）。
	 * 找不到闭合标签时返回末行。
	 */
	private findClosingLine(
		lines: string[],
		startLine: number,
		tag: string
	): number {
		const openRe = new RegExp(
			`<\\s*${escapeRegex(tag)}(?:\\s[^>]*)?(?:>|\\/>)`,
			"gi"
		);
		const closeRe = new RegExp(
			`<\\s*/\\s*${escapeRegex(tag)}\\s*>`,
			"gi"
		);

		let depth = 0;
		let started = false;

		for (let i = startLine; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;

			// 数开标签
			openRe.lastIndex = 0;
			let om: RegExpExecArray | null;
			while ((om = openRe.exec(line)) !== null) {
				const full = om[0];
				if (!started) {
					started = true;
					depth = full.endsWith("/>") ? 0 : 1;
				} else {
					if (!full.endsWith("/>")) depth++;
				}
			}

			// 数闭标签
			closeRe.lastIndex = 0;
			while (closeRe.exec(line) !== null) {
				depth--;
			}

			if (started && depth <= 0) {
				return i;
			}
		}

		// 未找到闭合标签：返回末行
		return lines.length - 1;
	}
}
