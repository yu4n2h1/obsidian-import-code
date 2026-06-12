import { BaseExtractor } from "./base-extractor";

export class YamlExtractor extends BaseExtractor {
	readonly languages = ["yaml", "yml"];

	// YAML 没有函数/类定义，无需任何匹配模式
	readonly defPatterns = [];

	stripComments(lines: string[]): boolean[] {
		return new Array(lines.length).fill(false);
	}

	extractBlock(
		_lines: string[],
		_startIdx: number,
		_defIndent: string
	): string[] | null {
		return null;
	}
}
