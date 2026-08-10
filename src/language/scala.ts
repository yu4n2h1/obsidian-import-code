import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

export class ScalaExtractor extends BaseExtractor {
	readonly languages = ["scala"];

	readonly defPatterns: DefPattern[] = [
		// def name(  or  def name[T](
		{
			regex: /^(\s*)def\s+([a-zA-Z_]\w*)\s*(?:<[^>]*>)?\s*\(/,
			nameGroup: 2,
		},
		// class Name
		{
			regex: /^(\s*)(?:abstract\s+)?class\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// object Name {
		{
			regex: /^(\s*)object\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// trait Name {
		{
			regex: /^(\s*)(?:sealed\s+)?trait\s+([a-zA-Z_]\w*)/,
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
