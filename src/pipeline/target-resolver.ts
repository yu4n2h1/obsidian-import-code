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
	return {
		display: resolveTarget(symbolName),
		highlight: resolveTarget(highlightSpec),
	};
}
