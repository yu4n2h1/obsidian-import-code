import { RemoteServiceConfig } from "../types";
import { RemoteUploadResult, RemoteUploadOptions, RemoteReadResult } from "./types";
import { dispatchHttpRequest } from "./http-client";

function buildUrl(config: RemoteServiceConfig, fileName: string): string {
	const base = config.url.replace(/\/+$/, "");
	const uploadPath = (config.uploadPath || "").replace(/^\/+/, "").replace(/\/+$/, "");
	if (uploadPath) {
		return `${base}/${uploadPath}/${fileName}`;
	}
	return `${base}/${fileName}`;
}

function buildAuthHeader(config: RemoteServiceConfig): string | null {
	if (!config.token) return null;
	if (config.username) {
		return "Basic " + btoa(`${config.username}:${config.token}`);
	}
	return `Bearer ${config.token}`;
}

export const webdavService = {
	serviceType: "webdav" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const url = buildUrl(config, filePath);
			const headers: Record<string, string> = {};
			const auth = buildAuthHeader(config);
			if (auth) headers["Authorization"] = auth;

			const resp = await dispatchHttpRequest({ url, skipSslVerify, headers });
			return { success: true, content: resp.text };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { success: false, error: `WebDAV 读取失败: ${message}` };
		}
	},

	async upload(options: RemoteUploadOptions): Promise<RemoteUploadResult> {
		const { content, fileName, config, skipSslVerify } = options;
		try {
			const url = buildUrl(config, fileName);
			const headers: Record<string, string> = {
				"Content-Type": "application/octet-stream",
			};
			const auth = buildAuthHeader(config);
			if (auth) headers["Authorization"] = auth;

			const method = "PUT";
			const body = content;

			await dispatchHttpRequest({
				url, method, body, headers, skipSslVerify,
			});

			return { success: true, url };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { success: false, error: `WebDAV 上传失败: ${message}` };
		}
	},
};
