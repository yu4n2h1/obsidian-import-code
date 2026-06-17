import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

/** SQL 提取器：仅提供语言识别（内容启发式），不参与符号提取。 */
export class SqlExtractor extends BaseExtractor {
	readonly languages = ["sql"];
	readonly defPatterns: DefPattern[] = [];

	detectByContent(_firstLine: string, head: string): string | null {
		if (/\b(SELECT\s+|CREATE\s+TABLE\s+|INSERT\s+INTO\s+|UPDATE\s+\w+\s+SET\s+)/i.test(head)) {
			return "sql";
		}
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		return new Array<boolean>(lines.length).fill(false);
	}

	extractBlock(_lines: string[], _startIdx: number, _defIndent: string): string[] | null {
		return null;
	}
}
