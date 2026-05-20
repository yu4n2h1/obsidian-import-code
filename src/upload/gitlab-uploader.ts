import { UploadOptions, UploadResult } from "./types";
import { dispatchHttpRequest } from "../utils/https-module";

export const gitlabUploader = {
	serviceType: "gitlab" as const,

	async upload(options: UploadOptions): Promise<UploadResult> {
		const { content, fileName, config, skipSslVerify } = options;

		try {
			if (!config.repo) {
				return { success: false, error: "请填写仓库地址（格式：owner/repo）" };
			}

			const repo = config.repo.replace(/\/+$/, "");
			const branch = config.branch || "main";
			const uploadPath = (config.uploadPath || "")
				.replace(/^\/+/, "")
				.replace(/\/+$/, "");

			const filePath = uploadPath
				? `${uploadPath}/${fileName}`
				: fileName;

			const baseUrl = config.url.replace(/\/+$/, "");
			const encodedRepo = encodeURIComponent(repo);
			const encodedPath = encodeURIComponent(filePath);

			const apiUrl = `${baseUrl}/api/v4/projects/${encodedRepo}/repository/files/${encodedPath}`;

			const body = JSON.stringify({
				branch,
				content,
				commit_message: `Upload ${fileName}`,
			});

			const headers: Record<string, string> = {
				"PRIVATE-TOKEN": config.token,
				"Content-Type": "application/json",
			};

			await dispatchHttpRequest({
				url: apiUrl, method: "POST", body, headers, skipSslVerify,
			});

			const rawUrl = `${baseUrl}/api/v4/projects/${encodedRepo}/repository/files/${encodedPath}/raw?ref=${branch}`;
			return { success: true, url: rawUrl };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { success: false, error: `GitLab 上传失败: ${message}` };
		}
	},
};
