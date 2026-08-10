import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

const VIS_MOD = "(?:(?:public|private|protected|static|final|abstract|virtual|override|inline|constexpr|explicit)\\s+)*";
const STMT_KW = "(?:if|while|for|switch|catch|return|throw|new|delete|case|goto|using|namespace|include|import|export|try|else|do)\\b";

export class CExtractor extends BaseExtractor {
	readonly languages = ["c", "cpp"];

	readonly defPatterns: DefPattern[] = [
		// [modifiers] class/struct Name
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:\\w+\\s+)*(?:class|struct)\\s+([a-zA-Z_]\\w*)`
			),
			nameGroup: 2,
		},
		// enum [class] Name {  (C enum + C++ enum class)
		{
			regex: /^(\s*)(?:enum(?:\s+class)?)\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// [modifiers] returnType name(...) { or returnType name(...)\n
		{
			regex: new RegExp(
				`^(\\s*)(?!${STMT_KW})([\\w<>\\[\\],\\s:]+?)\\s+([a-zA-Z_]\\w*)\\s*\\([^)]*\\)\\s*(?:const\\s*)?\\s*(?:\\{|$)`
			),
			nameGroup: 3,
		},
	];

	detectByContent(_firstLine: string, head: string): string | null {
		if (/^#include\s*</.test(head)) {
			return /iostream|std::/.test(head) ? "cpp" : "c";
		}
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
