import { getAllExtractors } from "./index";

/**
 * 通过代码内容启发式猜测文件扩展名（如 "py" / "js" / "tsx"）。
 *
 * 分两阶段遍历所有 extractor：
 *   1. 首行强信号（shebang、<?xml / <?php / <!DOCTYPE html 等文件头标记）
 *   2. 内容启发式（前 2000 字符的特征模式）
 * 检测逻辑全部内聚在各语言 extractor 中；本函数仅负责编排与两阶段优先级。
 *
 * 调用方：UI 层（modal.ts）在用户未指定扩展名时用于自动推断。
 */
export function guessExtensionFromContent(content: string): string | null {
	const firstLine = content.trimStart().split("\n")[0]?.trim() ?? "";
	const head = content.trimStart().substring(0, 2000);

	// 阶段 1：首行强信号
	for (const extractor of getAllExtractors()) {
		const result = extractor.detectByFirstLine(firstLine);
		if (result) return result;
	}

	// 阶段 2：内容启发式
	for (const extractor of getAllExtractors()) {
		const result = extractor.detectByContent(firstLine, head);
		if (result) return result;
	}

	return null;
}
