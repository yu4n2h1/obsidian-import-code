import type { RemoteReadResult, RemoteService, RemoteReadParams } from "./types";
import { dispatchHttpRequest, buildFullPath, normalizeBaseUrl, enrichError, decodeBase64Content } from "../utils/http-client";

interface GitLabFileResponse {
	encoding?: string;
	content?: string;
}

export const gitlabService: RemoteService = {
	serviceType: "gitlab" as const,

	async read(params: RemoteReadParams): Promise<RemoteReadResult> {
		const { config, filePath, skipSslVerify } = params;
		try {
			if (!config.repo) {
				return { success: false, error: "Repository is required (format: owner/repo or numeric project ID)" };
			}

			const baseUrl = normalizeBaseUrl(config.url || "https://gitlab.com");
			const repo = normalizeBaseUrl(config.repo);
			const branch = config.branch || "main";
			const encodedRepo = encodeURIComponent(repo);
			const fullPath = buildFullPath(config.path, filePath);
			const encodedPath = encodeURIComponent(fullPath);
			const url = `${baseUrl}/api/v4/projects/${encodedRepo}/repository/files/${encodedPath}?ref=${encodeURIComponent(branch)}`;

			const headers: Record<string, string> = {
				"PRIVATE-TOKEN": config.token,
			};

			const resp = await dispatchHttpRequest({ url, skipSslVerify, headers });
			const body = JSON.parse(resp.text) as GitLabFileResponse;

			// GitLab API returns base64-encoded content (same pattern as GitHub)
			if (body.encoding === "base64" && body.content) {
				return { success: true, content: decodeBase64Content(body.content) };
			}

			return { success: true, content: resp.text };
		} catch (err) {
			return { success: false, error: enrichError(err, "GitLab read failed") };
		}
	},
};
