import { findSymbolLineRange } from "../utils/code-extractor";
import { LineRange } from "../utils/helpers";
import { Target, SlicedContent } from "./types";

function countLines(s: string): number {
	if (s.length === 0) return 0;
	let count = 1;
	for (let i = 0; i < s.length; i++) {
		if (s[i] === "\n") count++;
	}
	return count;
}

export function convertToDisplayOrd(
	target: Target | null,
	content: string,
	language: string,
): LineRange {
	if (!target) return { start: 1, end: countLines(content) };

	if (target.type === "line" && target.lineRange) {
		return {
			start: target.lineRange.start,
			end: target.lineRange.end ?? countLines(content),
		};
	}

	if (target.type === "symbol" && target.name) {
		const range = findSymbolLineRange(content, target.name, language);
		if (range) return { start: range.start, end: range.end };
		throw new Error(`Symbol "${target.name}" not found`);
	}

	return { start: 1, end: countLines(content) };
}

export function convertToHighlightOrd(
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

/**
 * 阶段 4：符号→行号转换 + 内容切片。
 * 输入 FileContext + TargetResult，输出 SlicedContent。
 */
export function sliceContent(
	content: string,
	language: string,
	display: Target | null,
	highlight: Target | null,
): SlicedContent {
	const displayRange = convertToDisplayOrd(display, content, language);

	// `slice` 自动 clamp end 到数组长度，无需 Math.min
	const lines = content.split("\n");
	const displayContent = lines
		.slice(Math.max(0, displayRange.start - 1), displayRange.end)
		.join("\n");

	const highlightLines = convertToHighlightOrd(highlight, displayContent, language);

	return { displayContent, highlightLines };
}
