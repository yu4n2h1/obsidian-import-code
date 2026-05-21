import { RemoteServiceConfig } from "../types";
import { RemoteReadResult } from "./types";
import { dispatchHttpRequest, enrichError, encodePathSegments, buildFullPath } from "./http-client";

function buildUrl(config: RemoteServiceConfig, filePath: string): string {
	const base = config.url.replace(/\/+$/, "");
	const fullPath = buildFullPath(config.path, filePath);
	const encoded = encodePathSegments(fullPath);
	return `${base}/${encoded}`;
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
			return { success: false, error: enrichError(err, "Generic read failed") };
		}
	},
};
