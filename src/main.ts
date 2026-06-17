import {
	Plugin,
	MarkdownView,
	TFile,
	TAbstractFile,
	Notice,
	type MarkdownPostProcessorContext,
} from "obsidian";
import { DEFAULT_SETTINGS, type PluginSettings, type LastFileReference, type ExtensionEntry } from "./types";

import { importCodeSettingsTab } from "./settings";
import { CodeEmbedProcessor } from "./ui/renderer/code-embed";
import { debounce } from "./utils/helpers";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { createInsertCodeCallback, createEditLastCodeCallback } from "./commands/insert-code";
import { getHttps } from "./utils/http-client";

export default class importCode extends Plugin {
	codeProcessor!: CodeEmbedProcessor;
	settings: PluginSettings = DEFAULT_SETTINGS;
	private lastFileReference: LastFileReference | null = null;

	async loadSettings() {
		const rawData = (await this.loadData()) as (Partial<PluginSettings> & { lastFileReference?: LastFileReference; codeFileExtensions?: string | ExtensionEntry[] }) | null;
		const { lastFileReference, ...loadedData } = rawData ?? {};

		// Migrate old comma-separated string format to ExtensionEntry[]
		if (typeof loadedData.codeFileExtensions === "string") {
			const oldStr = loadedData.codeFileExtensions as string;
			const suffixes = oldStr.split(",").map((s) => s.trim()).filter(Boolean);
			const migratedEntries: ExtensionEntry[] = [];
			const seenSuffixes = new Set<string>();
			for (const suffix of suffixes) {
				if (seenSuffixes.has(suffix)) continue;
				seenSuffixes.add(suffix);
				migratedEntries.push({
					suffix,
					dialect: suffix,
					active: true,
				});
			}
			loadedData.codeFileExtensions = migratedEntries;
		}

		// Migrate old global storage-path fields into a default Local upload source.
		// 旧版本把 storagePathType/absoluteStoragePath/relativeStoragePath 存在顶层，
		// 唯一化后这些字段已移除，需把它们搬进 uploadSources.Local 以保留用户配置。
		const legacy = loadedData as Record<string, unknown>;
		if ("absoluteStoragePath" in legacy || "relativeStoragePath" in legacy) {
			if (
				!loadedData.uploadSources ||
				Object.keys(loadedData.uploadSources).length === 0
			) {
				loadedData.uploadSources = {
					Local: {
						uploadType: "local",
						useAlias: true,
						config: {
							storagePathType:
								(legacy.storagePathType as "absolute" | "relative") ??
								"absolute",
							absolutePath:
								(legacy.absoluteStoragePath as string) ?? "assets",
							relativePath:
								(legacy.relativeStoragePath as string) ?? "./",
						},
					},
				};
			}
			delete legacy.storagePathType;
			delete legacy.absoluteStoragePath;
			delete legacy.relativeStoragePath;
		}

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
		const editLastCodeCallback = createEditLastCodeCallback(this.app, this.settings, this);

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
				if (!(leaf.view instanceof MarkdownView)) return;
				const container = leaf.view.containerEl;
				const sourcePath = leaf.view.file?.path || "";
				const embeds = container.querySelectorAll(".internal-embed.code-link-processed");

				embeds.forEach((embed: Element) => {
					// 文件匹配作为 predicate 传入；解析（含 IPv6 还原）、守卫、渲染都由 processEmbedElement 统一处理
					this.codeProcessor.processEmbedElement(
						embed as HTMLElement,
						sourcePath,
						(p) => p.filePath === filePath || p.filePath === fileName || filePath.endsWith(p.filePath)
					);
				});
			});
		}, 300);

		this.registerEvent(this.app.vault.on("modify", handleFileModify));

		this.runStartupDiagnostics();
	}

	private runStartupDiagnostics(): void {
		const anyServiceSkipSsl = Object.values(this.settings.remoteSources).some(
			(entry) => entry.config.skipSslVerify === true
		);
		if (
			this.settings.remoteCodeEmbedEnabled !== "enabled" ||
			(!this.settings.remoteSkipSslVerify && !anyServiceSkipSsl)
		) {
			return;
		}

		try {
			const https = getHttps();
			if (https && typeof (https as Record<string, unknown>).request === "function") {
				console.debug(
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

	public resetMarkdownViews(): void {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				const state = leaf.view.getState();
				void leaf.view.setState(state, { history: false });
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
