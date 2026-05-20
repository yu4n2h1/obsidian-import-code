import { RemoteServiceConfig } from "../types";
import { RemoteUploadResult, RemoteUploadOptions, RemoteReadResult } from "./types";
import { uploadGitLike } from "./git-like-uploader";
import { dispatchHttpRequest } from "./http-client";

export const githubService = {
	serviceType: "github" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const repo = (config.repo || "").replace(/\/+$/, "");
			const branch = config.branch || "main";
			const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
			const resp = await dispatchHttpRequest({ url, skipSslVerify });
			return { success: true, content: resp.text };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { success: false, error: `GitHub 读取失败: ${message}` };
		}
	},

	async upload(options: RemoteUploadOptions): Promise<RemoteUploadResult> {
		return uploadGitLike(
			(repo, filePath) =>
				`https://api.github.com/repos/${repo}/contents/${filePath}`,
			(cfg, filePath) => {
				const repo = (cfg.repo || "").replace(/\/+$/, "");
				const branch = cfg.branch || "main";
				return `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
			},
			"PUT",
			options
		);
	},
};
