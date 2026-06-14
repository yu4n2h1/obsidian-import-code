import type { RemoteServiceConfig } from "../types";
import type { RemoteReadResult, RemoteService } from "./types";
import { dispatchHttpRequest, enrichError, encodePathSegments, buildFullPath, normalizeBaseUrl, decodeBase64Content } from "../utils/http-client";

export const githubService: RemoteService = {
	serviceType: "github" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
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

			const body = JSON.parse(resp.text);
			if (body.encoding === "base64" && body.content) {
				return { success: true, content: decodeBase64Content(body.content) };
			}
			return { success: true, content: resp.text };
		} catch (err) {
			return { success: false, error: enrichError(err, "GitHub read failed") };
		}
	},
};
