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
			const url = `https://raw.githubusercontent.com/${repo}/${branch}/${encoded}`;
			const resp = await dispatchHttpRequest({ url, skipSslVerify });
			return { success: true, content: resp.text };
		} catch (err) {
			return { success: false, error: enrichError(err, "GitHub read failed") };
		}
	},
};
