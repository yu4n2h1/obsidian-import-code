import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

export class RubyExtractor extends BaseExtractor {
	readonly languages = ["ruby"];

	readonly defPatterns: DefPattern[] = [
		// def name  or  def self.name
		{
			regex: /^(\s*)def\s+(?:self\.)?([a-zA-Z_]\w*)(?:\(|\b)/,
			nameGroup: 2,
		},
		// class Name
		{
			regex: /^(\s*)class\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// module Name
		{
			regex: /^(\s*)module\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
	];

	stripComments(lines: string[]): boolean[] {
		// Ruby 使用 # 注释（无 /* */），但 =begin/=end 多行注释极少见，忽略。
		return new Array(lines.length).fill(false);
	}

	extractBlock(
		lines: string[],
		startIdx: number,
		defIndent: string
	): string[] | null {
		const baseIndentLen = defIndent.length;

		// 1. 找定义行（可能含 do、|args| 等内容，直接取 startIdx）
		// Ruby 的定义体缩进从下一行开始
		let bodyStart = startIdx + 1;

		// 2. 跳过定义行后的空行和注释行，找第一个实质行
		while (bodyStart < lines.length) {
			const line = lines[bodyStart];
			const trimmed = line?.trim() ?? "";
			if (trimmed === "" || trimmed.startsWith("#")) {
				bodyStart++;
				continue;
			}
			break;
		}

		// 3. 无体或缩进不够 → 只返回头部
		if (bodyStart >= lines.length) {
			const line = lines[startIdx];
			return line ? [line] : null;
		}

		const bodyLine = lines[bodyStart];
		if (!bodyLine) return null;

		const bodyIndent = this.countLeadingSpaces(bodyLine);
		if (bodyIndent <= baseIndentLen) {
			const line = lines[startIdx];
			return line ? [line] : null;
		}

		// 4. 收集头部 + 体行（缩进 > baseIndentLen）
		const result: string[] = [lines[startIdx]!];

		for (let i = bodyStart; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;
			const trimmed = line.trim();
			if (trimmed === "") {
				result.push(line);
				continue;
			}
			const indent = this.countLeadingSpaces(line);
			if (indent <= baseIndentLen) break;
			result.push(line);
		}

		return result;
	}

	private countLeadingSpaces(line: string): number {
		let count = 0;
		while (count < line.length && line[count] === " ") count++;
		return count;
	}
}
