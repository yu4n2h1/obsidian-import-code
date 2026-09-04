import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

// 修饰符和语句关键字正则片段（内联，不共享）
const VIS_MOD = "(?:(?:public|private|protected|static|final|abstract|virtual|override|inline|constexpr|explicit)\\s+)*";
const STMT_KW = "(?:if|while|for|switch|catch|return|throw|new|delete|case|goto|using|namespace|include|import|export|try|else|do)\\b";

export class DefaultExtractor extends BaseExtractor {
	readonly languages: string[] = []; // 兜底，不注册任何语言

	readonly defPatterns: DefPattern[] = [
		// Python: def name(  or  async def name(
		{
			regex: /^(\s*)(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/,
			nameGroup: 2,
		},
		// JS/TS/PHP function: [modifiers] function name(
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?function\\s+([a-zA-Z_]\\w*)\\s*\\(`
			),
			nameGroup: 2,
		},
		// Go/Rust/Kotlin: func/fn/fun name(
		{
			regex: /^(\s*)(?:pub(?:\s*\(\s*(?:crate|super|self)\s*\))?\s+)?(?:func|fn|fun)\s+([a-zA-Z_]\w*)\s*(?:<[^>]*>)?\s*\(/,
			nameGroup: 2,
		},
		// JS/TS arrow: const name = (...) =>
		{
			regex: /^(\s*)(?:export\s+)?(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/,
			nameGroup: 2,
		},
		// Class definition
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:\\w+\\s+)*class\\s+([a-zA-Z_]\\w*)`
			),
			nameGroup: 2,
		},
		// C-like: type name(...)
		{
			regex: new RegExp(
				`^(\\s*)(?!${STMT_KW})([\\w<>\\[\\],\\s:]+?)\\s+([a-zA-Z_]\\w*)\\s*\\([^)]*\\)\\s*(?:const\\s*)?\\s*(?:\\{|$)`
			),
			nameGroup: 3,
		},
		// Method shorthand: [modifiers] name(...) {
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:async\\s+)?([a-zA-Z_]\\w*)\\s*\\([^)]*\\)\\s*\\{`
			),
			nameGroup: 2,
		},
	];

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
