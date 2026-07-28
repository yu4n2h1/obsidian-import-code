import type { RemoteReadResult, RemoteService, RemoteReadParams } from "./types";
import { dispatchHttpRequest, enrichError, encodePathSegments, buildFullPath, normalizeBaseUrl, decodeBase64Content } from "../utils/http-client";

interface GitHubContentsResponse {
	encoding?: string;
	content?: string;
}

export const githubService: RemoteService = {
	serviceType: "github" as const,

	async read(params: RemoteReadParams): Promise<RemoteReadResult> {
		const { config, filePath, skipSslVerify } = params;
		try {
			const repo = normalizeBaseUrl(config.repo || "");
			const branch = config.branch || "main";
			const fullPath = buildFullPath(config.path, filePath);
			const encoded = encodePathSegments(fullPath);
			const baseUrl = normalizeBaseUrl(config.url || "https://api.github.com");
			const url = `${baseUrl}/repos/${repo}/contents/${encoded}?ref=${branch}`;

			const headers: Record<string, string> = {
				"Accept": "application/vnd.github.object",
				"X-GitHub-Api-Version": "2026-03-10",
			};
			if (config.token) {
				headers["Authorization"] = `Bearer ${config.token}`;
			}

			const resp = await dispatchHttpRequest({ url, skipSslVerify, headers });

			const body = JSON.parse(resp.text) as GitHubContentsResponse;
			if (body.encoding === "base64" && body.content) {
				return { success: true, content: decodeBase64Content(body.content) };
			}
			return { success: true, content: resp.text };
		} catch (err) {
			return { success: false, error: enrichError(err, "GitHub read failed") };
		}
	},
};
