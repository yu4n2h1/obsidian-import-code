import { App } from "obsidian";
import type { RemoteServiceConfig } from "../types";
import type {
	UploadServiceType,
	UploadResult,
	UploadContext,
	UploadService,
	UploadParams,
} from "./types";
import { createLocalUploadService } from "./local";
import { webdavUploadService } from "./webdav";
import { githubGistUploadService } from "./github-gist";
import { enrichError } from "../utils/http-client";

/**
 * 构建上传服务注册表。
 *
 * App 参数是必需的，因为 local 上传服务需要访问 vault API。
 * 在插件初始化或模态框打开时调用一次即可。
 */
export function createUploadServices(
	app: App
): Record<UploadServiceType, UploadService> {
	return {
		local: createLocalUploadService(app),
		webdav: webdavUploadService,
		"github-gist": githubGistUploadService,
	};
}

/**
 * 每种上传服务的错误上下文（供 enrichError 统一包装）。
 * 用 switch 而非 Record 索引，避免 noUncheckedIndexedAccess 下的类型断言。
 */
function uploadErrorContext(serviceType: UploadServiceType): string {
	switch (serviceType) {
		case "local":
			return "Local upload failed";
		case "webdav":
			return "WebDAV upload failed";
		case "github-gist":
			return "GitHub Gist upload failed";
	}
}

/**
 * 统一的上传错误封装：捕获服务抛出的异常并用 enrichError 包装为失败结果。
 * 服务自行返回的 in-band 失败（如 { success: false, error }）原样透传。
 */
async function withUploadError(
	context: string,
	fn: () => Promise<UploadResult>
): Promise<UploadResult> {
	try {
		return await fn();
	} catch (err) {
		return { success: false, error: enrichError(err, context) };
	}
}

/**
 * 将上传请求分发到指定的服务。
 *
 * @param services - 由 createUploadServices() 构建的注册表
 * @param serviceType - 目标上传服务类型
 * @param config - 远程服务配置（凭证、URL 等）
 * @param ctx - 上传上下文（内容、文件名、目录路径）
 * @param skipSslVerify - 是否跳过 SSL 证书验证
 */
export async function uploadToService(
	services: Record<UploadServiceType, UploadService>,
	serviceType: UploadServiceType,
	config: RemoteServiceConfig,
	ctx: UploadContext,
	skipSslVerify: boolean
): Promise<UploadResult> {
	const service = services[serviceType];
	if (!service) {
		return {
			success: false,
			error: `Unsupported upload service type: ${serviceType}`,
		};
	}
	return withUploadError(uploadErrorContext(serviceType), () =>
		service.upload({ config, ctx, skipSslVerify })
	);
}

// Barrel re-exports
export type { UploadServiceType, UploadResult, UploadContext, UploadService, UploadParams };
