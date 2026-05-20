<<<<<<< HEAD
// 远程操作统一入口 — 读取远程文件 + 上传到远程服务
import { dispatchHttpRequest } from "../utils/https-module";

// 从 upload-manager 重新导出上传函数
export { uploadToRemote } from "../upload/upload-manager";

/**
 * 读取远程文件内容（HTTP / HTTPS）。
 * 当 skipSslVerify 为 true 且 URL 为 HTTPS 时，通过 Node.js https 模块跳过证书验证。
 * 返回文件内容字符串，失败时返回 null。
 */
export async function readRemoteFile(
	filePath: string,
	skipSslVerify: boolean
): Promise<string | null> {
	try {
		const resp = await dispatchHttpRequest({
			url: filePath,
			skipSslVerify,
		});
		return resp.text;
	} catch (err) {
		console.error(`Error fetching ${filePath}:`, err);
		return null;
	}
=======
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
>>>>>>> worktree-agent-a676fd2607c839652
}
