import { RemoteServiceConfig } from "../types";
import { RemoteReadResult } from "./types";
import { dispatchHttpRequest, enrichError, buildFullPath } from "./http-client";

export const gitlabService = {
	serviceType: "gitlab" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			if (!config.repo) {
				return { success: false, error: "Repository is required (format: owner/repo)" };
			}

			const baseUrl = config.url.replace(/\/+$/, "");
			const repo = config.repo.replace(/\/+$/, "");
			const branch = config.branch || "main";
			const encodedRepo = encodeURIComponent(repo);
			const fullPath = buildFullPath(config.path, filePath);
			const encodedPath = encodeURIComponent(fullPath);
			const url = `${baseUrl}/api/v4/projects/${encodedRepo}/repository/files/${encodedPath}/raw?ref=${branch}`;

			const headers: Record<string, string> = {
				"PRIVATE-TOKEN": config.token,
			};

			const resp = await dispatchHttpRequest({ url, skipSslVerify, headers });
			return { success: true, content: resp.text };
		} catch (err) {
			return { success: false, error: enrichError(err, "GitLab read failed") };
		}
	},
};
