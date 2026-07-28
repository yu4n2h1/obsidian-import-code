import type { RemoteReadResult, RemoteService, RemoteReadParams } from "./types";
import { dispatchHttpRequest, enrichError, encodePathSegments, buildFullPath, normalizeBaseUrl } from "../utils/http-client";

export const giteaService: RemoteService = {
	serviceType: "gitea" as const,

	async read(params: RemoteReadParams): Promise<RemoteReadResult> {
		const { config, filePath, skipSslVerify } = params;
		try {
			const baseUrl = normalizeBaseUrl(config.url);
			const repo = normalizeBaseUrl(config.repo || "");
			const branch = config.branch || "main";
			const fullPath = buildFullPath(config.path, filePath);
			const encoded = encodePathSegments(fullPath);
			const url = `${baseUrl}/${repo}/raw/branch/${branch}/${encoded}`;

			const headers: Record<string, string> = {};
			if (config.token) {
				headers["Authorization"] = `token ${config.token}`;
			}

			const resp = await dispatchHttpRequest({ url, skipSslVerify, headers });
			return { success: true, content: resp.text };
		} catch (err) {
			return { success: false, error: enrichError(err, "Gitea read failed") };
		}
	},
};
