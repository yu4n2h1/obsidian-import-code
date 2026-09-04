import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import {
	parseEmbedSource,
	classifyPath,
	parseLineRange,
	isRemoteUrl,
	isAliasPath,
	parseAliasPath,
	isPartialIpv6Url,
	tryRestoreIpv6Url,
	getSupportedExtensions,
	debounce,
} from "../src/utils/helpers";
import { DEFAULT_SETTINGS } from "../src/types";

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

	it("# 后带 @ 时 @ 属于 highlight 内容", () => {
		// lastIndexOf("#") 先切高亮，@ 只在前半段解析
		expect(parseEmbedSource("file.ts#1-5@x")).toEqual({
			filePath: "file.ts",
			symbolName: "",
			highlightSpec: "1-5@x",
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

	it("逆序范围原样返回（不做交换）", () => {
		expect(parseLineRange("20-10")).toEqual({ start: 20, end: 10 });
	});

	it("多余横杠返回 null", () => {
		expect(parseLineRange("1-2-3")).toBeNull();
	});
});

describe("isRemoteUrl", () => {
	it("https URL", () => {
		expect(isRemoteUrl("https://example.com/a.ts")).toBe(true);
	});

	it("http URL", () => {
		expect(isRemoteUrl("http://example.com/a.ts")).toBe(true);
	});

	it("本地路径不是远程 URL", () => {
		expect(isRemoteUrl("src/a.ts")).toBe(false);
	});

	it("ftp 协议不算远程（仅支持 http/https）", () => {
		expect(isRemoteUrl("ftp://example.com/a.ts")).toBe(false);
	});
});

describe("isAliasPath", () => {
	it("alias:path 是别名路径", () => {
		expect(isAliasPath("github:user/repo/a.ts")).toBe(true);
	});

	it("alias 允许 _ 与 -", () => {
		expect(isAliasPath("my_src-1:a.ts")).toBe(true);
	});

	it("http:// 风格不是别名", () => {
		expect(isAliasPath("foo://bar")).toBe(false);
	});

	it("无冒号不是别名", () => {
		expect(isAliasPath("a.ts")).toBe(false);
	});
});

describe("parseAliasPath", () => {
	it("拆分 alias 与相对路径", () => {
		expect(parseAliasPath("github:user/repo/src/a.ts")).toEqual({
			alias: "github",
			relativePath: "user/repo/src/a.ts",
		});
	});

	it("http:// 风格返回 null", () => {
		expect(parseAliasPath("foo://bar")).toBeNull();
	});

	it("无冒号返回 null", () => {
		expect(parseAliasPath("a.ts")).toBeNull();
	});

	it("空相对路径返回 null", () => {
		expect(parseAliasPath("github:")).toBeNull();
	});
});

describe("isPartialIpv6Url", () => {
	it("左括号未闭合（被 wiki link 语法截断）→ true", () => {
		// Obsidian 把 IPv6 的 ] 当成 wiki link 闭合符吃掉，
		// 此时 src 里只剩 [ 没有 ]
		expect(isPartialIpv6Url("https://[::1:8080/a.ts")).toBe(true);
	});

	it("完整 IPv6 URL → false", () => {
		expect(isPartialIpv6Url("https://[::1]:8080/a.ts]")).toBe(false);
	});

	it("普通 URL → false", () => {
		expect(isPartialIpv6Url("https://example.com/a.ts")).toBe(false);
	});

	it("非远程路径 → false", () => {
		expect(isPartialIpv6Url("src/a.ts[")).toBe(false);
	});
});

describe("tryRestoreIpv6Url", () => {
	beforeAll(() => {
		vi.stubGlobal("Node", { TEXT_NODE: 3 });
	});
	afterAll(() => {
		vi.unstubAllGlobals();
	});

	function fakeEmbed(sibling: unknown) {
		return { nextSibling: sibling } as unknown as HTMLElement;
	}

	it("从下一 sibling 文本节点捞回被截断的 ] 并消费文本", () => {
		const sibling = { nodeType: 3, textContent: "]:8080/a.ts]] extra" };
		const restored = tryRestoreIpv6Url("https://[::1", fakeEmbed(sibling));
		expect(restored).toBe("https://[::1]");
		expect(sibling.textContent).toBe(":8080/a.ts]] extra");
	});

	it("无 sibling 返回 null", () => {
		expect(tryRestoreIpv6Url("https://[::1", fakeEmbed(null))).toBeNull();
	});

	it("sibling 非文本节点返回 null", () => {
		const sibling = { nodeType: 1, textContent: "]x" };
		expect(tryRestoreIpv6Url("https://[::1", fakeEmbed(sibling))).toBeNull();
		expect(sibling.textContent).toBe("]x");
	});

	it("sibling 文本无 ] 返回 null 且不消费", () => {
		const sibling = { nodeType: 3, textContent: "no bracket" };
		expect(tryRestoreIpv6Url("https://[::1", fakeEmbed(sibling))).toBeNull();
		expect(sibling.textContent).toBe("no bracket");
	});

	it("sibling 文本为空返回 null", () => {
		const sibling = { nodeType: 3, textContent: "" };
		expect(tryRestoreIpv6Url("https://[::1", fakeEmbed(sibling))).toBeNull();
	});
});

describe("getSupportedExtensions", () => {
	it("只返回 active 且非空 suffix 的小写扩展名", () => {
		const settings = {
			...DEFAULT_SETTINGS,
			codeFileExtensions: [
				{ suffix: "TS", dialect: "typescript", active: true },
				{ suffix: "js", dialect: "javascript", active: true },
				{ suffix: "", dialect: "empty", active: true },
				{ suffix: "py", dialect: "python", active: false },
			],
		};
		expect(getSupportedExtensions(settings)).toEqual(["ts", "js"]);
	});
});

describe("debounce", () => {
	beforeEach(() => {
		// debounce 内部用 window.setTimeout/clearTimeout，
		// 转发到全局以便 vi.useFakeTimers 接管
		vi.stubGlobal("window", {
			setTimeout: (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms),
			clearTimeout: (id: number) => globalThis.clearTimeout(id),
		});
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("延迟窗口内多次调用只执行一次", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 100);
		debounced();
		debounced();
		debounced();
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(99);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("传入的参数透传给原函数", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 50);
		debounced("a", 1);
		vi.advanceTimersByTime(50);
		expect(fn).toHaveBeenCalledWith("a", 1);
	});

	it("执行后重新计时（下一轮调用不受影响）", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 50);
		debounced();
		vi.advanceTimersByTime(50);
		debounced();
		vi.advanceTimersByTime(50);
		expect(fn).toHaveBeenCalledTimes(2);
	});
});
