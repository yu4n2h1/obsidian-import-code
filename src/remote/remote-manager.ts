import { RemoteServiceConfig, RemoteServiceType } from "../types";
import { RemoteUploadResult, RemoteUploadOptions, RemoteReadResult, RemoteService } from "./types";
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

// 根据服务类型从远程读取文件
export function readRemoteFile(
	serviceType: RemoteServiceType,
	config: RemoteServiceConfig,
	filePath: string,
	skipSslVerify: boolean = false
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

// readFromService 是 readRemoteFile 的别名，按服务类型读取远程文件
export function readFromService(
	serviceType: RemoteServiceType,
	config: RemoteServiceConfig,
	filePath: string,
	skipSslVerify: boolean
): Promise<RemoteReadResult> {
	return readRemoteFile(serviceType, config, filePath, skipSslVerify);
}

// 根据服务类型上传到远程
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
