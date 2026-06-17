import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

// 修饰符正则片段（内联，不共享）
const VIS_MOD = "(?:(?:public|private|protected|static|final|abstract|virtual|override|inline|constexpr|explicit)\\s+)*";

export class TypeScriptExtractor extends BaseExtractor {
	readonly languages = ["typescript", "tsx"];

	readonly defPatterns: DefPattern[] = [
		// [modifiers] function name(  (含 function* generator)
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\*?\\s*([a-zA-Z_]\\w*)\\s*\\(`
			),
			nameGroup: 2,
		},
		// const/let/var name = (...) =>
		{
			regex: /^(\s*)(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
			nameGroup: 2,
		},
		// [modifiers] class Name
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:\\w+\\s+)*class\\s+([a-zA-Z_]\\w*)`
			),
			nameGroup: 2,
		},
		// get name() {  or  set name(val) {
		{
			regex: /^(\s*)(?:get|set)\s+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/,
			nameGroup: 2,
		},
		// [modifiers] method() {  (简写方法)
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:async\\s+)?([a-zA-Z_]\\w*)\\s*\\([^)]*\\)\\s*\\{`
			),
			nameGroup: 2,
		},
		// interface Name {
		{
			regex: /^(\s*)(?:export\s+)?interface\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// type Name =
		{
			regex: /^(\s*)(?:export\s+)?type\s+([a-zA-Z_]\w*)\s*=/,
			nameGroup: 2,
		},
		// enum Name {
		{
			regex: /^(\s*)(?:export\s+)?(?:const\s+)?enum\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// namespace Name {  or  module Name {
		{
			regex: /^(\s*)(?:export\s+)?(?:namespace|module)\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
	];

	detectByContent(_firstLine: string, head: string): string | null {
		if (/\bimport\s+React\b/.test(head)) return "tsx";
		if (/\b(interface|type)\s+\w+\s*[<{]/.test(head) && /:\s*string\b/.test(head)) return "ts";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		const flags: boolean[] = new Array<boolean>(lines.length).fill(false);
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

	extractBlock(
		lines: string[],
		startIdx: number,
		_defIndent: string
	): string[] | null {
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
}
