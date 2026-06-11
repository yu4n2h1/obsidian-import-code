import { LineRange } from "../utils/helpers";

// ---- Link mode ----

/** Wiki Link 的两种处理模式 */
export type LinkMode = "http" | "alias" | "local";

// ---- ResolvedLink（阶段 1 输出） ----

/** 链接路由阶段的输出：文件路径 + 模式 */
export interface ResolvedLink {
	filePath: string;
	mode: LinkMode;
}

// ---- FileContext（阶段 2 输出） ----

/** 文件读取阶段的输出 */
export interface FileContext {
	content: string;
	filePath: string;
	language: string;
}

// ---- TargetResult（阶段 3 输出） ----

type TargetType = "symbol" | "line";

/** 单个目标描述 */
export interface Target {
	type: TargetType;
	name?: string;
	lineRange?: LineRange;
}

/** 目标解析阶段的输出 */
export interface TargetResult {
	display: Target | null;
	highlight: Target | null;
}

// ---- SlicedContent（阶段 4 输出） ----

/** 符号转换 + 内容切片阶段的输出 */
export interface SlicedContent {
	/** 按 displayRange 切片后的展示内容 */
	displayContent: string;
	/** 高亮行索引（相对于 displayContent，0-based） */
	highlightLines: number[];
}

// ---- RenderContext（阶段 5 输入） ----

/** 视图渲染阶段的输入 */
export interface RenderContext {
	/** 文件元数据 */
	file: FileContext;
	/** 阶段 4 产出 */
	slice: SlicedContent;
	/** 当前文档路径（用于链接跳转） */
	sourcePath: string;
}
