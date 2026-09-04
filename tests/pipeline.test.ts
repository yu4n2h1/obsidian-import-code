import { describe, it, expect } from "vitest";
import { classifyTargets } from "../src/pipeline/target-resolver";
import { computeDisplayRanges, computeHighlightLines, sliceContent } from "../src/pipeline/range-converter";
import type { Target } from "../src/pipeline/types";

describe("classifyTargets", () => {
	it("全空返回 null/null（显示全文、无高亮）", () => {
		expect(classifyTargets("", "")).toEqual({ display: null, highlight: null });
	});

	it("symbol display", () => {
		expect(classifyTargets("myFunc", "")).toEqual({
			display: { type: "symbol", name: "myFunc" },
			highlight: null,
		});
	});

	it("line range display", () => {
		expect(classifyTargets("10-20", "")).toEqual({
			display: { type: "line", lineRange: { start: 10, end: 20 } },
			highlight: null,
		});
	});

	it("单行 line display", () => {
		expect(classifyTargets("5", "")).toEqual({
			display: { type: "line", lineRange: { start: 5, end: undefined } },
			highlight: null,
		});
	});

	it("highlight 独立解析", () => {
		expect(classifyTargets("", "3-7")).toEqual({
			display: null,
			highlight: { type: "line", lineRange: { start: 3, end: 7 } },
		});
	});

	it("#symbol 不提升为 @（display=null, highlight=symbol）", () => {
		// 这是 classifyTargets 的核心约束：# 只做高亮，不会退化成提取
		expect(classifyTargets("", "myFunc")).toEqual({
			display: null,
			highlight: { type: "symbol", name: "myFunc" },
		});
	});

	it("display 与 highlight 同时解析、互不影响", () => {
		expect(classifyTargets("parseConfig", "5-10")).toEqual({
			display: { type: "symbol", name: "parseConfig" },
			highlight: { type: "line", lineRange: { start: 5, end: 10 } },
		});
	});
});

describe("computeDisplayRanges", () => {
	it("null target 返回全文单区间", () => {
		const content = "line1\nline2\nline3";
		expect(computeDisplayRanges(null, content, "ts")).toEqual([{ start: 1, end: 3 }]);
	});

	it("line target 用 lineRange", () => {
		const content = "a\nb\nc\nd\ne";
		const target: Target = { type: "line", lineRange: { start: 2, end: 4 } };
		expect(computeDisplayRanges(target, content, "ts")).toEqual([{ start: 2, end: 4 }]);
	});

	it("line target 无 end 默认到末尾", () => {
		const content = "a\nb\nc";
		const target: Target = { type: "line", lineRange: { start: 2 } };
		expect(computeDisplayRanges(target, content, "ts")).toEqual([{ start: 2, end: 3 }]);
	});

	it("line target 的 end 超出内容行数时不 clamp（留给 sliceContent）", () => {
		const content = "a\nb";
		const target: Target = { type: "line", lineRange: { start: 1, end: 99 } };
		expect(computeDisplayRanges(target, content, "ts")).toEqual([{ start: 1, end: 99 }]);
	});

	it("找不到 symbol 抛错（由 executePipeline 的 try/catch 兜底）", () => {
		const content = "const x = 1;";
		const target: Target = { type: "symbol", name: "nonExistent" };
		expect(() => computeDisplayRanges(target, content, "ts")).toThrow();
	});

	it("空内容 + null target 返回 start:1 end:0", () => {
		// countLines("") = 0，空文件兜底
		expect(computeDisplayRanges(null, "", "ts")).toEqual([{ start: 1, end: 0 }]);
	});
});

describe("computeHighlightLines", () => {
	it("无目标返回空数组", () => {
		expect(computeHighlightLines(null, "a\nb\nc", "ts")).toEqual([]);
	});

	it("line 范围映射为 0-based 相对索引", () => {
		const target: Target = { type: "line", lineRange: { start: 2, end: 4 } };
		expect(computeHighlightLines(target, "a\nb\nc\nd\ne", "ts")).toEqual([1, 2, 3]);
	});

	it("line 范围超出显示内容被 clamp", () => {
		const target: Target = { type: "line", lineRange: { start: 3, end: 10 } };
		expect(computeHighlightLines(target, "a\nb\nc", "ts")).toEqual([2]);
	});

	it("line 起始行超出总行数返回空数组", () => {
		const target: Target = { type: "line", lineRange: { start: 9 } };
		expect(computeHighlightLines(target, "a\nb", "ts")).toEqual([]);
	});

	it("单行 start 无 end 只高亮一行", () => {
		const target: Target = { type: "line", lineRange: { start: 2 } };
		expect(computeHighlightLines(target, "a\nb\nc", "ts")).toEqual([1]);
	});

	it("symbol 目标在显示内容中定位高亮", () => {
		const target: Target = { type: "symbol", name: "b" };
		const content = "function a() {\n}\nfunction b() {\n}\nfunction c() {\n}";
		expect(computeHighlightLines(target, content, "javascript")).toEqual([2, 3]);
	});

	it("symbol 找不到返回空数组（不抛错）", () => {
		const target: Target = { type: "symbol", name: "missing" };
		expect(computeHighlightLines(target, "a\nb", "ts")).toEqual([]);
	});
});

describe("sliceContent", () => {
	it("按范围切片并带 startLine", () => {
		const result = sliceContent("l1\nl2\nl3\nl4\nl5", [{ start: 2, end: 4 }], null, "ts");
		expect(result.displayContent).toBe("l2\nl3\nl4");
		expect(result.startLine).toBe(2);
		expect(result.highlightLines).toEqual([]);
	});

	it("end 越界被 slice clamp 到末尾", () => {
		const result = sliceContent("l1\nl2", [{ start: 1, end: 99 }], null, "ts");
		expect(result.displayContent).toBe("l1\nl2");
	});

	it("start 小于 1 被 clamp", () => {
		const result = sliceContent("l1\nl2\nl3", [{ start: 0, end: 2 }], null, "ts");
		expect(result.displayContent).toBe("l1\nl2");
	});

	it("单行范围", () => {
		const result = sliceContent("l1\nl2\nl3", [{ start: 2, end: 2 }], null, "ts");
		expect(result.displayContent).toBe("l2");
	});

	it("highlight 目标转为相对 displayContent 的索引", () => {
		const highlight: Target = { type: "line", lineRange: { start: 2, end: 3 } };
		const result = sliceContent("a\nb\nc\nd\ne", [{ start: 2, end: 4 }], highlight, "ts");
		expect(result.displayContent).toBe("b\nc\nd");
		expect(result.highlightLines).toEqual([1, 2]);
	});

	it("空内容切片", () => {
		const result = sliceContent("", [{ start: 1, end: 0 }], null, "ts");
		expect(result.displayContent).toBe("");
		expect(result.startLine).toBe(1);
	});

	it("单区间不带 lineNumbers（保持旧 shape）", () => {
		const result = sliceContent("l1\nl2\nl3", [{ start: 2, end: 3 }], null, "ts");
		expect(result.lineNumbers).toBeUndefined();
	});

	it("多区间拼接：空行分隔 + lineNumbers 保留原文件行号", () => {
		const result = sliceContent(
			"l1\nl2\nl3\nl4\nl5\nl6",
			[
				{ start: 2, end: 3 },
				{ start: 5, end: 6 },
			],
			null,
			"ts",
		);
		expect(result.displayContent).toBe("l2\nl3\n\nl5\nl6");
		expect(result.startLine).toBe(2);
		// 间隔空行为 null，其余行号对应源文件 1-based 行号
		expect(result.lineNumbers).toEqual([2, 3, null, 5, 6]);
	});

	it("多区间相邻（连续行）也会插入分隔空行", () => {
		const result = sliceContent(
			"l1\nl2\nl3",
			[
				{ start: 1, end: 2 },
				{ start: 3, end: 3 },
			],
			null,
			"ts",
		);
		expect(result.displayContent).toBe("l1\nl2\n\nl3");
		expect(result.lineNumbers).toEqual([1, 2, null, 3]);
	});

	it("多区间时 highlight 按拼接后内容的相对索引计算", () => {
		const highlight: Target = { type: "line", lineRange: { start: 4, end: 5 } };
		const result = sliceContent(
			"l1\nl2\nl3\nl4\nl5\nl6",
			[
				{ start: 1, end: 2 },
				{ start: 4, end: 6 },
			],
			highlight,
			"ts",
		);
		// 拼接后内容: l1(0) l2(1) ""(2) l4(3) l5(4) l6(5)
		expect(result.highlightLines).toEqual([3, 4]);
	});
});
