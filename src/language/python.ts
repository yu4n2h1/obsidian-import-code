import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

export class PythonExtractor extends BaseExtractor {
	readonly languages = ["python"];

	readonly defPatterns: DefPattern[] = [
		// def name(  or  async def name(
		{
			regex: /^(\s*)(?:async\s+)?def\s+([a-zA-Z_]\w*)\s*\(/,
			nameGroup: 2,
		},
		// class Name(...):
		{
			regex: /^(\s*)class\s+([a-zA-Z_]\w*)\s*(?:\(.*\))?\s*:/,
			nameGroup: 2,
		},
	];

	detectByFirstLine(firstLine: string): string | null {
		if (this.matchShebang(firstLine, ["python3", "python"])) return "py";
		return null;
	}

	detectByContent(_firstLine: string, head: string): string | null {
		if (/^def\s+\w+\s*\(/.test(head)) return "py";
		if (/^class\s+\w+.*:$/.test(head) && /^\s+def\s+/.test(head)) return "py";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		// Python 使用 # 注释，无 /* */ 多行注释。
		// defPatterns 天然不会匹配以 # 开头的行，无需标记。
		return new Array<boolean>(lines.length).fill(false);
	}

	extractBlock(
		lines: string[],
		startIdx: number,
		defIndent: string
	): string[] | null {
		const baseIndentLen = defIndent.length;

		// 1. 找冒号行（从 startIdx 向后最多 10 行）
		let colonIdx = startIdx;
		while (colonIdx < lines.length && colonIdx <= startIdx + 10) {
			const line = lines[colonIdx];
			if (line && line.includes(":")) break;
			colonIdx++;
		}
		if (colonIdx >= lines.length) return null;

		// 2. 跳过冒号行后的空行和 # 注释行，找第一个实质行
		let bodyStart = colonIdx + 1;
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
			const result: string[] = [];
			for (let i = startIdx; i <= colonIdx; i++) {
				const line = lines[i];
				if (line) result.push(line);
			}
			return result;
		}

		const bodyLine = lines[bodyStart];
		if (!bodyLine) return null;

		const bodyIndent = this.countLeadingSpaces(bodyLine);
		if (bodyIndent <= baseIndentLen) {
			const result: string[] = [];
			for (let i = startIdx; i <= colonIdx; i++) {
				const line = lines[i];
				if (line) result.push(line);
			}
			return result;
		}

		// 4. 收集头部行 + 体行（缩进 > baseIndentLen）
		const result: string[] = [];
		for (let i = startIdx; i <= colonIdx; i++) {
			const line = lines[i];
			if (line) result.push(line);
		}

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

	protected prependDecorators(lines: string[], defIdx: number): number {
		let start = defIdx;
		for (let i = defIdx - 1; i >= 0; i--) {
			const trimmed = lines[i]?.trim() ?? "";
			if (trimmed.startsWith("@")) {
				start = i;
			} else if (trimmed === "" || trimmed.startsWith("#")) {
				continue;
			} else {
				break;
			}
		}
		return start;
	}

	private countLeadingSpaces(line: string): number {
		let count = 0;
		while (count < line.length && line[count] === " ") count++;
		return count;
	}
}
