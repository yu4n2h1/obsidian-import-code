import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

const VIS_MOD = "(?:(?:public|private|protected|static|final|abstract|virtual|override|inline|constexpr|explicit)\\s+)*";

export class KotlinExtractor extends BaseExtractor {
	readonly languages = ["kotlin"];

	readonly defPatterns: DefPattern[] = [
		// fun Name(  with optional generics <T>
		{
			regex: /^(\s*)(?:override\s+)?fun\s+([a-zA-Z_]\w*)\s*(?:<[^>]*>)?\s*\(/,
			nameGroup: 2,
		},
		// [modifiers] class Name
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:\\w+\\s+)*class\\s+([a-zA-Z_]\\w*)`
			),
			nameGroup: 2,
		},
		// interface Name {
		{
			regex: /^(\s*)interface\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// object Name {
		{
			regex: /^(\s*)object\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// enum class Name {
		{
			regex: /^(\s*)enum\s+class\s+([a-zA-Z_]\w*)/,
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
