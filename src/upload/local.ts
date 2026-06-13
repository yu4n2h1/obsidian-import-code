import { App, normalizePath } from "obsidian";
import type { RemoteServiceConfig } from "../types";
import type { UploadResult, UploadService } from "./types";
import { enrichError } from "../utils/http-client";

/**
 * 创建本地 Vault 上传服务。
 *
 * 工厂函数 —— 需要 Obsidian App 实例以访问 vault API。
 * 从 FileModal.handleSubmit() 提取的本地文件创建逻辑。
 */
export function createLocalUploadService(app: App): UploadService {
	return {
		serviceType: "local" as const,

		async upload(
			_config: RemoteServiceConfig,
			ctx: { content: string; fileName: string; folderPath?: string },
			_skipSslVerify: boolean
		): Promise<UploadResult> {
			try {
				const folderPath = ctx.folderPath || "";
				const fullPath = normalizePath(
					folderPath ? `${folderPath}/${ctx.fileName}` : ctx.fileName
				);

				// 确保目标目录存在
				if (folderPath && !(await app.vault.adapter.exists(folderPath))) {
					await app.vault.createFolder(folderPath);
				}

				// 文件已存在时不覆盖，直接返回路径
				if (await app.vault.adapter.exists(fullPath)) {
					return { success: true, reference: fullPath };
				}

				await app.vault.create(fullPath, ctx.content);
				return { success: true, reference: fullPath };
			} catch (err) {
				return {
					success: false,
					error: enrichError(err, "Local upload failed"),
				};
			}
		},
	};
}
