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
	 * 使用 CSS 选择器在 HTML 源码中定位元素，返回 1-based 行范围。
	 *
	 * 策略：
	 * 1. DOMParser 解析 → querySelector 确认元素存在
	 * 2. 通过标签名 + id/class 签名在源码中定位开标签
	 * 3. 追踪同标签深度找到闭合标签
	 */
	findSymbolLineRange(
		content: string,
		selector: string
	): { start: number; end: number } | null {
		// ---- 1. DOM 解析 & 查询 ----
		const parser = new DOMParser();
		const doc = parser.parseFromString(content, "text/html");

		let el: Element | null;
		try {
			el = doc.querySelector(selector);
		} catch {
			return null;
		}
		if (!el) return null;

		const tag = el.tagName.toLowerCase();
		const id = el.id;
		const classStr =
			typeof el.className === "string" ? el.className.trim() : "";

		// ---- 2. 确定该元素在同标签兄弟中的序号 ----
		let nth = 0;
		let prev = el.previousElementSibling;
		while (prev) {
			if (prev.tagName.toLowerCase() === tag) nth++;
			prev = prev.previousElementSibling;
		}

		// ---- 3. 构造开标签匹配正则 ----
		const openRe = this.buildOpenTagRegex(tag, id, classStr);

		// ---- 4. 在源码中定位开标签所在行 ----
		const lines = content.split("\n");
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
			// 签名匹配失败（来源与 DOM 序列化差异），回退到全文件
			return { start: 1, end: lines.length };
		}

		// ---- 5. void 元素 / 自闭合标签 → 单行 ----
		if (VOID_ELEMENTS.has(tag)) {
			return { start: startLine + 1, end: startLine + 1 };
		}

		const startText = lines[startLine];
		if (startText && /\/\s*>$/.test(startText)) {
			return { start: startLine + 1, end: startLine + 1 };
		}

		// ---- 6. 追踪标签深度，定位闭合行 ----
		const endLine = this.findClosingLine(lines, startLine, tag);
		return { start: startLine + 1, end: endLine + 1 };
	}

	// ==================== private helpers ====================

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
