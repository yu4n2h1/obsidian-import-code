import { describe, it, expect } from "vitest";
import {
	parseEmbedSource,
	classifyPath,
	parseLineRange,
} from "../src/utils/helpers";

describe("parseEmbedSource", () => {
	it("纯文件路径", () => {
		expect(parseEmbedSource("file.ts")).toEqual({
			filePath: "file.ts",
			symbolName: "",
			highlightSpec: "",
		});
	});

	it("文件 + 符号", () => {
		expect(parseEmbedSource("file.ts@parseConfig")).toEqual({
			filePath: "file.ts",
			symbolName: "parseConfig",
			highlightSpec: "",
		});
	});

	it("文件 + 高亮范围", () => {
		expect(parseEmbedSource("file.ts#5-10")).toEqual({
			filePath: "file.ts",
			symbolName: "",
			highlightSpec: "5-10",
		});
	});

	it("文件 + 符号 + 高亮（组合）", () => {
		expect(parseEmbedSource("file.ts@fn#5-10")).toEqual({
			filePath: "file.ts",
			symbolName: "fn",
			highlightSpec: "5-10",
		});
	});

	it("路径含斜杠与 @ # 组合", () => {
		expect(parseEmbedSource("src/utils.ts@parseConfig#3-7")).toEqual({
			filePath: "src/utils.ts",
			symbolName: "parseConfig",
			highlightSpec: "3-7",
		});
	});

	it("@ 在末尾视为无符号", () => {
		expect(parseEmbedSource("file.ts@")).toEqual({
			filePath: "file.ts@",
			symbolName: "",
			highlightSpec: "",
		});
	});

	it("# 在末尾视为无高亮", () => {
		expect(parseEmbedSource("file.ts#")).toEqual({
			filePath: "file.ts#",
			symbolName: "",
			highlightSpec: "",
		});
	});
});

describe("classifyPath", () => {
	it("https URL -> http", () => {
		expect(classifyPath("https://example.com/x.ts")).toBe("http");
	});

	it("http URL -> http", () => {
		expect(classifyPath("http://example.com/x.ts")).toBe("http");
	});

	it("alias:path -> alias", () => {
		expect(classifyPath("github:user/repo/x.ts")).toBe("alias");
	});

	it("普通相对路径 -> local", () => {
		expect(classifyPath("src/utils.ts")).toBe("local");
	});

	it("单文件名 -> local", () => {
		expect(classifyPath("file.ts")).toBe("local");
	});

	it("带 // 的不是 alias（避免误判 http 风格）", () => {
		// isAliasPath 的正则要求 alias: 后面不跟 //
		expect(classifyPath("foo://bar")).toBe("local");
	});
});

describe("parseLineRange", () => {
	it("单行号", () => {
		expect(parseLineRange("5")).toEqual({ start: 5, end: undefined });
	});

	it("行范围", () => {
		expect(parseLineRange("10-20")).toEqual({ start: 10, end: 20 });
	});

	it("非数字返回 null", () => {
		expect(parseLineRange("abc")).toBeNull();
	});

	it("空串返回 null", () => {
		expect(parseLineRange("")).toBeNull();
	});

	it("符号名返回 null（不是行范围）", () => {
		expect(parseLineRange("myFunc")).toBeNull();
	});
});
