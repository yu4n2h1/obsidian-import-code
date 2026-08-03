import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

export class GoExtractor extends BaseExtractor {
	readonly languages = ["go"];

	readonly defPatterns: DefPattern[] = [
		// func Name(  with optional generics <T>
		{
			regex: /^(\s*)func\s+([a-zA-Z_]\w*)\s*(?:<[^>]*>)?\s*\(/,
			nameGroup: 2,
		},
		// func (receiver Type) Name(
		{
			regex: /^(\s*)func\s+\(\w+\s+\*?\w+\)\s+([a-zA-Z_]\w*)\s*\(/,
			nameGroup: 2,
		},
		// type Name struct {
		{
			regex: /^(\s*)type\s+([a-zA-Z_]\w*)\s+struct\s*\{/,
			nameGroup: 2,
		},
		// type Name interface {
		{
			regex: /^(\s*)type\s+([a-zA-Z_]\w*)\s+interface\s*\{/,
			nameGroup: 2,
		},
	];

	detectByContent(_firstLine: string, head: string): string | null {
		if (/\bfunc\s+main\b/.test(head) && /\bpackage\s+main\b/.test(head)) return "go";
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
