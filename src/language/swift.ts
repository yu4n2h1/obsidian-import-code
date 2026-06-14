import { BaseExtractor } from "./base-extractor";
import type { DefPattern } from "./base-extractor";

export class SwiftExtractor extends BaseExtractor {
	readonly languages = ["swift"];

	readonly defPatterns: DefPattern[] = [
		// func name(  or  public func name(  or  private func name(
		{
			regex: /^(\s*)(?:(?:public|private|internal|fileprivate|open)\s+)?func\s+([a-zA-Z_]\w*)\s*\(/,
			nameGroup: 2,
		},
		// class Name {
		{
			regex: /^(\s*)(?:(?:public|private|internal|fileprivate|open)\s+)?class\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// struct Name {
		{
			regex: /^(\s*)(?:(?:public|private|internal|fileprivate|open)\s+)?struct\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// enum Name {
		{
			regex: /^(\s*)(?:(?:public|private|internal|fileprivate|open)\s+)?enum\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// protocol Name {
		{
			regex: /^(\s*)(?:(?:public|private|internal|fileprivate|open)\s+)?protocol\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
		// extension Name {
		{
			regex: /^(\s*)extension\s+([a-zA-Z_]\w*)/,
			nameGroup: 2,
		},
	];

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
