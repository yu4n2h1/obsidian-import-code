import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

export class LuaExtractor extends BaseExtractor {
	readonly languages = ["lua"];

	readonly defPatterns: DefPattern[] = [
		// function name(
		{
			regex: /^(\s*)function\s+([a-zA-Z_]\w*)\s*\(/,
			nameGroup: 2,
		},
		// local function name(
		{
			regex: /^(\s*)local\s+function\s+([a-zA-Z_]\w*)\s*\(/,
			nameGroup: 2,
		},
	];

	detectByFirstLine(firstLine: string): string | null {
		if (this.matchShebang(firstLine, ["lua"])) return "lua";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		// Lua 支持 -- 行注释 和 --[[ ]] 多行注释
		const flags: boolean[] = new Array<boolean>(lines.length).fill(false);
		let inComment = false;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] ?? "";
			if (inComment) {
				flags[i] = true;
				if (line.includes("]]")) inComment = false;
				continue;
			}
			// 检查 --[[ 多行注释开始（在 -- 之后）
			const blockStart = line.indexOf("--[[");
			if (blockStart !== -1) {
				flags[i] = true;
				if (!line.includes("]]", blockStart + 4)) inComment = true;
			}
		}
		return flags;
	}

	extractBlock(
		lines: string[],
		startIdx: number,
		_defIndent: string
	): string[] | null {
		// Lua 使用关键字 block: function ... end
		// 用 end 关键字追踪而非 {}
		// 简化处理：从定义行开始，计数 function/if/do vs end
		let depth = 1;
		const result: string[] = [];

		for (let i = startIdx; i < lines.length; i++) {
			const line = lines[i];
			if (!line) continue;
			result.push(line);

			// 统计该行的 function/then/do（增加深度）和 end（减少深度）
			// 简化：只统计作为独立单词的 function/then/do 和 end
			const inc = (line.match(/\bfunction\b/g) ?? []).length +
				(line.match(/\bthen\b/g) ?? []).length +
				(line.match(/\bdo\b/g) ?? []).length;
			const dec = (line.match(/\bend\b/g) ?? []).length;
			depth += inc - dec;

			if (depth <= 0) return result;
		}

		return null;
	}
}
