import { RemoteServiceConfig } from "../types";
import { RemoteReadResult } from "./types";
import { dispatchHttpRequest } from "./http-client";

function buildUrl(config: RemoteServiceConfig, filePath: string): string {
	const base = config.url.replace(/\/+$/, "");
	const uploadPath = (config.uploadPath || "").replace(/^\/+/, "").replace(/\/+$/, "");
	if (uploadPath) {
		return `${base}/${uploadPath}/${filePath}`;
	}
	return `${base}/${filePath}`;
}

function buildAuthHeader(config: RemoteServiceConfig): string | null {
	if (!config.token) return null;
	return `Bearer ${config.token}`;
}

export const genericService = {
	serviceType: "generic" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const url = buildUrl(config, filePath);
			const headers: Record<string, string> = {};
			const auth = buildAuthHeader(config);
			if (auth) headers["Authorization"] = auth;

			const resp = await dispatchHttpRequest({ url, skipSslVerify, headers });
			return { success: true, content: resp.text };
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return { success: false, error: `Generic read failed: ${message}` };
		}
	},
};
