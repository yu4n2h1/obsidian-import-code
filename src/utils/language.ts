import { EXTENSION_TO_LANGUAGE } from "./constants";

export function getLanguageFromPath(path: string): [string, string] {
	const cleanPath = path.split("?")[0]?.split("#")[0] ?? path;
	const parts = cleanPath.split(".");
	const extension = parts[parts.length - 1]?.toLowerCase() ?? "";
	const language = EXTENSION_TO_LANGUAGE[extension] || extension;
	return [extension, language];
}

// 从 code-extractor 重新导出，方便 UI 层统一从 language 模块引入
export { extractFirstSymbolName } from "./code-extractor";

export function guessExtensionFromContent(content: string): string | null {
	const firstLine = content.trimStart().split("\n")[0]?.trim() ?? "";

	// Shebang detection
	const shebangMap: Record<string, string> = {
		python3: "py", python: "py",
		node: "js", nodejs: "js",
		bash: "sh", sh: "sh",
		zsh: "sh",
		perl: "pl",
		ruby: "rb",
		lua: "lua",
		php: "php",
	};
	if (firstLine.startsWith("#!")) {
		const parts = firstLine.substring(2).trim().split(/\s+/);
		for (const part of parts) {
			const lower = part.toLowerCase();
			for (const [key, ext] of Object.entries(shebangMap)) {
				if (lower.includes(key)) return ext;
			}
		}
	}

	// XML / HTML / PHP openers
	if (firstLine.startsWith("<?xml")) return "xml";
	if (firstLine.startsWith("<?php")) return "php";
	if (/^<!DOCTYPE\s+html/i.test(firstLine) || /^<html\b/i.test(firstLine)) return "html";

	// Content-based heuristics
	const head = content.trimStart().substring(0, 2000);

	if (/\bpackage\s+\w+\s*;/.test(head)) return "java";
	if (/\bfn\s+main\b/.test(head) && /\buse\s+\w+/.test(head)) return "rs";
	if (/\bfunc\s+main\b/.test(head) && /\bpackage\s+main\b/.test(head)) return "go";
	if (/\bimport\s+React\b/.test(head)) return "tsx";
	if (/\b(interface|type)\s+\w+\s*[<{]/.test(head) && /:\s*string\b/.test(head)) return "ts";
	if (/^def\s+\w+\s*\(/.test(head) || /^class\s+\w+.*:$/.test(head) && /^\s+def\s+/.test(head)) return "py";
	if (/^---\s/.test(head)) return "yaml";
	if (/\b(SELECT\s+|CREATE\s+TABLE\s+|INSERT\s+INTO\s+|UPDATE\s+\w+\s+SET\s+)/i.test(head)) return "sql";
	if (/^\{/.test(head) && /"dependencies"\s*:/.test(head)) return "json";
	if (/^#include\s*</.test(head)) {
		return /iostream|std::/.test(head) ? "cpp" : "c";
	}
	if (/\b(function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+)/.test(head)) return "js";

	return null;
}
