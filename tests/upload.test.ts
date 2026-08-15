import { describe, it, expect, vi, beforeEach } from "vitest";

const { requestUrlMock } = vi.hoisted(() => ({ requestUrlMock: vi.fn() }));
vi.mock("obsidian", () => ({
	requestUrl: requestUrlMock,
	normalizePath: (p: string) => p.replace(/\\/g, "/").replace(/\/{2,}/g, "/"),
	App: class {},
}));

import { createUploadServices, uploadToService } from "../src/upload";
import type { UploadServiceType } from "../src/upload";
import { githubGistUploadService } from "../src/upload/github-gist";
import { webdavUploadService } from "../src/upload/webdav";
import type { UploadResult } from "../src/upload";

function services() {
	return createUploadServices({} as never);
}

beforeEach(() => {
	requestUrlMock.mockReset();
});

describe("githubGistUploadService", () => {
	it("POST /gists 并返回 raw_url", async () => {
		requestUrlMock.mockResolvedValue({
			status: 201,
			text: JSON.stringify({ files: { "a.ts": { raw_url: "https://gist.githubusercontent.com/x/raw/a.ts" } } }),
		});
		const result = await uploadToService(services(), "github-gist", { url: "", token: "tok" }, { content: "code", fileName: "a.ts" }, false);
		expect(result).toEqual({ success: true, reference: "https://gist.githubusercontent.com/x/raw/a.ts" });
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.url).toBe("https://api.github.com/gists");
		expect(call.method).toBe("POST");
		expect(call.headers?.Authorization).toBe("Bearer tok");
		const body = JSON.parse(call.body as string);
		expect(body.public).toBe(false);
		expect(body.files["a.ts"].content).toBe("code");
	});

	it("响应缺少 raw_url 返回失败", async () => {
		requestUrlMock.mockResolvedValue({ status: 201, text: JSON.stringify({ files: {} }) });
		const result = await uploadToService(services(), "github-gist", { url: "", token: "" }, { content: "c", fileName: "a.ts" }, false);
		expect(result.success).toBe(false);
		expect(result.error).toContain("raw_url not found");
	});

	it("网络错误被 uploadToService 包装", async () => {
		requestUrlMock.mockRejectedValue(new Error("net"));
		const result = await uploadToService(services(), "github-gist", { url: "", token: "" }, { content: "c", fileName: "a.ts" }, false);
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/^GitHub Gist upload failed: net$/);
	});
});

describe("webdavUploadService", () => {
	it("PUT 上传并返回 URL（Basic 认证）", async () => {
		requestUrlMock.mockResolvedValue({ status: 201, text: "" });
		const result = await uploadToService(services(), "webdav", { url: "https://dav.example.com/", token: "t", username: "u", path: "uploads" }, { content: "data", fileName: "b.md" }, false);
		expect(result.success).toBe(true);
		expect(result.reference).toBe("https://dav.example.com/uploads/b.md");
		const call = requestUrlMock.mock.calls[0]?.[0];
		expect(call.method).toBe("PUT");
		expect(call.body).toBe("data");
		expect(call.headers?.Authorization).toBe("Basic " + btoa("u:t"));
		expect(call.headers?.["Content-Type"]).toBe("application/octet-stream");
	});
});

describe("localUploadService", () => {
	function makeFakeApp() {
		const exists = vi.fn();
		const createFolder = vi.fn();
		const create = vi.fn();
		const app = {
			vault: {
				adapter: { exists },
				createFolder,
				create,
			},
		};
		return { app, exists, createFolder, create };
	}

	it("目录不存在时创建目录并新建文件（created=true）", async () => {
		const { app, exists, createFolder, create } = makeFakeApp();
		exists.mockResolvedValue(false);
		const svc = createUploadServices(app as never);
		const result = await uploadToService(svc, "local", {} as never, { content: "c", fileName: "a.ts", folderPath: "assets" }, false);
		expect(createFolder).toHaveBeenCalledWith("assets");
		expect(create).toHaveBeenCalledWith("assets/a.ts", "c");
		expect(result).toEqual({ success: true, reference: "assets/a.ts", created: true });
	});

	it("文件已存在不覆盖（created=false）", async () => {
		const { app, exists, createFolder, create } = makeFakeApp();
		exists.mockResolvedValue(true);
		const svc = createUploadServices(app as never);
		const result = await uploadToService(svc, "local", {} as never, { content: "c", fileName: "a.ts" }, false);
		expect(create).not.toHaveBeenCalled();
		expect(result.created).toBe(false);
	});

	it("无 folderPath 时不创建目录", async () => {
		const { app, exists, createFolder, create } = makeFakeApp();
		exists.mockResolvedValue(false);
		const svc = createUploadServices(app as never);
		await uploadToService(svc, "local", {} as never, { content: "c", fileName: "a.ts" }, false);
		expect(createFolder).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledWith("a.ts", "c");
	});
});

describe("uploadToService 分发", () => {
	it("未知 serviceType 返回失败", async () => {
		const result = await uploadToService(services(), "sftp" as UploadServiceType, {} as never, { content: "c", fileName: "a" }, false);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Unsupported upload service type");
	});

	it("服务抛异常被 withUploadError 包装", async () => {
		const throwingService = {
			serviceType: "webdav" as const,
			async upload() { throw new Error("disk full"); },
		};
		const svc = { ...services(), webdav: throwingService };
		const result = await uploadToService(svc, "webdav", { url: "", token: "" }, { content: "c", fileName: "a" }, false);
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/^WebDAV upload failed: disk full$/);
	});

	it("createUploadServices 注册三种服务", () => {
		const svc = services();
		expect(Object.keys(svc).sort()).toEqual(["github-gist", "local", "webdav"]);
	});
});