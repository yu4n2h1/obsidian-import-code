import type { RemoteServiceConfig } from "../types";

/**
 * 上传服务支持的类型。
 * 独立于 fetchers 的 RemoteServiceType，仅包含三种上传后端。
 */
export type UploadServiceType = "local" | "webdav" | "github-gist";

/**
 * 上传操作的结果。
 * 沿用 fetchers 的 success/error Result 对象模式。
 *
 * - 成功时：`reference` 为 vault 相对路径（本地）或远程 URL（webdav / github-gist）
 * - 失败时：`error` 为错误描述
 */
export interface UploadResult {
	success: boolean;
	reference?: string;
	error?: string;
}

/**
 * 上传操作的输入上下文。
 * 分离"上传什么"和"上传到哪里"（后者在 RemoteServiceConfig 中）。
 */
export interface UploadContext {
	/** 要写入的文件内容 */
	content: string;
	/** 目标文件名（含扩展名） */
	fileName: string;
	/** vault 内的目录路径（仅对 local 上传有意义） */
	folderPath?: string;
}

/**
 * 上传服务的统一接口。
 * 镜像 fetchers 的 RemoteService 接口。
 */
export interface UploadService {
	readonly serviceType: UploadServiceType;
	upload(
		config: RemoteServiceConfig,
		ctx: UploadContext,
		skipSslVerify: boolean
	): Promise<UploadResult>;
}
