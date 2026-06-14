import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

/** Bash shell 提取器：仅提供语言识别（shebang），不参与符号提取。 */
export class BashExtractor extends BaseExtractor {
	readonly languages = ["bash"];
	readonly defPatterns: DefPattern[] = [];

	detectByFirstLine(firstLine: string): string | null {
		if (this.matchShebang(firstLine, ["bash", "sh", "zsh"])) return "sh";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		return new Array<boolean>(lines.length).fill(false);
	}

	extractBlock(_lines: string[], _startIdx: number, _defIndent: string): string[] | null {
		return null;
	}
}
