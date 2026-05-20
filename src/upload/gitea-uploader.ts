import { UploadOptions, UploadResult } from "./types";
import { uploadGitLike } from "./git-like-uploader";

export const giteaUploader = {
	serviceType: "gitea" as const,

	async upload(options: UploadOptions): Promise<UploadResult> {
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
