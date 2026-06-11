import { RemoteServiceConfig } from "../types";
import { RemoteReadResult } from "./types";
import { dispatchHttpRequest, enrichError, encodePathSegments, buildFullPath } from "./http-client";

export const githubService = {
	serviceType: "github" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const repo = (config.repo || "").replace(/\/+$/, "");
			const branch = config.branch || "main";
			const fullPath = buildFullPath(config.path, filePath);
			const encoded = encodePathSegments(fullPath);
			const baseUrl = (config.url || "https://api.github.com").replace(/\/+$/, "");
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
				const binary = atob(body.content);
				const bytes = new Uint8Array(binary.length);
				for (let i = 0; i < binary.length; i++) {
					bytes[i] = binary.charCodeAt(i);
				}
				return { success: true, content: new TextDecoder().decode(bytes) };
			}
			return { success: true, content: resp.text };
		} catch (err) {
			return { success: false, error: enrichError(err, "GitHub read failed") };
		}
	},
};
