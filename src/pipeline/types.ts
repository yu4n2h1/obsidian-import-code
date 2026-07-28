import type { LineRange } from "../utils/helpers";

// ── 数据获取层输出 ──

export type SourceMode = "http" | "alias" | "local";

export interface ResolvedContent {
	content: string;
	language: string;
	filePath: string;
	sourceMode: SourceMode;
}

// ── 目标解析层输出 ──

/** Target 是 discriminated union：symbol 按名称提取，line 按行号范围切片 */
export type Target = { type: "symbol"; name: string } | { type: "line"; lineRange: LineRange };

export interface TargetResult {
	display: Target | null;
	highlight: Target | null;
}

// ── 切片层输出 ──

export interface SlicedContent {
	/** 按 display 目标切片后的展示内容 */
	displayContent: string;
	/** 高亮行索引（0-based，相对于 displayContent） */
	highlightLines: number[];
	/** displayContent 首行在源文件中的 1-based 行号（用于行号显示） */
	startLine: number;
}

// ── 渲染输入 ──

export interface RenderOptions {
	/** 是否显示行号 */
	showLineNumbers?: boolean;
	/** 超过多少行自动折叠；0 或 undefined 表示不折叠 */
	foldThreshold?: number;
	/** 折叠状态下最多显示多少行（超出部分滚动查看） */
	foldPreviewLines?: number;
	/** 是否让超长行换行；false 或 undefined = 横向滚动 */
	wrapLongLines?: boolean;
}

export interface RenderContext {
	file: ResolvedContent;
	slice: SlicedContent;
	sourcePath: string;
	options?: RenderOptions;
}

// ── Pipeline 结果 ──

export interface PipelineSuccess {
	success: true;
	file: ResolvedContent;
	slice: SlicedContent;
}

export interface PipelineError {
	success: false;
	error: string;
}

export type PipelineResult = PipelineSuccess | PipelineError;
