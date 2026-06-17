import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

/** XML 提取器：仅提供语言识别（文件头标记），不参与符号提取。 */
export class XmlExtractor extends BaseExtractor {
	readonly languages = ["xml"];
	readonly defPatterns: DefPattern[] = [];

	detectByFirstLine(firstLine: string): string | null {
		if (firstLine.startsWith("<?xml")) return "xml";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		return new Array<boolean>(lines.length).fill(false);
	}

	extractBlock(_lines: string[], _startIdx: number, _defIndent: string): string[] | null {
		return null;
	}
}
