// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { HtmlExtractor } from "../src/language/html";
import { sliceContent } from "../src/pipeline/range-converter";

const extractor = new HtmlExtractor();

/** 构造一段含两个 class 签名 div 的 HTML（行号见注释） */
const SAMPLE = [
	"<!DOCTYPE html>",        // 1
	"<html>",                 // 2
	"<body>",                 // 3
	'<div class="des">',      // 4
	"  <p>A</p>",             // 5
	"</div>",                 // 6
	'<div class="des_2">',    // 7
	"  <p>B</p>",             // 8
	"</div>",                 // 9
	"</body>",                // 10
	"</html>",                // 11
].join("\n");

describe("HtmlExtractor.findSymbolLineRanges", () => {
	it("逗号选择器多区间：每段含完整开闭标签（回归：闭标签曾丢失）", () => {
		const ranges = extractor.findSymbolLineRanges(SAMPLE, "div.des,div.des_2");
		expect(ranges).toEqual([
			{ start: 4, end: 6 },
			{ start: 7, end: 9 },
		]);
	});

	it("单选择器：区间为 1-based 且含闭标签", () => {
		const ranges = extractor.findSymbolLineRanges(SAMPLE, "div.des_2");
		expect(ranges).toEqual([{ start: 7, end: 9 }]);
	});

	it("findSymbolLineRange 返回首个匹配（兼容旧签名）", () => {
		const range = extractor.findSymbolLineRange(SAMPLE, "div.des");
		expect(range).toEqual({ start: 4, end: 6 });
	});

	it("无匹配返回 null", () => {
		expect(extractor.findSymbolLineRanges(SAMPLE, "div.missing")).toBeNull();
	});
});

describe("sliceContent × HTML 多区间（端到端）", () => {
	it("多区间拼接：每段完整闭合，lineNumbers 保留真实行号", () => {
		const ranges = extractor.findSymbolLineRanges(SAMPLE, "div.des,div.des_2");
		expect(ranges).not.toBeNull();
		const result = sliceContent(SAMPLE, ranges!, null, "html");

		const lines = result.displayContent.split("\n");
		expect(lines[0]).toBe('<div class="des">');
		expect(lines[2]).toBe("</div>");
		expect(lines[4]).toBe('<div class="des_2">');
		expect(lines[6]).toBe("</div>");
		// 行号：4,5,6 | null | 7,8,9
		expect(result.lineNumbers).toEqual([4, 5, 6, null, 7, 8, 9]);
		expect(result.startLine).toBe(4);
	});

	it("单区间：开闭标签齐全且不带 lineNumbers", () => {
		const ranges = extractor.findSymbolLineRanges(SAMPLE, "div.des_2");
		expect(ranges).not.toBeNull();
		const result = sliceContent(SAMPLE, ranges!, null, "html");
		expect(result.displayContent.split("\n")).toEqual([
			'<div class="des_2">',
			"  <p>B</p>",
			"</div>",
		]);
		expect(result.lineNumbers).toBeUndefined();
	});
});
