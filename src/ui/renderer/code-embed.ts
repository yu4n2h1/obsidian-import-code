import { App, Component } from "obsidian";
import type { CodeEmbedSettings } from "../../types";
import {
	isRemoteUrl,
	isAliasPath,
	isPartialIpv6Url,
	tryRestoreIpv6Url,
	parseEmbedSource,
	isExtensionSupported,
} from "../../utils/helpers";
import { getLanguageFromPath } from "../../utils/language";
import { FileReader } from "../../pipeline/file-reader";
import { ViewRenderer } from "../../pipeline/view-renderer";
import { resolveLink } from "../../pipeline/link-router";
import { classifyTargets } from "../../pipeline/target-resolver";
import { sliceContent } from "../../pipeline/symbol-converter";
import type { RenderContext } from "../../pipeline/types";

export class CodeEmbedProcessor {
	app: App;
	settings: CodeEmbedSettings;
	plugin: Component;
	private fileReader: FileReader;
	private viewRenderer: ViewRenderer;

	constructor(app: App, settings: CodeEmbedSettings, plugin: Component) {
		this.app = app;
		this.settings = settings;
		this.plugin = plugin;
		this.fileReader = new FileReader(app, settings);
		this.viewRenderer = new ViewRenderer(app, plugin);
	}

	isProcessingAllowed(filePath: string): boolean {
		if (this.settings.codeEmbedEnabled !== "enabled") return false;
		if (isRemoteUrl(filePath) || isAliasPath(filePath)) {
			return this.settings.remoteCodeEmbedEnabled === "enabled";
		}
		const [extension] = getLanguageFromPath(filePath);
		return isExtensionSupported(this.settings, extension);
	}

	processEmbeds(container: HTMLElement, sourcePath: string): void {
		const embeds = container.querySelectorAll(".internal-embed");
		for (let i = 0; i < embeds.length; i++) {
			const embed = embeds[i] as HTMLElement;
			if (embed.classList.contains("code-link-processed")) continue;

			const src = embed.getAttribute("src");
			if (!src) continue;

			let { filePath, symbolName, highlightSpec } = parseEmbedSource(src);

			if (isPartialIpv6Url(filePath)) {
				const restored = tryRestoreIpv6Url(filePath, embed);
				if (restored) {
					filePath = restored;
					const reparsed = parseEmbedSource(filePath);
					symbolName = reparsed.symbolName;
					highlightSpec = reparsed.highlightSpec;
				}
			}

			if (!this.isProcessingAllowed(filePath)) continue;

			embed.classList.add("code-link-processed");
			embed.empty();
			// 错误在 processFile 内部已处理和渲染
			void this.processFile(filePath, symbolName, embed, sourcePath, highlightSpec);
		}
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
	async processFile(
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
