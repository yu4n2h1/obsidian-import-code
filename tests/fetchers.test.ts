import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { createRequire } from "node:module";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// mock Obsidian 的 requestUrl（fetchers 经由 http-client 调用）
const { requestUrlMock } = vi.hoisted(() => ({ requestUrlMock: vi.fn() }));
vi.mock("obsidian", () => ({ requestUrl: requestUrlMock }));

import { githubService } from "../src/fetchers/github";
import { gitlabService } from "../src/fetchers/gitlab";
import { giteaService } from "../src/fetchers/gitea";
import { webdavService } from "../src/fetchers/webdav";
import { genericService } from "../src/fetchers/generic";
import { localService } from "../src/fetchers/local-fs";
import { readFromService, readRemoteFile } from "../src/fetchers";

// local-fs 需要 getRequire() 返回 Node 的 path/fs
const nodeRequire = createRequire(import.meta.url);

beforeAll(() => {
	vi.stubGlobal("window", {
		require: (id: string) => {
			if (id === "path") return nodeRequire("node:path");
			if (id === "fs") return nodeRequire("node:fs");
			return undefined;
		},
	});
});

afterAll(() => {
	vi.unstubAllGlobals();
});

beforeEach(() => {
	requestUrlMock.mockReset();
});

describe("githubService", () => {
	it("构造 URL 并解码 base64 内容", async () => {
		const b64 = Buffer.from("hello world").toString("base64");
		requestUrlMock.mockResolvedValue({
			status: 200,
			text: JSON.stringify({ encoding: "base64", content: b64 }),
		});
		const result = await githubService.read({
			config: { url: "", token: "tok", repo: "owner/repo", branch: "dev", path: "src" },
			filePath: "foo.ts",
			skipSslVerify: false,
		});
		expect(result).toEqual({ success: true, content: "hello world" });
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.url).toBe("https://api.github.com/repos/owner/repo/contents/src/foo.ts?ref=dev");
		expect(call.headers?.Authorization).toBe("Bearer tok");
		expect(call.headers?.Accept).toBe("application/vnd.github.object");
		expect(call.headers?.["X-GitHub-Api-Version"]).toBe("2026-03-10");
	});

	it("缺少 repo 直接失败且不发起请求", async () => {
		const result = await githubService.read({
			config: { url: "", token: "", repo: "" },
			filePath: "foo.ts",
			skipSslVerify: false,
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("Repository is required");
		expect(requestUrlMock).not.toHaveBeenCalled();
	});

	it("非 base64 响应原样返回原始 JSON 文本", async () => {
		// github read 会 JSON.parse 响应；encoding 非 base64 时返回原始 resp.text
		const raw = JSON.stringify({ encoding: "utf-8", content: "direct" });
		requestUrlMock.mockResolvedValue({ status: 200, text: raw });
		const result = await githubService.read({
			config: { url: "", token: "", repo: "o/r" },
			filePath: "x.txt",
			skipSslVerify: false,
		});
		expect(result).toEqual({ success: true, content: raw });
	});

	it("网络错误包装为 GitHub read failed", async () => {
		requestUrlMock.mockRejectedValue(new Error("boom"));
		const result = await githubService.read({
			config: { url: "", token: "", repo: "o/r" },
			filePath: "x.txt",
			skipSslVerify: false,
		});
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/^GitHub read failed: boom$/);
	});
});

describe("gitlabService", () => {
	it("构造 URL（repo 与路径均 encodeURIComponent）并解码 base64", async () => {
		const b64 = Buffer.from("gitlab content").toString("base64");
		requestUrlMock.mockResolvedValue({ status: 200, text: JSON.stringify({ encoding: "base64", content: b64 }) });
		const result = await gitlabService.read({
			config: { url: "", token: "gt", repo: "group/project", branch: "master", path: "src" },
			filePath: "a/b.py",
			skipSslVerify: false,
		});
		expect(result).toEqual({ success: true, content: "gitlab content" });
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.url).toBe("https://gitlab.com/api/v4/projects/group%2Fproject/repository/files/src%2Fa%2Fb.py?ref=master");
		expect(call.headers?.["PRIVATE-TOKEN"]).toBe("gt");
	});

	it("缺少 repo 直接失败", async () => {
		const result = await gitlabService.read({
			config: { url: "", token: "" },
			filePath: "x",
			skipSslVerify: false,
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("Repository is required");
	});
});

describe("giteaService", () => {
	it("构造 raw URL 并带 token header", async () => {
		requestUrlMock.mockResolvedValue({ status: 200, text: "raw gitea" });
		const result = await giteaService.read({
			config: { url: "https://gitea.example.com/", token: "t", repo: "o/r", branch: "develop", path: "docs" },
			filePath: "x.ts",
			skipSslVerify: false,
		});
		expect(result).toEqual({ success: true, content: "raw gitea" });
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.url).toBe("https://gitea.example.com/o/r/raw/branch/develop/docs/x.ts");
		expect(call.headers?.Authorization).toBe("token t");
	});

	it("无 token 时 Authorization 头为空", async () => {
		requestUrlMock.mockResolvedValue({ status: 200, text: "ok" });
		await giteaService.read({
			config: { url: "https://gitea.example.com", token: "", repo: "o/r" },
			filePath: "x.ts",
			skipSslVerify: false,
		});
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.headers).toEqual({});
	});
});

describe("webdavService", () => {
	it("username+token → Basic 认证", async () => {
		requestUrlMock.mockResolvedValue({ status: 200, text: "dav" });
		const result = await webdavService.read({
			config: { url: "https://dav.example.com/", token: "tok", username: "u", path: "docs" },
			filePath: "a.md",
			skipSslVerify: false,
		});
		expect(result).toEqual({ success: true, content: "dav" });
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.url).toBe("https://dav.example.com/docs/a.md");
		expect(call.headers?.Authorization).toBe("Basic " + btoa("u:tok"));
	});

	it("仅 token → Bearer 认证", async () => {
		requestUrlMock.mockResolvedValue({ status: 200, text: "dav" });
		await webdavService.read({
			config: { url: "https://dav.example.com", token: "tok" },
			filePath: "b.md",
			skipSslVerify: false,
		});
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.headers?.Authorization).toBe("Bearer tok");
	});
});

describe("genericService", () => {
	it("Bearer 认证 + buildServiceUrl", async () => {
		requestUrlMock.mockResolvedValue({ status: 200, text: "gen" });
		const result = await genericService.read({
			config: { url: "https://api.example.com/", token: "t" },
			filePath: "f.json",
			skipSslVerify: false,
		});
		expect(result).toEqual({ success: true, content: "gen" });
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.url).toBe("https://api.example.com/f.json");
		expect(call.headers?.Authorization).toBe("Bearer t");
	});
});

describe("localService", () => {
	const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "code-embed-test-"));
	afterAll(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

	it("读取 vault 外本地文件（Node fs）", async () => {
		const sub = path.join(tmpDir, "sub");
		fs.mkdirSync(sub, { recursive: true });
		fs.writeFileSync(path.join(sub, "a.txt"), "hello local");
		const result = await localService.read({
			config: { url: tmpDir, path: "sub", token: "" },
			filePath: "a.txt",
			skipSslVerify: false,
		});
		expect(result).toEqual({ success: true, content: "hello local" });
	});

	it("文件不存在返回失败", async () => {
		const result = await localService.read({
			config: { url: tmpDir, token: "" },
			filePath: "no-such-file.txt",
			skipSslVerify: false,
		});
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/^Local read failed:/);
	});
});

describe("readFromService / readRemoteFile", () => {
	it("未知 serviceType 返回失败", async () => {
		const result = await readFromService("sftp" as never, { url: "", token: "" }, "x", false);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Unsupported service type");
	});

	it("readFromService 走注册表分发（github）", async () => {
		const b64 = Buffer.from("reg").toString("base64");
		requestUrlMock.mockResolvedValue({ status: 200, text: JSON.stringify({ encoding: "base64", content: b64 }) });
		const result = await readFromService("github", { url: "", token: "", repo: "o/r" }, "x.ts", false);
		expect(result.success).toBe(true);
		expect(result.content).toBe("reg");
	});

	it("readRemoteFile 成功返回文本", async () => {
		requestUrlMock.mockResolvedValue({ status: 200, text: "remote text" });
		const content = await readRemoteFile("https://example.com/x.ts", false);
		expect(content).toBe("remote text");
	});

	it("readRemoteFile 失败返回 null", async () => {
		requestUrlMock.mockRejectedValue(new Error("net down"));
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const content = await readRemoteFile("https://example.com/x.ts", false);
		expect(content).toBeNull();
		spy.mockRestore();
	});
});