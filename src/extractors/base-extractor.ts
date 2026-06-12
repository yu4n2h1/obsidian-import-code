export interface DefPattern {
	regex: RegExp;
	nameGroup: number;
}

/**
 * 符号提取器抽象基类。
 * 模板方法 findSymbolLineRange() 编排提取流程，
 * 子类只需提供 languages、defPatterns、stripComments、extractBlock。
 */
export abstract class BaseExtractor {
	abstract readonly languages: string[];
	abstract readonly defPatterns: DefPattern[];

	/** 返回与 lines 等长的 boolean 数组，true 表示该行位于注释内（匹配时应跳过）。 */
	abstract stripComments(lines: string[]): boolean[];

	/**
	 * 从 lines 中提取 startIdx 处符号定义的完整代码块。
	 * defIndent 为定义行的前缀空白字符串（来自 findDefLine 的 indent）。
	 * 返回提取到的全部行（包含定义头部），或 null 表示提取失败。
	 */
	abstract extractBlock(
		lines: string[],
		startIdx: number,
		defIndent: string
	): string[] | null;

	// ---- 模板方法 ----

	/**
	 * 查找命名符号的 1-based 行范围。
	 * 模板方法：剥离注释 → 查找定义 → 提取块 → 裁剪尾空行 → 装饰器 → 计算范围。
	 */
	findSymbolLineRange(
		content: string,
		symbolName: string
	): { start: number; end: number } | null {
		const lines = content.split("\n");
		const commentStripped = this.stripComments(lines);

		const def = this.findDefLine(lines, symbolName, commentStripped);
		if (!def) return null;

		const resultLines = this.extractBlock(lines, def.lineIdx, def.indent);
		if (!resultLines) return null;

		// 裁剪尾空行
		while (resultLines.length > 0) {
			const last = resultLines[resultLines.length - 1];
			if (last && last.trim() === "") {
				resultLines.pop();
			} else {
				break;
			}
		}

		let start = def.lineIdx;
		const decoratorStart = this.prependDecorators(lines, def.lineIdx);
		if (decoratorStart < def.lineIdx) {
			start = decoratorStart;
		}

		const end = def.lineIdx + resultLines.length - 1;
		return { start: start + 1, end: end + 1 };
	}

	// ---- 共享算法（操作 this.defPatterns，与语言策略无关） ----

	/**
	 * 在 lines 中定位命名符号的定义行。
	 * 跳过 commentStripped[i] === true 的行，用 this.defPatterns 逐一匹配。
	 */
	protected findDefLine(
		lines: string[],
		symbolName: string,
		commentStripped: boolean[]
	): { lineIdx: number; indent: string; match: RegExpExecArray } | null {
		for (let i = 0; i < lines.length; i++) {
			if (commentStripped[i]) continue;
			const line = lines[i];
			if (!line) continue;
			for (const pattern of this.defPatterns) {
				const match = pattern.regex.exec(line);
				if (match && match[pattern.nameGroup] === symbolName) {
					return { lineIdx: i, indent: match[1] ?? "", match };
				}
			}
		}
		return null;
	}

	/**
	 * 返回代码内容中第一个函数/类/方法的名称。
	 * 用于自动生成文件名（auto 策略）。未找到时返回 null。
	 */
	extractFirstSymbolName(content: string): string | null {
		const lines = content.split("\n");
		const commentStripped = this.stripComments(lines);

		for (let i = 0; i < lines.length; i++) {
			if (commentStripped[i]) continue;
			const line = lines[i];
			if (!line) continue;
			for (const pattern of this.defPatterns) {
				const match = pattern.regex.exec(line);
				if (match && match[pattern.nameGroup]) {
					const name = match[pattern.nameGroup]!;
					// 排除语句关键字（if/while/for/switch/catch/return 等）
					if (
						/^(if|while|for|switch|catch|return|throw|new|delete|case|goto|using|namespace|include|import|export|try|else|do)$/.test(
							name
						)
					) {
						continue;
					}
					return name;
				}
			}
		}
		return null;
	}

	/**
	 * 回溯定义行之前的装饰器（如 Python @decorator）。
	 * 默认不做任何回溯，直接返回 defIdx。子类可覆盖。
	 */
	protected prependDecorators(_lines: string[], defIdx: number): number {
		return defIdx;
	}
}
