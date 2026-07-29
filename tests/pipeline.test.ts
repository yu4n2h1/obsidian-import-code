import { describe, it, expect } from "vitest";
import { classifyTargets } from "../src/pipeline/target-resolver";
import { computeDisplayRange } from "../src/pipeline/range-converter";
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

describe("computeDisplayRange", () => {
	it("null target 返回全文范围", () => {
		const content = "line1\nline2\nline3";
		expect(computeDisplayRange(null, content, "ts")).toEqual({ start: 1, end: 3 });
	});

	it("line target 用 lineRange", () => {
		const content = "a\nb\nc\nd\ne";
		const target: Target = { type: "line", lineRange: { start: 2, end: 4 } };
		expect(computeDisplayRange(target, content, "ts")).toEqual({ start: 2, end: 4 });
	});

	it("line target 无 end 默认到末尾", () => {
		const content = "a\nb\nc";
		const target: Target = { type: "line", lineRange: { start: 2 } };
		expect(computeDisplayRange(target, content, "ts")).toEqual({ start: 2, end: 3 });
	});

	it("找不到 symbol 抛错（由 executePipeline 的 try/catch 兜底）", () => {
		const content = "const x = 1;";
		const target: Target = { type: "symbol", name: "nonExistent" };
		expect(() => computeDisplayRange(target, content, "ts")).toThrow();
	});

	it("空内容 + null target 返回 start:1 end:0", () => {
		// countLines("") = 0，空文件兜底
		expect(computeDisplayRange(null, "", "ts")).toEqual({ start: 1, end: 0 });
	});
});
