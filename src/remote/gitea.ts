import { RemoteServiceConfig } from "../types";
import { RemoteReadResult } from "./types";
import { dispatchHttpRequest, enrichError, encodePathSegments, buildFullPath } from "./http-client";

export const giteaService = {
	serviceType: "gitea" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const baseUrl = config.url.replace(/\/+$/, "");
			const repo = (config.repo || "").replace(/\/+$/, "");
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
