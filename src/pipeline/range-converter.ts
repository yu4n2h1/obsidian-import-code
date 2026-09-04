import { findSymbolLineRange, findSymbolLineRanges } from "../language";
import type { LineRange } from "../utils/helpers";
import type { Target, SlicedContent } from "./types";

function countLines(s: string): number {
	if (s.length === 0) return 0;
	let count = 1;
	for (let i = 0; i < s.length; i++) {
		if (s[i] === "\n") count++;
	}
	return count;
}

/**
 * 计算 display 目标的行范围数组（多匹配语义，如 HTML CSS 选择器命中多个元素）。
 * 单匹配场景返回单元素数组；找不到 symbol 时抛错（由 executePipeline 兜底）。
 */
export function computeDisplayRanges(
	target: Target | null,
	content: string,
	language: string,
): LineRange[] {
	if (!target) return [{ start: 1, end: countLines(content) }];

	if (target.type === "line" && target.lineRange) {
		return [
			{
				start: target.lineRange.start,
				end: target.lineRange.end ?? countLines(content),
			},
		];
	}

	if (target.type === "symbol" && target.name) {
		const ranges = findSymbolLineRanges(content, target.name, language);
		if (ranges && ranges.length > 0) return ranges;
		throw new Error(`Symbol "${target.name}" not found`);
	}

	return [{ start: 1, end: countLines(content) }];
}

export function computeHighlightLines(
	target: Target | null,
	displayContent: string,
	language: string,
): number[] {
	if (!target) return [];

	const totalLines = countLines(displayContent);

	if (target.type === "line" && target.lineRange) {
		const startIdx = Math.max(0, target.lineRange.start - 1);
		const endIdx = target.lineRange.end
			? Math.min(totalLines, target.lineRange.end)
			: startIdx + 1;
		if (startIdx >= totalLines) return [];

		const len = endIdx - startIdx;
		const lines = new Array<number>(len);
		for (let i = 0; i < len; i++) lines[i] = startIdx + i;
		return lines;
	}

	if (target.type === "symbol" && target.name) {
		// 多区间语义：symbol 的所有匹配区间都高亮（多匹配拼接时全部命中）
		const ranges = findSymbolLineRanges(displayContent, target.name, language);
		if (ranges) {
			const lines: number[] = [];
			for (const range of ranges) {
				const len = range.end - (range.start - 1);
				for (let i = 0; i < len; i++) lines.push((range.start - 1) + i);
			}
			return lines;
		}
		// 兼容旧路径：多区间 API 未命中时退回单区间查找（不该发生，保底）
		const range = findSymbolLineRange(displayContent, target.name, language);
		if (range) {
			const len = range.end - (range.start - 1);
			const lines = new Array<number>(len);
			for (let i = 0; i < len; i++) lines[i] = (range.start - 1) + i;
			return lines;
		}
	}

	return [];
}

export function sliceContent(
	content: string,
	displayRanges: LineRange[],
	highlight: Target | null,
	language: string,
): SlicedContent {
	const lines = content.split("\n");
	const parts: string[] = [];
	const lineNumbers: (number | null)[] = [];

	displayRanges.forEach((range, idx) => {
		// `slice` 自动 clamp end 到数组长度，无需 Math.min
		const segment = lines.slice(
			Math.max(0, range.start - 1),
			range.end,
		);
		if (idx > 0) {
			// 区间之间插入空行分隔（不对应源文件任何行）
			parts.push("");
			lineNumbers.push(null);
		}
		parts.push(segment.join("\n"));
		for (let i = 0; i < segment.length; i++) {
			lineNumbers.push(range.start + i);
		}
	});

	const displayContent = parts.join("\n");
	const highlightLines = computeHighlightLines(highlight, displayContent, language);

	// 单区间时 lineNumbers 与 startLine + i 等价，省略以保持旧输出 shape 不变
	const first = displayRanges[0] ?? { start: 1 };
	const isSingle = displayRanges.length <= 1;

	return {
		displayContent,
		highlightLines,
		startLine: first.start,
		...(!isSingle ? { lineNumbers } : {}),
	};
}
