import { App, Component } from "obsidian";
import type { CodeEmbedSettings } from "../../types";
import {
	isRemoteUrl,
	isAliasPath,
	isPartialIpv6Url,
	tryRestoreIpv6Url,
	parseEmbedSource,
	getSupportedExtensions,
} from "../../utils/helpers";
import { getLanguageFromPath } from "../../utils/language";
import { FileReader } from "../../pipeline/file-reader";
import { ViewRenderer } from "../../pipeline/view-renderer";
import { resolveLink } from "../../pipeline/link-router";
import { classifyTargets } from "../../pipeline/target-resolver";
import { sliceContent } from "../../pipeline/symbol-converter";
import type { RenderContext } from "../../pipeline/types";

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
	private fileReader: FileReader;
	private viewRenderer: ViewRenderer;
	// 受支持扩展名集合，构造时一次性构建（processor 在 settings 变更时重建）
	private supportedExtensions: Set<string>;

	constructor(app: App, settings: CodeEmbedSettings, plugin: Component) {
		this.app = app;
		this.settings = settings;
		this.plugin = plugin;
		this.fileReader = new FileReader(app, settings);
		this.viewRenderer = new ViewRenderer(app, plugin);
		this.supportedExtensions = new Set(getSupportedExtensions(settings));
	}

	isProcessingAllowed(filePath: string): boolean {
		if (this.settings.codeEmbedEnabled !== "enabled") return false;

		const [extension] = getLanguageFromPath(filePath, this.settings);
		if (!this.supportedExtensions.has(extension)) return false;

		if (isRemoteUrl(filePath) || isAliasPath(filePath)) {
			return this.settings.remoteCodeEmbedEnabled === "enabled";
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
	private resolveEmbedSrc(el: HTMLElement): ResolvedEmbed | null {
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
	 * 管线编排器：依次执行 5 个管线阶段，将 Wiki Link 渲染为代码视图。
	 *
	 *   [阶段1] link-router.resolveLink()      → ResolvedLink
	 *   [阶段2] fileReader.read()              → FileContext
	 *   [阶段3] targetResolver.classifyTargets() → TargetResult
	 *   [阶段4] symbolConverter.sliceContent()  → SlicedContent
	 *   [阶段5] viewRenderer.render()          → HTMLElement
	 */
	private async processFile(
		filePath: string,
		symbolName: string,
		targetElement: HTMLElement,
		sourcePath: string,
		highlightSpec: string = "",
	): Promise<boolean> {
		try {
			targetElement.setAttribute("data-code-link-handled", "true");
			targetElement.addClass("code-link-block");
			targetElement.empty();
			targetElement.createDiv({ cls: "code-link-loading", text: "Loading..." });

			// [阶段1] 链接路由
			const resolvedLink = resolveLink(filePath);

			// [阶段2] 文件读取
			const fileContext = await this.fileReader.read(resolvedLink, sourcePath);

			// [阶段3] 目标解析
			const targetResult = classifyTargets(symbolName, highlightSpec);

			// [阶段4] 符号转换 + 内容切片
			const sliced = sliceContent(
				fileContext.content,
				fileContext.language,
				targetResult.display,
				targetResult.highlight,
			);

			// [阶段5] 视图渲染
			const renderCtx: RenderContext = {
				file: fileContext,
				slice: sliced,
				sourcePath,
			};

			const result = await this.viewRenderer.render(renderCtx);

			result.addEventListener("click", (e: MouseEvent) => {
				const target = e.target as HTMLElement;
				if (target.closest("button")) {
					e.stopPropagation();
					return;
				}
				e.preventDefault();
				e.stopPropagation();
			});

			targetElement.empty();
			targetElement.appendChild(result);
			return true;
		} catch (err) {
			targetElement.empty();
			const errorDiv = targetElement.createDiv({ cls: "code-link-error" });
			errorDiv.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
			return false;
		}
	}
}
