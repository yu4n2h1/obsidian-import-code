import type { RemoteServiceConfig } from "../types";
import type { UploadResult, UploadService } from "./types";
import { dispatchHttpRequest, enrichError } from "../utils/http-client";

/**
 * GitHub Gist 上传服务。
 *
 * 通过 GitHub REST API (POST /gists) 创建私有 Gist，
 * 返回 raw URL 作为可嵌入的引用路径。
 */
export const githubGistUploadService: UploadService = {
	serviceType: "github-gist" as const,

	async upload(
		config: RemoteServiceConfig,
		ctx: { content: string; fileName: string },
		skipSslVerify: boolean
	): Promise<UploadResult> {
		try {
			const baseUrl = (config.url || "https://api.github.com").replace(
				/\/+$/,
				""
			);
			const url = `${baseUrl}/gists`;

			const headers: Record<string, string> = {
				"Accept": "application/vnd.github+json",
				"X-GitHub-Api-Version": "2026-03-10",
				"Content-Type": "application/json",
			};
			if (config.token) {
				headers["Authorization"] = `Bearer ${config.token}`;
			}

			const body = JSON.stringify({
				description: `Code snippet: ${ctx.fileName}`,
				public: false,
				files: {
					[ctx.fileName]: {
						content: ctx.content,
					},
				},
			});

			const resp = await dispatchHttpRequest({
				url,
				method: "POST",
				body,
				skipSslVerify,
				headers,
			});

			// 解析响应，提取 raw_url
			const data = JSON.parse(resp.text);
			const gistFile = data.files?.[ctx.fileName];
			if (!gistFile?.raw_url) {
				return {
					success: false,
					error: "GitHub Gist upload failed: raw_url not found in response",
				};
			}

			return { success: true, reference: gistFile.raw_url };
		} catch (err) {
			return {
				success: false,
				error: enrichError(err, "GitHub Gist upload failed"),
			};
		}
	},
};
