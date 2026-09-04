import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

// 修饰符正则片段（内联，不共享）
const VIS_MOD = "(?:(?:public|private|protected|static|final|abstract|virtual|override|inline|constexpr|explicit)\\s+)*";

export class JavaScriptExtractor extends BaseExtractor {
	readonly languages = ["javascript", "jsx"];

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
	];

	detectByFirstLine(firstLine: string): string | null {
		if (this.matchShebang(firstLine, ["node", "nodejs"])) return "js";
		return null;
	}

	detectByContent(_firstLine: string, head: string): string | null {
		if (/\b(function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+)/.test(head)) return "js";
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
		return this.extractBraceBlockAware(lines, startIdx);
	}
}
