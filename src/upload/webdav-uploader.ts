import { UploadOptions } from "./types";
import { dispatchHttpRequest } from "../utils/https-module";

function buildUrl(config: UploadOptions["config"], fileName: string): string {
	const base = config.url.replace(/\/+$/, "");
	const uploadPath = (config.uploadPath || "").replace(/^\/+/, "").replace(/\/+$/, "");
	if (uploadPath) {
		return `${base}/${uploadPath}/${fileName}`;
	}
	return `${base}/${fileName}`;
}

function buildAuthHeader(config: UploadOptions["config"]): string | null {
	if (!config.token) return null;
	if (config.username) {
		return "Basic " + btoa(`${config.username}:${config.token}`);
	}
	return `Bearer ${config.token}`;
}

export const webdavUploader = {
	serviceType: "webdav" as const,

	async upload(options: UploadOptions) {
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
