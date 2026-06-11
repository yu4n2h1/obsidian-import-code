import { RemoteServiceConfig } from "../types";
import { RemoteReadResult } from "./types";
import { dispatchHttpRequest, buildFullPath } from "./http-client";

export const gitlabService = {
	serviceType: "gitlab" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			if (!config.repo) {
				return { success: false, error: "Repository is required (format: owner/repo or numeric project ID)" };
			}

			const baseUrl = config.url.replace(/\/+$/, "");
			const repo = config.repo.replace(/\/+$/, "");
			const branch = config.branch || "main";
			const encodedRepo = encodeURIComponent(repo);
			const fullPath = buildFullPath(config.path, filePath);
			const encodedPath = encodeURIComponent(fullPath);
			const url = `${baseUrl}/api/v4/projects/${encodedRepo}/repository/files/${encodedPath}?ref=${encodeURIComponent(branch)}`;

			const headers: Record<string, string> = {
				"PRIVATE-TOKEN": config.token,
			};

			const resp = await dispatchHttpRequest({ url, skipSslVerify, headers });
			const body = JSON.parse(resp.text);

			// GitLab API returns base64-encoded content (same pattern as GitHub)
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
			const message = err instanceof Error ? err.message : String(err);
			return { success: false, error: `GitLab read failed: ${message}` };
		}
	},
};
