import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

const VIS_MOD = "(?:(?:public|private|protected|static|final|abstract|virtual|override|inline|constexpr|explicit)\\s+)*";

export class PhpExtractor extends BaseExtractor {
	readonly languages = ["php"];

	readonly defPatterns: DefPattern[] = [
		// [modifiers] function name(
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}function\\s+([a-zA-Z_]\\w*)\\s*\\(`
			),
			nameGroup: 2,
		},
		// [modifiers] class Name
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:\\w+\\s+)*class\\s+([a-zA-Z_]\\w*)`
			),
			nameGroup: 2,
		},
		// [modifiers] interface Name
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:\\w+\\s+)*interface\\s+([a-zA-Z_]\\w*)`
			),
			nameGroup: 2,
		},
		// [modifiers] trait Name
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:\\w+\\s+)*trait\\s+([a-zA-Z_]\\w*)`
			),
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
		if (this.matchShebang(firstLine, ["php"])) return "php";
		if (firstLine.startsWith("<?php")) return "php";
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
