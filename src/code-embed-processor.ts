import { App, Component } from "obsidian";
import type { CodeEmbedSettings } from "./types";
import {
	classifyPath,
	isPartialIpv6Url,
	tryRestoreIpv6Url,
	parseEmbedSource,
	getSupportedExtensions,
} from "./utils/helpers";
import { getLanguageFromPath } from "./utils/language";
import { ContentResolver } from "./pipeline/content-resolver";
import { executePipeline } from "./pipeline/execute";
import { renderSuccess, renderError } from "./ui/render/code-embed";
import type { PipelineResult } from "./pipeline/types";

/** 解析后的 embed 引用：filePath + @symbol + #highlight。 */
interface ResolvedEmbed {
	filePath: string;
	symbolName: string;
	highlightSpec: string;
}

export class CodeEmbedProcessor {
	app: App;
	settings: CodeEmbedSettings;
	plugin: Component;
	private contentResolver: ContentResolver;
	// 受支持扩展名集合，构造时一次性构建（processor 在 settings 变更时重建）
	private supportedExtensions: Set<string>;
	// 请求去重：同一 filePath 的并发请求复用 Promise
	private inFlight: Map<string, Promise<PipelineResult>>;
	// 每个 targetElement 当前生效的 render token —— 用来在异步渲染完成时判断
	// 「这个 target 是否已被更新的一次 processFile 调用接管」。旧渲染读到 token 变了
	// 就丢弃自己的结果，避免把陈旧 DOM 追加到已重开的容器上。
	private renderTokens: WeakMap<HTMLElement, symbol>;

	constructor(app: App, settings: CodeEmbedSettings, plugin: Component) {
		this.app = app;
		this.settings = settings;
		this.plugin = plugin;
		this.contentResolver = new ContentResolver(app, settings);
		this.supportedExtensions = new Set(getSupportedExtensions(settings));
		this.inFlight = new Map();
		this.renderTokens = new WeakMap();
	}

	isProcessingAllowed(filePath: string): boolean {
		if (!this.settings.codeEmbedEnabled) return false;

		const [extension] = getLanguageFromPath(filePath, this.settings);
		if (!this.supportedExtensions.has(extension)) return false;

		if (classifyPath(filePath) !== "local") {
			return this.settings.remoteCodeEmbedEnabled;
		}
		return true;
	}

	processEmbeds(container: HTMLElement, sourcePath: string): void {
		const embeds = container.querySelectorAll(".internal-embed");
		for (let i = 0; i < embeds.length; i++) {
			const embed = embeds[i] as HTMLElement;
			// 仅处理尚未处理的 embed；去重在调用方，因为 modify 路径需重渲染已处理的
			if (embed.classList.contains("code-link-processed")) continue;
			this.processEmbedElement(embed, sourcePath);
		}
	}

	/**
	 * 解析单个 embed 元素的 src：parseEmbedSource + IPv6 还原。
	 * 集中在此，使「新 embed 处理」与「modify 重渲染」两条路径共享同一解析逻辑，
	 * 避免 IPv6 还原在某条路径缺失（历史 bug）。可脱离 pipeline 直接测试。
	 * 无 src 时返回 null。
	 */
	resolveEmbedSrc(el: HTMLElement): ResolvedEmbed | null {
		const src = el.getAttribute("src");
		if (!src) return null;

		let { filePath, symbolName, highlightSpec } = parseEmbedSource(src);

		if (isPartialIpv6Url(filePath)) {
			const restored = tryRestoreIpv6Url(filePath, el);
			if (restored) {
				filePath = restored;
				const reparsed = parseEmbedSource(filePath);
				symbolName = reparsed.symbolName;
				highlightSpec = reparsed.highlightSpec;
			}
		}

		return { filePath, symbolName, highlightSpec };
	}

	/**
	 * 处理单个 embed 元素的公共 seam：解析 → 可选过滤 → 守卫 → 渲染。
	 * processEmbeds 与 main.ts 的 modify handler 都通过它，per-element 管线集中一处。
	 * shouldProcess 为可选调用方过滤（modify 用文件匹配）；错误由 processFile 内部处理。
	 */
	processEmbedElement(
		el: HTMLElement,
		sourcePath: string,
		shouldProcess?: (parsed: ResolvedEmbed) => boolean
	): void {
		const parsed = this.resolveEmbedSrc(el);
		if (!parsed) return;
		if (shouldProcess && !shouldProcess(parsed)) return;
		if (!this.isProcessingAllowed(parsed.filePath)) return;

		el.classList.add("code-link-processed");
		el.empty();
		// 错误在 processFile 内部已处理和渲染
		void this.processFile(parsed.filePath, parsed.symbolName, el, sourcePath, parsed.highlightSpec);
	}

	/**
	 * 管线编排器：通过 executePipeline 执行"解析 → 目标分类 → 范围计算 → 切片 → 渲染"，
	 * 替代旧版 5 阶段手动编排。支持请求去重（同一 filePath 的并发请求复用 Promise）。
	 *
	 * 竞态防护：为每次调用生成 render token 并挂在 targetElement 上。异步流程
	 * 每个可能重入的节点后都比对 token，若已被更新的一次 processFile 调用取代
	 * 就丢弃当前结果——避免 modify 事件在旧渲染未完成时又触发导致孤儿 DOM
	 * 或错乱追加。
	 */
	private async processFile(
		filePath: string,
		symbolName: string,
		targetElement: HTMLElement,
		sourcePath: string,
		highlightSpec: string = "",
	): Promise<void> {
		const token = Symbol("render");
		this.renderTokens.set(targetElement, token);
		const isCurrent = () => this.renderTokens.get(targetElement) === token;

		targetElement.setAttribute("data-code-link-handled", "true");
		targetElement.addClass("code-link-block");
		targetElement.empty();
		// 本地文件几乎瞬间可用，简单 Loading 文本足矣；远程/alias 会走网络，
		// 用骨架屏减轻等待时的空白感。
		const isRemote = classifyPath(filePath) !== "local";
		if (isRemote) {
			const skeleton = targetElement.createDiv({ cls: "code-link-skeleton" });
			skeleton.createDiv({ cls: "code-link-skeleton-line" });
			skeleton.createDiv({ cls: "code-link-skeleton-line" });
			skeleton.createDiv({ cls: "code-link-skeleton-line" });
		} else {
			targetElement.createDiv({ cls: "code-link-loading", text: "Loading..." });
		}

		let result: PipelineResult;
		const inflight = this.inFlight.get(filePath);
		if (inflight) {
			result = await inflight;
		} else {
			const promise = executePipeline(
				this.contentResolver,
				filePath,
				sourcePath,
				symbolName,
				highlightSpec,
			);
			this.inFlight.set(filePath, promise);
			try {
				result = await promise;
			} finally {
				this.inFlight.delete(filePath);
			}
		}

		// 拿到 pipeline 结果后先检查 token：若已被后续调用取代，直接放弃。
		if (!isCurrent()) return;

		if (result.success) {
			const el = await renderSuccess(this.app, this.plugin, {
				file: result.file,
				slice: result.slice,
				sourcePath,
				options: {
					showLineNumbers: this.settings.showLineNumbers === true,
					foldMode: this.settings.foldMode,
					foldThreshold: this.settings.foldThreshold,
					foldPreviewLines: this.settings.foldPreviewLines,
					foldExpandedLines: this.settings.foldExpandedLines,
					wrapLongLines: this.settings.wrapLongLines === true,
				},
			});
			// renderSuccess 内部有 await MarkdownRenderer.render，异步返回后再查一次 token。
			if (!isCurrent()) return;

			targetElement.empty();
			targetElement.appendChild(el);
			// 点击交互：吞冒泡（防 Obsidian 把 .internal-embed 当 wiki link 跳转）+
			// 点击代码区切换聚焦全屏（toolbar 按钮不触发、有文本选中不触发）。
			el.addEventListener("click", (e: MouseEvent) => {
				e.stopPropagation();
				if ((e.target as HTMLElement).closest("button")) return;
				const sel = window.getSelection();
				if (sel && sel.toString().length > 0) return;
				const focused = el.classList.toggle("code-embed-focused");
				if (focused) {
					const onEsc = (ev: KeyboardEvent) => {
						if (ev.key === "Escape") {
							el.classList.remove("code-embed-focused");
							document.removeEventListener("keydown", onEsc);
						}
					};
					document.addEventListener("keydown", onEsc);
				}
			});
		} else {
			targetElement.empty();
			const el = renderError(result.error, () => {
				// 重试：重新走一遍 processFile（会更新 token、清空、重新加载）。
				void this.processFile(filePath, symbolName, targetElement, sourcePath, highlightSpec);
			});
			targetElement.appendChild(el);
		}
	}
}
