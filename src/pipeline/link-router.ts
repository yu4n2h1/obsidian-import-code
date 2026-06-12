import { isRemoteUrl, isAliasPath } from "../utils/helpers";
import type { LinkMode, ResolvedLink } from "./types";

function resolveMode(filePath: string): LinkMode {
	if (isRemoteUrl(filePath)) return "http";
	if (isAliasPath(filePath)) return "alias";
	return "local";
}

/**
 * 将已解析的 filePath（不含 @/#）解析为结构化的 ResolvedLink。
 * 完成阶段 1 的全部工作：模式判断。
 */
export function resolveLink(filePath: string): ResolvedLink {
	return { filePath, mode: resolveMode(filePath) };
}
