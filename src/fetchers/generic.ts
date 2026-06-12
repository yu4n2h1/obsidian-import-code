import type { RemoteServiceConfig } from "../types";
import type { RemoteReadResult, RemoteService } from "./types";
import { dispatchHttpRequest, enrichError, buildServiceUrl } from "../utils/http-client";

function buildAuthHeader(config: RemoteServiceConfig): string | null {
	if (!config.token) return null;
	return `Bearer ${config.token}`;
}

export const genericService: RemoteService = {
	serviceType: "generic" as const,

	async read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const url = buildServiceUrl(config, filePath);
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
