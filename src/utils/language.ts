import { EXTENSION_TO_LANGUAGE } from "./constants";

export function getLanguageFromPath(path: string): [string, string] {
	const cleanPath = path.split("?")[0]?.split("#")[0] ?? path;
	const parts = cleanPath.split(".");
	const extension = parts[parts.length - 1]?.toLowerCase() ?? "";
	const language = EXTENSION_TO_LANGUAGE[extension] || extension;
	return [extension, language];
}

// 从 ./language 重新导出，方便 UI 层统一从 language 模块引入
export { extractFirstSymbolName } from "../language";
export { guessExtensionFromContent } from "../language/language";
