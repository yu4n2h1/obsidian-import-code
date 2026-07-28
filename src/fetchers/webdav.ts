import type { RemoteServiceConfig } from "../types";
import type { RemoteReadResult, RemoteService, RemoteReadParams } from "./types";
import { dispatchHttpRequest, enrichError, buildServiceUrl } from "../utils/http-client";

function buildAuthHeader(config: RemoteServiceConfig): string | null {
	if (!config.token) return null;
	if (config.username) {
		return "Basic " + btoa(`${config.username}:${config.token}`);
	}
	return `Bearer ${config.token}`;
}

export const webdavService: RemoteService = {
	serviceType: "webdav" as const,

	async read(params: RemoteReadParams): Promise<RemoteReadResult> {
		const { config, filePath, skipSslVerify } = params;
		try {
			const url = buildServiceUrl(config, filePath);
			const headers: Record<string, string> = {};
			const auth = buildAuthHeader(config);
			if (auth) headers["Authorization"] = auth;

			const resp = await dispatchHttpRequest({ url, skipSslVerify, headers });
			return { success: true, content: resp.text };
		} catch (err) {
			return { success: false, error: enrichError(err, "WebDAV read failed") };
		}
	},
};
