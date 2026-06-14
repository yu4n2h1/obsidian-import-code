import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

/** Perl 提取器：仅提供语言识别（shebang），不参与符号提取。 */
export class PerlExtractor extends BaseExtractor {
	readonly languages = ["perl"];
	readonly defPatterns: DefPattern[] = [];

	detectByFirstLine(firstLine: string): string | null {
		if (this.matchShebang(firstLine, ["perl"])) return "pl";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		return new Array<boolean>(lines.length).fill(false);
	}

	extractBlock(_lines: string[], _startIdx: number, _defIndent: string): string[] | null {
		return null;
	}
}
