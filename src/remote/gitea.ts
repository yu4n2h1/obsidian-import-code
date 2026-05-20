import { RemoteServiceConfig } from "../types";
import { RemoteUploadResult, RemoteUploadOptions, RemoteReadResult } from "./types";
import { uploadGitLike } from "./git-like-uploader";
import { dispatchHttpRequest } from "./http-client";

export const giteaService = {
	serviceType: "gitea" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const baseUrl = config.url.replace(/\/+$/, "");
			const repo = (config.repo || "").replace(/\/+$/, "");
			const branch = config.branch || "main";
			const url = `${baseUrl}/${repo}/raw/branch/${branch}/${filePath}`;
			const resp = await dispatchHttpRequest({ url, skipSslVerify });
			return { success: true, content: resp.text };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { success: false, error: `Gitea 读取失败: ${message}` };
		}
	},

	async upload(options: RemoteUploadOptions): Promise<RemoteUploadResult> {
		const baseUrl = options.config.url.replace(/\/+$/, "");
		return uploadGitLike(
			(repo, filePath) =>
				`${baseUrl}/${repo}/contents/${filePath}`,
			(cfg, filePath) => {
				const repo = (cfg.repo || "").replace(/\/+$/, "");
				const branch = cfg.branch || "main";
				return `${baseUrl}/${repo}/raw/branch/${branch}/${filePath}`;
			},
			"POST",
			options
		);
	},
};
