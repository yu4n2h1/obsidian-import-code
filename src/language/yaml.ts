import { BaseExtractor } from "./base-extractor";

export class YamlExtractor extends BaseExtractor {
	readonly languages = ["yaml", "yml"];

	// YAML 没有函数/类定义，无需任何匹配模式
	readonly defPatterns = [];

	detectByContent(_firstLine: string, head: string): string | null {
		if (/^---\s/.test(head)) return "yaml";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		return new Array<boolean>(lines.length).fill(false);
	}

	extractBlock(
		_lines: string[],
		_startIdx: number,
		_defIndent: string
	): string[] | null {
		return null;
	}
}
