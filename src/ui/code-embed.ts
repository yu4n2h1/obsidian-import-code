import {
	App,
	MarkdownRenderer,
	Component,
	setIcon,
	TFile,
} from "obsidian";
import { getLanguageFromPath } from "../utils/language";
import {
	isRemoteUrl,
	isAliasPath,
	parseAliasPath,
	isPartialIpv6Url,
	tryRestoreIpv6Url,
	parseEmbedSource,
	parseLineRange,
	isExtensionSupported,
} from "../utils/helpers";
import { CodeEmbedSettings } from "../types";
import { extractSymbol, findSymbolLineRange } from "../utils/code-extractor";
import { readRemoteFile, readFromService } from "../remote/remote-manager";

export class CodeEmbedProcessor {
	app: App;
	settings: CodeEmbedSettings;
	plugin: Component;

	constructor(app: App, settings: CodeEmbedSettings, plugin: Component) {
		this.app = app;
		this.settings = settings;
		this.plugin = plugin;
	}

	/**
	 * 检查是否允许处理指定的文件路径。
	 * 统一入口，同时检查插件总开关、远程嵌入开关和支持的扩展名。
	 */
	isProcessingAllowed(filePath: string): boolean {
		if (this.settings.codeEmbedEnabled !== "enabled") return false;
		if (isRemoteUrl(filePath) || isAliasPath(filePath)) {
			return this.settings.remoteCodeEmbedEnabled === "enabled";
		}
		const [extension] = getLanguageFromPath(filePath);
		return isExtensionSupported(this.settings, extension);
	}

	/**
	 * 遍历容器中的 .internal-embed 元素，对每个匹配的嵌入调用 processFile。
	 * 处理 IPv6 URL 还原、设置检查和符号解析。
	 */
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
			this.processFile(filePath, symbolName, embed, sourcePath, highlightSpec).catch((err) => {
				console.error("processEmbeds failed:", err);
				embed.setText(`Error: ${err instanceof Error ? err.message : String(err)}`);
			});
		}
	}

	async readFile(filePath: string, sourcePath: string): Promise<string | null> {
		const aliasParsed = parseAliasPath(filePath);
		if (aliasParsed) {
			const sourceEntry = this.settings.remoteSources[aliasParsed.alias];
			if (!sourceEntry) {
				throw new Error(`Remote source alias "${aliasParsed.alias}" is not configured.`);
			}
			
			const result = await readFromService(
				sourceEntry.serviceType,
				sourceEntry.config,
				aliasParsed.relativePath,
				this.settings.remoteSkipSslVerify,
			);
			if (!result.success || result.content === undefined) {
				throw new Error(result.error || `Failed to read "${aliasParsed.relativePath}" from "${aliasParsed.alias}".`);
			}
			return result.content;
		}

		if (isRemoteUrl(filePath)) {
			const content = await readRemoteFile(filePath, this.settings.remoteSkipSslVerify);
			if (content === null) {
				throw new Error("Failed to read remote file");
			}
			return content;
		}

		const file = this.app.metadataCache.getFirstLinkpathDest(filePath, sourcePath);
		if (file instanceof TFile) {
			return await this.app.vault.read(file);
		}

		return null;
	}

	async processFile(
		filePath: string,
		symbolName: string,
		targetElement: HTMLElement,
		sourcePath: string,
		highlightSpec: string = ""
	): Promise<boolean> {
		try {
			targetElement.setAttribute("data-code-link-handled", "true");
			targetElement.addClass("code-link-block");

			targetElement.empty();
			targetElement.createDiv({
				cls: "code-link-loading",
				text: "Loading...",
			});

			const content = await this.readFile(filePath, sourcePath);

			if (content !== null) {
				targetElement.empty();

				let renderContent = content;
				if (symbolName) {
					const lineRange = parseLineRange(symbolName);
					if (lineRange) {
						const lines = content.split("\n");
						const startIdx = Math.max(0, lineRange.start - 1);
						const endIdx = lineRange.end
							? Math.min(lines.length, lineRange.end)
							: startIdx + 1;
						if (startIdx >= lines.length) {
							const errorDiv = targetElement.createDiv({ cls: "code-link-error" });
							errorDiv.textContent = `Line ${lineRange.start} out of range (file has ${lines.length} lines)`;
							return true;
						}
						renderContent = lines.slice(startIdx, endIdx).join("\n");
					} else {
						const [, language] = getLanguageFromPath(filePath);
						const extracted = extractSymbol(content, symbolName, language);
						if (extracted === null) {
							const errorDiv = targetElement.createDiv({ cls: "code-link-error" });
							errorDiv.textContent = `Symbol "${symbolName}" not found in ${filePath}`;
							return true;
						}
						renderContent = extracted;
					}
				}

				let highlightLines: number[] | undefined;
				if (highlightSpec) {
					const lineRange = parseLineRange(highlightSpec);
					const renderLines = renderContent.split("\n");
					if (lineRange) {
						const start = Math.max(0, lineRange.start - 1);
						const end = lineRange.end
							? Math.min(renderLines.length, lineRange.end)
							: start + 1;
						if (start < renderLines.length) {
							highlightLines = [];
							for (let i = start; i < end; i++) highlightLines.push(i);
						}
					} else {
						const [, language] = getLanguageFromPath(filePath);
						const range = findSymbolLineRange(renderContent, highlightSpec, language);
						if (range) {
							highlightLines = [];
							for (let i = range.start - 1; i < range.end; i++) highlightLines.push(i);
						}
					}
				}

				const result = await this.render(renderContent, targetElement, filePath, sourcePath, highlightLines);
				if (result) {
					result.addEventListener("click", (e: MouseEvent) => {
						const target = e.target as HTMLElement;
						if (target.closest("button")) {
							e.stopPropagation();
							return;
						}
						e.preventDefault();
						e.stopPropagation();
					});

					targetElement.appendChild(result);
					return true;
				}
			}
			return false;
		} catch (err) {
			targetElement.empty();
			const errorDiv = targetElement.createDiv({ cls: "code-link-error" });
			errorDiv.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
			return false;
		}
	}

	async render(
		content: string,
		targetElement: HTMLElement,
		filePath: string,
		sourcePath: string,
		highlightLines?: number[]
	): Promise<HTMLElement> {
		const [, language] = getLanguageFromPath(filePath);

		const container = document.createElement("div");
		container.className = "code-embed-container";

		const toolbar = container.createDiv({ cls: "code-embed-toolbar" });

		const openButton = toolbar.createEl("button", {
			cls: "code-embed-open-btn",
		});
		openButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.app.workspace.openLinkText(filePath, sourcePath);
		});
		setIcon(openButton, "external-link");
		openButton.setAttribute("aria-label", "Open file");

		const langLabel = toolbar.createEl("button", {
			cls: "code-block-flair",
			text: language,
			attr: {
				"aria-label": "复制",
			},
		});
		langLabel.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void (async () => {
				try {
					await navigator.clipboard.writeText(content);
					const originalText = langLabel.textContent;
					langLabel.textContent = "已复制";
					setTimeout(() => {
						langLabel.textContent = originalText;
					}, 1500);
				} catch (err) {
					console.error("复制失败:", err);
				}
			})();
		});

		const wrapper = container.createDiv({ cls: "code-embed-wrapper" });

		const markdownCodeBlock = "```" + language + "\n" + content + "\n```";
		await MarkdownRenderer.render(
			this.app,
			markdownCodeBlock,
			wrapper,
			sourcePath,
			this.plugin
		);

		if (highlightLines && highlightLines.length > 0) {
			const codeEl = wrapper.querySelector("code");
			if (codeEl) {
				const lines = codeEl.innerHTML.split("\n");
				for (const lineIdx of highlightLines) {
					if (lineIdx < lines.length) {
						const content = lines[lineIdx] || "&nbsp;";
					lines[lineIdx] = `<span class="code-highlight-line">${content}</span>`;
					}
				}
				codeEl.innerHTML = lines.join("\n");
			}
		}

		return container;
	}
}
