import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

const VIS_MOD = "(?:(?:public|private|protected|static|final|abstract|virtual|override|inline|constexpr|explicit)\\s+)*";
const STMT_KW = "(?:if|while|for|switch|catch|return|throw|new|delete|case|goto|using|namespace|include|import|export|try|else|do)\\b";

export class CSharpExtractor extends BaseExtractor {
	readonly languages = ["csharp"];

	readonly defPatterns: DefPattern[] = [
		// [modifiers] class/interface/struct/enum Name
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?:\\w+\\s+)*(?:class|interface|struct|enum)\\s+([a-zA-Z_]\\w*)`
			),
			nameGroup: 2,
		},
		// [modifiers] returnType name(...) { or returnType name(...)\n
		{
			regex: new RegExp(
				`^(\\s*)${VIS_MOD}(?!${STMT_KW})([\\w<>\\[\\],\\s:]+?)\\s+([a-zA-Z_]\\w*)\\s*\\([^)]*\\)\\s*(?:const\\s*)?\\s*(?:\\{|$)`
			),
			nameGroup: 3,
		},
		// [modifiers] method() {  (简写方法)
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
