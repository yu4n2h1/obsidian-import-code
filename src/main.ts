import {
	Plugin,
	MarkdownPostProcessorContext,
	MarkdownView,
	TFile,
	TAbstractFile,
} from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS, LastFileReference } from "./types";
import { importCodeSettingsTab } from "./settings";
import { CodeEmbedProcessor } from "./ui/code-embed";
import { debounce } from "./utils/debounce";
import { parseEmbedSource, isRemoteUrl } from "./utils/parse-embed-source";
import { getLanguageFromPath } from "./utils/language";
import { isExtensionSupported } from "./utils/settings-helpers";
import { processEmbeds } from "./ui/embed-processor";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { createInsertCodeCallback, createEditLastCodeCallback, LastFileRefStore } from "./commands/insert-code";

export default class importCode extends Plugin implements LastFileRefStore {
	codeProcessor!: CodeEmbedProcessor;
	settings: PluginSettings = DEFAULT_SETTINGS;
	private lastFileReference: LastFileReference | null = null;

	async loadSettings() {
		const rawData = (await this.loadData()) as (Partial<PluginSettings> & { lastFileReference?: LastFileReference }) | null;
		const { lastFileReference, ...loadedData } = rawData ?? {};
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
		if (lastFileReference) {
			this.lastFileReference = lastFileReference;
		}
	}

	async saveSettings() {
		const data: Record<string, unknown> = { ...this.settings };
		if (this.lastFileReference) {
			data.lastFileReference = this.lastFileReference;
		}
		await this.saveData(data);
		this.initProcessors();
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				const container = leaf.view.containerEl;
				const embeds = container.querySelectorAll(".internal-embed.code-link-processed");
				embeds.forEach((embed: Element) => {
					embed.classList.remove("code-link-processed");
					(embed as HTMLElement).removeAttribute("data-code-link-handled");
				});
			}
		});
		this.resetMarkdownViews();
	}

	initProcessors() {
		this.codeProcessor = new CodeEmbedProcessor(this.app, this.settings, this);
	}

	async loadLastFileReference(): Promise<LastFileReference | null> {
		if (this.lastFileReference) return this.lastFileReference;
		const data = (await this.loadData()) as Record<string, unknown> | null;
		this.lastFileReference = (data?.lastFileReference as LastFileReference) ?? null;
		return this.lastFileReference;
	}

	async saveLastFileReference(ref: LastFileReference): Promise<void> {
		this.lastFileReference = ref;
		const data = (await this.loadData()) as Record<string, unknown> | null;
		await this.saveData({ ...(data ?? {}), lastFileReference: ref });
	}

	async onload() {
		await this.loadSettings();
		this.initProcessors();
		this.addSettingTab(new importCodeSettingsTab(this.app, this));

		const insertCodeCallback = createInsertCodeCallback(this.app, this.settings, this);
		const editLastCodeCallback = createEditLastCodeCallback(this.app, this);

		this.addCommand({
			id: "create-code-file",
			name: "插入嵌入代码",
			editorCallback: insertCodeCallback,
		});

		this.addCommand({
			id: "insert-embed-code",
			name: "Insert embed code",
			editorCallback: insertCodeCallback,
		});

		this.addCommand({
			id: "new-code-snippet",
			name: "新建代码片段",
			editorCallback: insertCodeCallback,
		});

		this.addCommand({
			id: "re-reference-last-code",
			name: "再次引用代码文件",
			editorCallback: editLastCodeCallback,
		});

		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				processEmbeds(el, this.codeProcessor, this.settings, ctx.sourcePath);
			}
		);

		this.registerEditorExtension(
			ViewPlugin.define((view: EditorView) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				const sourcePath = markdownView?.file?.path || "";

				setTimeout(
					() => processEmbeds(view.dom, this.codeProcessor, this.settings, sourcePath),
					50
				);

				return {
					update: (update) => {
						if (update.docChanged || update.viewportChanged) {
							const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
							const currentSourcePath = currentView?.file?.path || "";
							setTimeout(
								() => processEmbeds(view.dom, this.codeProcessor, this.settings, currentSourcePath),
								50
							);
						}
					},
					destroy: () => {},
				};
			})
		);

		const handleFileModify = debounce((file: TAbstractFile) => {
			if (!(file instanceof TFile)) return;
			const filePath = file.path;
			const fileName = file.name;

			this.app.workspace.iterateAllLeaves((leaf) => {
				if (leaf.view instanceof MarkdownView) {
					const container = leaf.view.containerEl;
					const embeds = container.querySelectorAll(".internal-embed.code-link-processed");

					embeds.forEach((embed: Element) => {
						const embedEl = embed as HTMLElement;
						const rawSrc = embedEl.getAttribute("src");
						if (!rawSrc) return;

						const { filePath: embedFilePath, symbolName, highlightSpec } = parseEmbedSource(rawSrc);

						if (
							embedFilePath === filePath ||
							embedFilePath === fileName ||
							filePath.endsWith(embedFilePath)
						) {
							if (this.settings.codeEmbedEnabled !== "enabled") return;

							if (isRemoteUrl(embedFilePath)) {
								if (this.settings.remoteCodeEmbedEnabled !== "enabled") return;
							} else {
								const [extension] = getLanguageFromPath(embedFilePath);
								if (!isExtensionSupported(this.settings, extension)) return;
							}

							const sourcePath = (leaf.view as MarkdownView).file?.path || "";
							embedEl.classList.add("code-link-processed");
							embedEl.empty();
							this.codeProcessor.processFile(
								embedFilePath, symbolName, embedEl, sourcePath, highlightSpec
							).catch((err) => {
								console.error("processFile failed in modify handler:", err);
								embedEl.setText(`Error: ${err instanceof Error ? err.message : String(err)}`);
							});
						}
					});
				}
			});
		}, 300);

		this.registerEvent(this.app.vault.on("modify", handleFileModify));
	}

	private resetMarkdownViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				const state = leaf.getViewState();
				leaf.setViewState({ type: "empty" }).then(() => {
					leaf.setViewState(state).catch((err) => {
						console.error("Failed to restore view state:", err);
					});
				}).catch((err) => {
					console.error("Failed to clear view state:", err);
				});
			}
		});
	}

	onunload() {
		console.debug("Unloading importCode plugin");

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				const container = leaf.view.containerEl;
				const embeds = container.querySelectorAll(".internal-embed.code-link-processed");

				embeds.forEach((embed: Element) => {
					const embedEl = embed as HTMLElement;
					embedEl.classList.remove("code-link-processed");
					embedEl.removeAttribute("data-code-link-handled");
					embedEl.removeAttribute("data-source-path");
					embedEl.removeAttribute("data-embed-file");
					embedEl.empty();
				});
			}
		});

		this.resetMarkdownViews();
	}
}
