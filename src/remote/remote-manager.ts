import { RemoteServiceType, RemoteServiceConfig } from "../types";
import { RemoteReadResult, RemoteUploadResult, RemoteUploadOptions, RemoteService } from "./types";
import { dispatchHttpRequest } from "./http-client";
import { githubService } from "./github";
import { gitlabService } from "./gitlab";
import { giteaService } from "./gitea";
import { webdavService } from "./webdav";

const services: Record<RemoteServiceType, RemoteService> = {
	github: githubService,
	gitlab: gitlabService,
	gitea: giteaService,
	webdav: webdavService,
};

/**
 * 从任意远程 URL 读取代码文件内容。
 * 返回文件内容字符串，失败时返回 null。
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
 * 从指定服务的仓库中读取文件。
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
			error: `不支持的服务类型: ${serviceType}`,
		});
	}
	return service.read(config, filePath, skipSslVerify);
}

/**
 * 上传文件到指定远程服务。
 */
export function uploadToRemote(
	serviceType: RemoteServiceType,
	content: string,
	fileName: string,
	config: RemoteServiceConfig,
	skipSslVerify: boolean = false
): Promise<RemoteUploadResult> {
	const service = services[serviceType];
	if (!service) {
		return Promise.resolve({
			success: false,
			error: `不支持的服务类型: ${serviceType}`,
		});
	}
	const options: RemoteUploadOptions = {
		content,
		fileName,
		config,
		skipSslVerify,
	};
	return service.upload(options);
}
