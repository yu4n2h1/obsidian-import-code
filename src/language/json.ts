import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

/** JSON 提取器：仅提供语言识别（package.json 特征），不参与符号提取。 */
export class JsonExtractor extends BaseExtractor {
	readonly languages = ["json"];
	readonly defPatterns: DefPattern[] = [];

	detectByContent(_firstLine: string, head: string): string | null {
		if (/^\{/.test(head) && /"dependencies"\s*:/.test(head)) return "json";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		return new Array<boolean>(lines.length).fill(false);
	}

	extractBlock(_lines: string[], _startIdx: number, _defIndent: string): string[] | null {
		return null;
	}
}
