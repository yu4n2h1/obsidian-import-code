import { RemoteServiceConfig } from "../types";
import { RemoteUploadResult, RemoteUploadOptions } from "./types";
import { dispatchHttpRequest } from "./http-client";

export async function uploadGitLike(
	apiUrlBuilder: (repo: string, filePath: string) => string,
	rawUrlBuilder: (config: RemoteServiceConfig, filePath: string) => string,
	method: string,
	options: RemoteUploadOptions
): Promise<RemoteUploadResult> {
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
		const filePath = (uploadPath
			? `${uploadPath}/${fileName}`
			: fileName)
			.split("/")
			.map(encodeURIComponent)
			.join("/");
		const apiUrl = apiUrlBuilder(repo, filePath);

		const encoded = btoa(unescape(encodeURIComponent(content)));

		const body = JSON.stringify({
			message: `Upload ${fileName}`,
			content: encoded,
			branch,
		});

		const headers: Record<string, string> = {
			"Authorization": `token ${config.token}`,
			"Content-Type": "application/json",
		};

		await dispatchHttpRequest({
			url: apiUrl, method, body, headers, skipSslVerify,
		});

		const rawUrl = rawUrlBuilder(config, filePath);
		return { success: true, url: rawUrl };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { success: false, error: `上传失败: ${message}` };
	}
}
