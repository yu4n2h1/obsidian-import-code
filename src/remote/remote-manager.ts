import { RemoteServiceType, RemoteServiceConfig } from "../types";
import { RemoteReadResult, RemoteService } from "./types";
import { dispatchHttpRequest } from "./http-client";
import { githubService } from "./github";
import { gitlabService } from "./gitlab";
import { giteaService } from "./gitea";
import { webdavService } from "./webdav";
import { genericService } from "./generic";

const services: Record<RemoteServiceType, RemoteService> = {
	github: githubService,
	gitlab: gitlabService,
	gitea: giteaService,
	webdav: webdavService,
	generic: genericService,
};

/**
 * Fetch file content from any remote URL.
 * Returns file content string, or null on failure.
 */
export async function readRemoteFile(
	url: string,
	skipSslVerify: boolean
): Promise<string | null> {
	try {
		const resp = await dispatchHttpRequest({ url, skipSslVerify });
		return resp.text;
	} catch (err) {
		console.error(`Error fetching ${url}:`, err);
		return null;
	}
}

/**
 * Read a file from a configured remote service.
 */
export function readFromService(
	serviceType: RemoteServiceType,
	config: RemoteServiceConfig,
	filePath: string,
	skipSslVerify: boolean
): Promise<RemoteReadResult> {
	const service = services[serviceType];
	if (!service) {
		return Promise.resolve({
			success: false,
			error: `Unsupported service type: ${serviceType}`,
		});
	}
	return service.read(config, filePath, skipSslVerify);
}
