type ExtractionStrategy = "indentation" | "braces";

const STRATEGY_MAP: Record<string, ExtractionStrategy> = {
	python: "indentation",
	ruby: "indentation",
	yaml: "indentation",
	yml: "indentation",
};

const VIS_MOD = /(?:(?:public|private|protected|static|final|abstract|virtual|override|inline|constexpr|explicit)\s+)*/;
const STMT_KW = /(?:if|while|for|switch|catch|return|throw|new|delete|case|goto|using|namespace|include|import|export|try|else|do)\b/;

const DEF_PATTERNS: { regex: RegExp; nameGroup: number }[] = [
	// Python: def name( or async def name(
	{ regex: /^(\s*)(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/, nameGroup: 2 },
	// JS/TS/PHP function: [modifiers] function name(
	{ regex: new RegExp(`^(\\s*)${VIS_MOD.source}(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+([a-zA-Z_]\\w*)\\s*\\(`), nameGroup: 2 },
	// Go/Rust/Kotlin: func/fn/fun name( with optional pub qualifier and generics
	{ regex: /^(\s*)(?:pub(?:\s*\(\s*(?:crate|super|self)\s*\))?\s+)?(?:func|fn|fun)\s+([a-zA-Z_]\w*)\s*(?:<[^>]*>)?\s*\(/, nameGroup: 2 },
	// JS/TS arrow: const name = (...) => or let name = (...) =>
	{ regex: /^(\s*)(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/, nameGroup: 2 },
	// Class definition (supports modifiers: public class, export class, data class, etc.)
	{ regex: new RegExp(`^(\\s*)${VIS_MOD.source}(?:\\w+\\s+)*class\\s+([a-zA-Z_]\\w*)`), nameGroup: 2 },
	// C-like: type name(...) — supports :: qualifiers, template types, { on same or next line
	{ regex: new RegExp(`^(\\s*)(?!${STMT_KW.source})([\\w<>\\[\\],\\s:]+?)\\s+([a-zA-Z_]\\w*)\\s*\\([^)]*\\)\\s*(?:const\\s*)?\\s*(?:\\{|$)`), nameGroup: 3 },
	// Method shorthand: [modifiers] name(...) { — inside class/object, no function keyword or return type
	{ regex: new RegExp(`^(\\s*)${VIS_MOD.source}(?:async\\s+)?([a-zA-Z_]\\w*)\\s*\\([^)]*\\)\\s*\\{`), nameGroup: 2 },
];

function getStrategy(language: string): ExtractionStrategy {
	return STRATEGY_MAP[language] ?? "braces";
}

function findDefLine(
	lines: string[],
	symbolName: string,
	commentStripped: boolean[]
): { lineIdx: number; indent: string; match: RegExpExecArray } | null {
	for (let i = 0; i < lines.length; i++) {
		if (commentStripped[i]) continue;
		const line = lines[i];
		if (!line) continue;
		for (const pattern of DEF_PATTERNS) {
			const match = pattern.regex.exec(line);
			if (match && match[pattern.nameGroup] === symbolName) {
				return { lineIdx: i, indent: match[1] ?? "", match };
			}
		}
	}
	return null;
}

// --- Brace extraction ---

function braceExtract(lines: string[], startIdx: number): string[] | null {
	let i = startIdx;
	let found = false;
	for (; i < lines.length; i++) {
		const line = lines[i];
		if (line && line.includes("{")) {
			found = true;
			break;
		}
	}
	if (!found) {
		const firstLine = lines[startIdx];
		return firstLine ? [firstLine] : null;
	}

	const result: string[] = [];
	for (let j = startIdx; j <= i; j++) {
		result.push(lines[j]!);
	}

	const openLine = lines[i];
	if (!openLine) return null;

	let depth = 0;
	for (const ch of openLine) {
		if (ch === "{") depth++;
		if (ch === "}") depth--;
	}

	if (depth === 0) return result;

	for (let j = i + 1; j < lines.length; j++) {
		const line = lines[j];
		result.push(line!);
		if (line) {
			for (const ch of line) {
				if (ch === "{") depth++;
				if (ch === "}") depth--;
			}
		}
		if (depth === 0) return result;
	}
	return null;
}

// --- Indentation extraction (Python) ---

function countLeadingSpaces(line: string): number {
	let count = 0;
	while (count < line.length && line[count] === " ") count++;
	return count;
}

function indentExtract(lines: string[], startIdx: number, baseIndent: string): string[] | null {
	const baseIndentLen = baseIndent.length;

	let colonIdx = startIdx;
	for (let i = startIdx; i < lines.length && i <= startIdx + 10; i++) {
		const line = lines[i];
		if (line && line.includes(":")) {
			colonIdx = i;
			break;
		}
	}

	let bodyStart = colonIdx + 1;
	while (bodyStart < lines.length) {
		const line = lines[bodyStart];
		const trimmed = line?.trim() ?? "";
		if (trimmed === "" || trimmed.startsWith("#")) {
			bodyStart++;
			continue;
		}
		break;
	}

	if (bodyStart >= lines.length) {
		const result: string[] = [];
		for (let i = startIdx; i <= colonIdx; i++) {
			const line = lines[i];
			if (line) result.push(line);
		}
		return result;
	}

	const bodyLine = lines[bodyStart];
	if (!bodyLine) return null;

	const bodyIndent = countLeadingSpaces(bodyLine);
	if (bodyIndent <= baseIndentLen) {
		const result: string[] = [];
		for (let i = startIdx; i <= colonIdx; i++) {
			const line = lines[i];
			if (line) result.push(line);
		}
		return result;
	}

	const result: string[] = [];
	for (let i = startIdx; i <= colonIdx; i++) {
		const line = lines[i];
		if (line) result.push(line);
	}

	for (let i = bodyStart; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const trimmed = line.trim();
		if (trimmed === "") {
			result.push(line);
			continue;
		}
		const indent = countLeadingSpaces(line);
		if (indent <= baseIndentLen) break;
		result.push(line);
	}

	return result;
}

// --- Multi-line comment stripping (brace languages) ---

function stripMultiLineComments(lines: string[]): boolean[] {
	const flags: boolean[] = new Array(lines.length).fill(false);
	let inComment = false;
	for (let i = 0; i < lines.length; i++) {
		if (inComment) {
			flags[i] = true;
			if (lines[i]?.includes("*/")) inComment = false;
		} else if (lines[i]?.includes("/*")) {
			flags[i] = true;
			if (!lines[i]?.includes("*/")) inComment = true;
		}
	}
	return flags;
}

// --- Prepend Python decorators ---

function prependDecorators(lines: string[], defIdx: number): number {
	let start = defIdx;
	for (let i = defIdx - 1; i >= 0; i--) {
		const trimmed = lines[i]?.trim() ?? "";
		if (trimmed.startsWith("@")) {
			start = i;
		} else if (trimmed === "" || trimmed.startsWith("#")) {
			continue;
		} else {
			break;
		}
	}
	return start;
}

// --- Public API ---

export function findSymbolLineRange(
	content: string,
	symbolName: string,
	language: string
): { start: number; end: number } | null {
	const strategy = getStrategy(language);
	const lines = content.split("\n");
	const commentStripped = strategy === "braces" ? stripMultiLineComments(lines) : [];

	const def = findDefLine(lines, symbolName, commentStripped);
	if (!def) return null;

	const { lineIdx } = def;

	let resultLines: string[] | null;
	if (strategy === "indentation") {
		resultLines = indentExtract(lines, lineIdx, def.indent);
	} else {
		resultLines = braceExtract(lines, lineIdx);
	}

	if (!resultLines) return null;

	while (resultLines.length > 0) {
		const last = resultLines[resultLines.length - 1];
		if (last && last.trim() === "") {
			resultLines.pop();
		} else {
			break;
		}
	}

	let start = lineIdx;
	if (strategy === "indentation") {
		const decoratorStart = prependDecorators(lines, lineIdx);
		if (decoratorStart < lineIdx) {
			start = decoratorStart;
		}
	}

	const end = lineIdx + resultLines.length - 1;
	return { start: start + 1, end: end + 1 };
}

export function extractSymbol(
	content: string,
	symbolName: string,
	language: string
): string | null {
	const strategy = getStrategy(language);
	const lines = content.split("\n");

	const commentStripped = strategy === "braces" ? stripMultiLineComments(lines) : [];

	const def = findDefLine(lines, symbolName, commentStripped);
	if (!def) return null;

	const { lineIdx } = def;

	let resultLines: string[] | null;
	if (strategy === "indentation") {
		resultLines = indentExtract(lines, lineIdx, def.indent);
	} else {
		resultLines = braceExtract(lines, lineIdx);
	}

	if (!resultLines) return null;

	if (strategy === "indentation") {
		const start = prependDecorators(lines, lineIdx);
		if (start < lineIdx) {
			const decorators: string[] = [];
			for (let i = start; i < lineIdx; i++) {
				const line = lines[i];
				if (line) decorators.push(line);
			}
			resultLines = decorators.concat(resultLines);
		}
	}

	// Trim trailing empty lines
	while (resultLines.length > 0) {
		const last = resultLines[resultLines.length - 1];
		if (last && last.trim() === "") {
			resultLines.pop();
		} else {
			break;
		}
	}

	return resultLines.join("\n");
}

/**
 * 返回代码内容中第一个函数/类/方法的名称。
 * 用于自动生成文件名（auto 策略）。
 * 未找到时返回 null。
 */
export function extractFirstSymbolName(
	content: string,
	language: string
): string | null {
	const strategy = getStrategy(language);
	const lines = content.split("\n");
	const commentStripped = strategy === "braces" ? stripMultiLineComments(lines) : [];

	for (let i = 0; i < lines.length; i++) {
		if (commentStripped[i]) continue;
		const line = lines[i];
		if (!line) continue;
		for (const pattern of DEF_PATTERNS) {
			const match = pattern.regex.exec(line);
			if (match && match[pattern.nameGroup]) {
				// 排除关键字匹配（如 if/while/for/switch/catch/return 等）
				const name = match[pattern.nameGroup]!;
				if (/^(if|while|for|switch|catch|return|throw|new|delete|case|goto|using|namespace|include|import|export|try|else|do)$/.test(name)) {
					continue;
				}
				return name;
			}
		}
	}
	return null;
}
