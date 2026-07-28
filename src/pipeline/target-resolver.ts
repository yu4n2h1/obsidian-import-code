import { parseLineRange } from "../utils/helpers";
import type { Target, TargetResult } from "./types";

/**
 * 解析单个目标字符串（@ 或 # 后的内容）：
 * - 纯数字或数字范围（"10" / "10-30"）→ line target
 * - 非空字符串 → symbol target
 * - 空字符串 → null（无目标）
 *
 * @param raw - 原始目标字符串
 */
export function resolveTarget(raw: string): Target | null {
	if (!raw) return null;

	const lineRange = parseLineRange(raw);
	if (lineRange) {
		return { type: "line", lineRange };
	}

	return { type: "symbol", name: raw };
}

/**
 * 同时解析 display（@symbolName）和 highlight（#highlightSpec）目标。
 *
 * @param symbolName - @ 后的内容
 * @param highlightSpec - # 后的内容
 */
export function classifyTargets(
	symbolName: string,
	highlightSpec: string,
): TargetResult {
	// # 表示「在展示内容上高亮」（display 走 @ 提取，highlight 走 # 高亮），
	// 两者独立解析，不互相提升 —— 否则 `#symbol` 会退化成提取（与 @ 等价）。
	return {
		display: resolveTarget(symbolName),
		highlight: resolveTarget(highlightSpec),
	};
}
