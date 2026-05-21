import {
	Plugin,
	MarkdownPostProcessorContext,
	MarkdownView,
	TFile,
	TAbstractFile,
	Notice,
} from "obsidian";
import { PluginSettings, DEFAULT_SETTINGS, LastFileReference } from "./types";
import { importCodeSettingsTab } from "./settings";
import { CodeEmbedProcessor } from "./ui/code-embed";
import { debounce, parseEmbedSource } from "./utils/helpers";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { createInsertCodeCallback, createEditLastCodeCallback } from "./commands/insert-code";
import { getHttps } from "./remote/http-client";

export default class importCode extends Plugin {
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
			name: "Insert embed code",
			editorCallback: insertCodeCallback,
		});

		this.addCommand({
			id: "re-reference-last-code",
			name: "再次引用代码文件",
			editorCallback: editLastCodeCallback,
		});

		this.registerMarkdownPostProcessor(
			(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				this.codeProcessor.processEmbeds(el, ctx.sourcePath);
			}
		);

		this.registerEditorExtension(
			ViewPlugin.define((view: EditorView) => {
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				const sourcePath = markdownView?.file?.path || "";

				setTimeout(
					() => this.codeProcessor.processEmbeds(view.dom, sourcePath),
					50
				);

				return {
					update: (update) => {
						if (update.docChanged || update.viewportChanged) {
							const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
							const currentSourcePath = currentView?.file?.path || "";
							setTimeout(
								() => this.codeProcessor.processEmbeds(view.dom, currentSourcePath),
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
							if (!this.codeProcessor.isProcessingAllowed(embedFilePath)) return;

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

		this.runStartupDiagnostics();
	}

	private runStartupDiagnostics(): void {
		if (
			this.settings.remoteCodeEmbedEnabled !== "enabled" ||
			!this.settings.remoteSkipSslVerify
		) {
			return;
		}

		try {
			const https = getHttps();
			if (https && typeof (https as Record<string, unknown>).request === "function") {
				console.log(
					"[Code Embed] SSL skip verification is available. Node.js HTTPS module loaded successfully."
				);
			} else {
				console.warn(
					"[Code Embed] SSL skip verification is enabled but the Node.js HTTPS module " +
					"is not fully functional. Requests to HTTPS servers with self-signed certificates " +
					"may fail. Ensure you are using Obsidian desktop."
				);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn(
				`[Code Embed] SSL skip verification is enabled but unavailable: ${msg}`
			);
			new Notice(
				"Code Embed: SSL skip verification is enabled but not available. " +
				"Self-signed certificates will cause errors. See console for details."
			);
		}
	}

	private resetMarkdownViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				const state = leaf.view.getState();
				leaf.view.setState(state, { history: false });
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
					embedEl.empty();
				});
			}
		});
	}
}
