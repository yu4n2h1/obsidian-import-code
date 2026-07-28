import { App, normalizePath } from "obsidian";
import type { UploadResult, UploadService, UploadParams } from "./types";

/**
 * 创建本地 Vault 上传服务。
 *
 * 工厂函数 —— 需要 Obsidian App 实例以访问 vault API。
 * 从 FileModal.handleSubmit() 提取的本地文件创建逻辑。
 */
export function createLocalUploadService(app: App): UploadService {
	return {
		serviceType: "local" as const,

		async upload(params: UploadParams): Promise<UploadResult> {
			const { ctx } = params;
			const folderPath = ctx.folderPath || "";
			const fullPath = normalizePath(
				folderPath ? `${folderPath}/${ctx.fileName}` : ctx.fileName
			);

			// 确保目标目录存在
			if (folderPath && !(await app.vault.adapter.exists(folderPath))) {
				await app.vault.createFolder(folderPath);
			}

			// 文件已存在时不覆盖
			if (!(await app.vault.adapter.exists(fullPath))) {
				await app.vault.create(fullPath, ctx.content);
			}
			return { success: true, reference: fullPath };
		},
	};
}
