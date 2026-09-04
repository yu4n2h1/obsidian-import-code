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

/** 同 class 两元素的 HTML（回归：曾只显示第一个、区间重合） */
const SAME_CLASS_SAMPLE = [
	"<!DOCTYPE html>",        // 1
	"<html>",                 // 2
	"<body>",                 // 3
	'<div class="des">',      // 4  q1 开
	"  <p>q1</p>",            // 5
	"</div>",                 // 6  q1 闭
	"",                       // 7
	'<div class="des">',      // 8  q2 开
	"  <p>q2</p>",            // 9
	"</div>",                 // 10 q2 闭
	"</body>",                // 11
	"</html>",                // 12
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

	it("同 class 多元素：各区间不重合、各含完整开闭标签（回归：曾只显示第一个）", () => {
		const ranges = extractor.findSymbolLineRanges(SAME_CLASS_SAMPLE, "div.des");
		expect(ranges).toEqual([
			{ start: 4, end: 6 },
			{ start: 8, end: 10 },
		]);
	});

	it("同 class 多元素逗号选择器：等价于单选择器，两区间都选出", () => {
		const ranges = extractor.findSymbolLineRanges(SAME_CLASS_SAMPLE, "div.des,div.des");
		expect(ranges).toEqual([
			{ start: 4, end: 6 },
			{ start: 8, end: 10 },
		]);
	});

	it("同 class 多元素 + 异 class 混合选择器", () => {
		// 用户实际用法：div.des,div.des_2 —— des 命中两个、des_2 命中一个
		const mixed = [
			'<div class="des">',      // 1
			"  q1",                   // 2
			"</div>",                 // 3
			'<div class="des">',      // 4
			"  q2",                   // 5
			"</div>",                 // 6
			'<div class="des_2">',    // 7
			"  q3",                   // 8
			"</div>",                 // 9
		].join("\n");
		const ranges = extractor.findSymbolLineRanges(mixed, "div.des,div.des_2");
		expect(ranges).toEqual([
			{ start: 1, end: 3 },
			{ start: 4, end: 6 },
			{ start: 7, end: 9 },
		]);
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

	it("同 class 多元素端到端：两段都显示且各自完整闭合", () => {
		const ranges = extractor.findSymbolLineRanges(SAME_CLASS_SAMPLE, "div.des");
		expect(ranges).not.toBeNull();
		const result = sliceContent(SAME_CLASS_SAMPLE, ranges!, null, "html");
		const lines = result.displayContent.split("\n");
		expect(lines).toEqual([
			'<div class="des">',
			"  <p>q1</p>",
			"</div>",
			"",
			'<div class="des">',
			"  <p>q2</p>",
			"</div>",
		]);
		expect(result.lineNumbers).toEqual([4, 5, 6, null, 8, 9, 10]);
	});
});
