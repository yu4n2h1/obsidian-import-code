import type { RemoteServiceConfig } from "../types";
import type { UploadResult, UploadService } from "./types";
import {
	dispatchHttpRequest,
	enrichError,
	buildServiceUrl,
} from "../utils/http-client";

/**
 * 构建 WebDAV 认证头。
 * 与 fetchers/webdav.ts 相同的模式：
 * - 同时提供 username 和 token → Basic 认证
 * - 仅提供 token → Bearer 认证
 */
function buildAuthHeader(config: RemoteServiceConfig): string | null {
	if (!config.token) return null;
	if (config.username) {
		return "Basic " + btoa(`${config.username}:${config.token}`);
	}
	return `Bearer ${config.token}`;
}

export const webdavUploadService: UploadService = {
	serviceType: "webdav" as const,

	async upload(
		config: RemoteServiceConfig,
		ctx: { content: string; fileName: string },
		skipSslVerify: boolean
	): Promise<UploadResult> {
		try {
			const url = buildServiceUrl(config, ctx.fileName);
			const headers: Record<string, string> = {
				"Content-Type": "application/octet-stream",
			};
			const auth = buildAuthHeader(config);
			if (auth) headers["Authorization"] = auth;

			await dispatchHttpRequest({
				url,
				method: "PUT",
				body: ctx.content,
				skipSslVerify,
				headers,
			});

			return { success: true, reference: url };
		} catch (err) {
			return {
				success: false,
				error: enrichError(err, "WebDAV upload failed"),
			};
		}
	},
};
