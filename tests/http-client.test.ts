import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";

// mock Obsidian 的 requestUrl，让 requestUrlAdapter 可控
const { requestUrlMock } = vi.hoisted(() => ({ requestUrlMock: vi.fn() }));
vi.mock("obsidian", () => ({ requestUrl: requestUrlMock }));

import {
	buildFullPath,
	encodePathSegments,
	normalizeBaseUrl,
	decodeBase64Content,
	buildServiceUrl,
	enrichError,
	httpsRequest,
	dispatchHttpRequest,
} from "../src/utils/http-client";

// ── fake Node https 模块 ──

interface FakeResponseDef {
	statusCode: number;
	statusMessage?: string;
	headers?: Record<string, string | string[] | undefined>;
	body?: string;
	/** true 时不自动 emit end（用于超时/请求错误场景） */
	noEnd?: boolean;
}

interface FakeReqHandle {
	on(ev: string, cb: (err?: Error) => void): FakeReqHandle;
	setTimeout(ms: number, cb: () => void): FakeReqHandle;
	write(body: string): void;
	end(): void;
	destroy(): void;
	_timeoutCb: (() => void) | null;
	_errorCb: ((err: Error) => void) | null;
	_writtenBodies: string[];
	_destroyed: boolean;
}

interface FakeResponse {
	statusCode: number;
	statusMessage?: string;
	headers: Record<string, string | string[] | undefined>;
	on(ev: "data", cb: (chunk: string) => void): FakeResponse;
	on(ev: "end", cb: () => void): FakeResponse;
	resume(): void;
	emitData(chunk: string): void;
	emitEnd(): void;
}

const fakeState: {
	module: unknown;
	requestCalls: Array<{ opts: Record<string, unknown>; req: FakeReqHandle }>;
	responses: FakeResponseDef[];
} = {
	module: null,
	requestCalls: [],
	responses: [],
};

function makeFakeHttpsModule(): unknown {
	return {
		request(opts: Record<string, unknown>, cb: (res: FakeResponse) => void): FakeReqHandle {
			const req: FakeReqHandle = {
				on(ev: string, cb2: (err?: Error) => void) {
					if (ev === "error") this._errorCb = cb2;
					return this;
				},
				setTimeout(_ms: number, cb2: () => void) {
					this._timeoutCb = cb2;
					return this;
				},
				write(body: string) { this._writtenBodies.push(body); },
				end() {},
				destroy() { this._destroyed = true; },
				_timeoutCb: null,
				_errorCb: null,
				_writtenBodies: [],
				_destroyed: false,
			};

			fakeState.requestCalls.push({ opts, req });

			const def = fakeState.responses.shift() ?? { statusCode: 200 };
			const dataCbs: Array<(chunk: string) => void> = [];
			const endCbs: Array<() => void> = [];
			const res: FakeResponse = {
				statusCode: def.statusCode,
				statusMessage: def.statusMessage,
				headers: def.headers ?? {},
				on(ev: "data" | "end", cb3: (chunk?: string) => void) {
					if (ev === "data") dataCbs.push(cb3 as (c: string) => void);
					if (ev === "end") endCbs.push(cb3 as () => void);
					return res;
				},
				resume() {},
				emitData(chunk: string) { for (const c of dataCbs) c(chunk); },
				emitEnd() { for (const c of endCbs) c(); },
			};
			cb(res);
			if (def.body !== undefined) res.emitData(def.body);
			if (!def.noEnd) res.emitEnd();
			return req;
		},
	};
}

beforeAll(() => {
	// 模拟 Electron 桌面环境：window.process.versions.electron + window.require
	vi.stubGlobal("window", {
		process: { versions: { electron: "30.0.0" } },
		require: (id: string) => {
			if (id === "https") return fakeState.module;
			return undefined;
		},
	});
	fakeState.module = makeFakeHttpsModule();
});

afterAll(() => {
	vi.unstubAllGlobals();
});

beforeEach(() => {
	fakeState.requestCalls = [];
	fakeState.responses = [];
	requestUrlMock.mockReset();
});

// ── URL 与编码工具（纯函数） ──

describe("buildFullPath", () => {
	it("无 base 时原样返回", () => {
		expect(buildFullPath("", "a/b.ts")).toBe("a/b.ts");
	});

	it("拼接 base 与路径，去掉两端斜杠", () => {
		expect(buildFullPath("/base/", "/a/b.ts")).toBe("base/a/b.ts");
	});

	it("undefined base 视为空", () => {
		expect(buildFullPath(undefined, "a/b.ts")).toBe("a/b.ts");
	});
});

describe("encodePathSegments", () => {
	it("按段编码空格与中文", () => {
		expect(encodePathSegments("a b/中文.ts")).toBe("a%20b/%E4%B8%AD%E6%96%87.ts");
	});
});

describe("normalizeBaseUrl", () => {
	it("去掉尾部斜杠", () => {
		expect(normalizeBaseUrl("https://x.com///")).toBe("https://x.com");
	});

	it("无尾部斜杠不变", () => {
		expect(normalizeBaseUrl("https://x.com")).toBe("https://x.com");
	});
});

describe("decodeBase64Content", () => {
	it("解码 UTF-8 base64（含中文）", () => {
		const b64 = Buffer.from("你好 world", "utf8").toString("base64");
		expect(decodeBase64Content(b64)).toBe("你好 world");
	});
});

describe("buildServiceUrl", () => {
	it("url + path + filePath 组合", () => {
		expect(buildServiceUrl({ url: "https://x.com/", path: "/sub/" }, "a/b.ts")).toBe("https://x.com/sub/a/b.ts");
	});

	it("无 path 时直接拼 filePath", () => {
		expect(buildServiceUrl({ url: "https://x.com" }, "a.ts")).toBe("https://x.com/a.ts");
	});
});

describe("enrichError", () => {
	it("包装 Error 消息", () => {
		expect(enrichError(new Error("boom"), "ctx")).toBe("ctx: boom");
	});

	it("非 Error 值转字符串", () => {
		expect(enrichError("plain string", "ctx")).toBe("ctx: plain string");
	});
});

// ── httpsRequest：重定向状态机 ──

describe("httpsRequest 重定向与错误", () => {
	it("200 正常响应收集 body", async () => {
		fakeState.responses = [{ statusCode: 200, body: "hello" }];
		const result = await httpsRequest({ url: "https://example.com/x" });
		expect(result).toEqual({ status: 200, text: "hello" });
		const opts = fakeState.requestCalls[0]?.opts;
		expect(opts?.method).toBe("GET");
		expect((opts?.headers as Record<string, string>)["User-Agent"]).toBe("Obsidian-Code-Embed-Plugin");
		expect(opts?.rejectUnauthorized).toBe(false);
	});

	it("404 非 2xx 抛错（带 statusMessage）", async () => {
		fakeState.responses = [{ statusCode: 404, statusMessage: "Not Found" }];
		await expect(httpsRequest({ url: "https://example.com/x" })).rejects.toThrow("HTTP 404: Not Found");
	});

	it("301/302 重定向改为 GET 并丢弃 body", async () => {
		fakeState.responses = [
			{ statusCode: 301, headers: { location: "https://example.com/redirected" } },
			{ statusCode: 200, body: "ok" },
		];
		const result = await httpsRequest({ url: "https://example.com/x", method: "POST", body: "payload" });
		expect(result.text).toBe("ok");
		expect(fakeState.requestCalls).toHaveLength(2);
		expect(fakeState.requestCalls[1]?.opts.method).toBe("GET");
		expect(fakeState.requestCalls[1]?.req._writtenBodies).toEqual([]);
		expect(fakeState.requestCalls[0]?.req._writtenBodies).toEqual(["payload"]);
	});

	it("302 同样改 GET", async () => {
		fakeState.responses = [
			{ statusCode: 302, headers: { location: "https://example.com/y" } },
			{ statusCode: 200, body: "ok" },
		];
		await httpsRequest({ url: "https://example.com/x" });
		expect(fakeState.requestCalls[1]?.opts.method).toBe("GET");
	});

	it("307/308 保留方法与 body", async () => {
		fakeState.responses = [
			{ statusCode: 307, headers: { location: "https://example.com/y" } },
			{ statusCode: 200, body: "ok" },
		];
		const result = await httpsRequest({ url: "https://example.com/x", method: "PUT", body: "payload" });
		expect(result.text).toBe("ok");
		expect(fakeState.requestCalls[1]?.opts.method).toBe("PUT");
		expect(fakeState.requestCalls[1]?.req._writtenBodies).toEqual(["payload"]);
	});

	it("重定向到 http:// 目标被拒绝（仅支持 HTTPS）", async () => {
		fakeState.responses = [{ statusCode: 301, headers: { location: "http://example.com/x" } }];
		await expect(httpsRequest({ url: "https://example.com/x" })).rejects.toThrow(/Redirect target is HTTP/);
	});

	it("重定向缺少 Location 头抛错", async () => {
		fakeState.responses = [{ statusCode: 301, headers: {} }];
		await expect(httpsRequest({ url: "https://example.com/x" })).rejects.toThrow(/redirect without Location header/);
	});

	it("超过 5 次重定向上限抛错", async () => {
		fakeState.responses = Array.from({ length: 6 }, () => ({
			statusCode: 301,
			headers: { location: "https://example.com/loop" },
		}));
		await expect(httpsRequest({ url: "https://example.com/x" })).rejects.toThrow(/Too many redirects \(max: 5\)/);
	});

	it("请求超时（setTimeout 触发）destroy 并抛错", async () => {
		fakeState.responses = [{ statusCode: 200, noEnd: true }];
		const pending = httpsRequest({ url: "https://example.com/x" });
		const req = fakeState.requestCalls[0]?.req;
		expect(req).toBeTruthy();
		req?._timeoutCb?.();
		await expect(pending).rejects.toThrow("Request timeout");
		expect(req?._destroyed).toBe(true);
	});

	it("底层 socket 错误透传", async () => {
		fakeState.responses = [{ statusCode: 200, noEnd: true }];
		const pending = httpsRequest({ url: "https://example.com/x" });
		fakeState.requestCalls[0]?.req._errorCb?.(new Error("socket down"));
		await expect(pending).rejects.toThrow("socket down");
	});
});

// ── dispatchHttpRequest：分发与回退 ──

describe("dispatchHttpRequest", () => {
	it("skipSslVerify=false 走 Obsidian requestUrl", async () => {
		requestUrlMock.mockResolvedValue({ status: 200, text: "via-request-url" });
		const result = await dispatchHttpRequest({ url: "https://example.com/x" });
		expect(result).toEqual({ status: 200, text: "via-request-url" });
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call?.url).toBe("https://example.com/x");
		expect(call?.body).toBe("");
		expect(fakeState.requestCalls).toHaveLength(0);
	});

	it("requestUrl 抛 SSL 错时附加 Tip 提示", async () => {
		requestUrlMock.mockRejectedValue(new Error("self-signed certificate"));
		await expect(dispatchHttpRequest({ url: "https://example.com/x" })).rejects.toThrow(/Tip:.*Skip SSL/);
	});

	it("skipSslVerify=true 且 https 可用时走 Node https（不调 requestUrl）", async () => {
		fakeState.responses = [{ statusCode: 200, body: "secure" }];
		const result = await dispatchHttpRequest({ url: "https://example.com/x", skipSslVerify: true });
		expect(result.text).toBe("secure");
		expect(requestUrlMock).not.toHaveBeenCalled();
	});

	it("https 模块不可用时回退 requestUrl 并 console.warn", async () => {
		fakeState.module = null;
		requestUrlMock.mockResolvedValue({ status: 200, text: "fallback-ok" });
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		// 重新加载模块以获得未缓存的 getHttps 状态
		vi.resetModules();
		const { dispatchHttpRequest: freshDispatch } = await import("../src/utils/http-client");
		const result = await freshDispatch({ url: "https://example.com/x", skipSslVerify: true });

		expect(result).toEqual({ status: 200, text: "fallback-ok" });
		expect(requestUrlMock).toHaveBeenCalled();
		expect(warnSpy).toHaveBeenCalled();
		warnSpy.mockRestore();
		fakeState.module = makeFakeHttpsModule();
	});

	it("https 不可用且 fallback 也失败时包装错误", async () => {
		fakeState.module = null;
		requestUrlMock.mockRejectedValue(new Error("network down"));
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		vi.resetModules();
		const { dispatchHttpRequest: freshDispatch } = await import("../src/utils/http-client");
		await expect(freshDispatch({ url: "https://example.com/x", skipSslVerify: true })).rejects.toThrow(/fallback request also failed/);
		warnSpy.mockRestore();
		fakeState.module = makeFakeHttpsModule();
	});
});