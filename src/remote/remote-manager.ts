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
}
