import { UploadOptions, UploadResult } from "./types";
import { uploadGitLike } from "./git-like-uploader";

export const githubUploader = {
	serviceType: "github" as const,

	async upload(options: UploadOptions): Promise<UploadResult> {
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
