import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

export class RustExtractor extends BaseExtractor {
	readonly languages = ["rust"];

	readonly defPatterns: DefPattern[] = [
		// pub fn Name(  with optional (crate|super|self) qualifier and generics <T>
		{
			regex: /^(\s*)(?:pub(?:\s*\(\s*(?:crate|super|self)\s*\))?\s+)?fn\s+([a-zA-Z_]\w*)\s*(?:<[^>]*>)?\s*\(/,
			nameGroup: 2,
		},
		// impl Name {  or  impl Trait for Name {
		{
			regex: /^(\s*)impl\s+(?:[\w:]+\s+for\s+)?([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// trait Name {
		{
			regex: /^(\s*)(?:pub\s+)?trait\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// enum Name {
		{
			regex: /^(\s*)(?:pub\s+)?enum\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// struct Name {
		{
			regex: /^(\s*)(?:pub\s+)?struct\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
	];

	detectByContent(_firstLine: string, head: string): string | null {
		if (/\bfn\s+main\b/.test(head) && /\buse\s+\w+/.test(head)) return "rs";
		return null;
	}

	stripComments(lines: string[]): boolean[] {
		const flags: boolean[] = new Array<boolean>(lines.length).fill(false);
		let inComment = false;
		for (let i = 0; i < lines.length; i++) {
			if (inComment) {
				flags[i] = true;
				if (lines[i]?.includes("*/")) inComment = false;
			} else if (lines[i]?.includes("/*")) {
				flags[i] = true;
				if (!lines[i]?.includes("*/")) inComment = true;
			}
		}
		return flags;
	}

	extractBlock(
		lines: string[],
		startIdx: number,
		_defIndent: string
	): string[] | null {
		let i = startIdx;
		let found = false;
		for (; i < lines.length; i++) {
			const line = lines[i];
			if (line && line.includes("{")) {
				found = true;
				break;
			}
		}
		if (!found) {
			const firstLine = lines[startIdx];
			return firstLine ? [firstLine] : null;
		}

		const result: string[] = [];
		for (let j = startIdx; j <= i; j++) {
			result.push(lines[j]!);
		}

		const openLine = lines[i];
		if (!openLine) return null;

		let depth = 0;
		for (const ch of openLine) {
			if (ch === "{") depth++;
			if (ch === "}") depth--;
		}

		if (depth === 0) return result;

		for (let j = i + 1; j < lines.length; j++) {
			const line = lines[j];
			result.push(line!);
			if (line) {
				for (const ch of line) {
					if (ch === "{") depth++;
					if (ch === "}") depth--;
				}
			}
			if (depth === 0) return result;
		}

		return null;
	}
}
