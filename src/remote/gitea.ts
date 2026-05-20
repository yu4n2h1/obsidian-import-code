import { RemoteServiceConfig } from "../types";
import { RemoteReadResult } from "./types";
import { dispatchHttpRequest } from "./http-client";

export const giteaService = {
	serviceType: "gitea" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const baseUrl = config.url.replace(/\/+$/, "");
			const repo = (config.repo || "").replace(/\/+$/, "");
			const branch = config.branch || "main";
			const url = `${baseUrl}/${repo}/raw/branch/${branch}/${filePath}`;
			const resp = await dispatchHttpRequest({ url, skipSslVerify });
			return { success: true, content: resp.text };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { success: false, error: `Gitea read failed: ${message}` };
		}
	},
};
