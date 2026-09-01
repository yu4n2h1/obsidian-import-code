import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { SettingsProvider } from "./types";
import { buildEmbedStorageTab } from "./ui/settings/embed-storage-tab";
import { buildExtensionsTab } from "./ui/settings/extensions-tab";
import { buildRemoteSourcesTab } from "./ui/settings/remote-sources-tab";
import { buildUploadSourcesTab } from "./ui/settings/upload-sources-tab";

/**
 * Declarative settings API shapes (Obsidian 1.13+, currently insider-only).
 * The published obsidian.d.ts does not declare these types yet, so they are
 * mirrored locally from the documented shape:
 * https://docs.obsidian.md/Plugins/User+interface/Settings
 */
interface DeclarativeControl {
	type:
		| "toggle"
		| "dropdown"
		| "text"
		| "textarea"
		| "number"
		| "slider"
		| "file"
		| "folder"
		| "color";
	key?: string;
	options?: Record<string, string>;
	defaultValue?: unknown;
	min?: number;
	max?: number;
	step?: number;
	placeholder?: string;
	validate?: (value: string) => string | undefined | Promise<string | undefined>;
	disabled?: boolean | (() => boolean);
}

interface SettingDefinitionItem {
	type?: "page" | "group" | "list";
	name?: string;
	desc?: string;
	heading?: string;
	items?: SettingDefinitionItem[];
	visible?: boolean | (() => boolean);
	control?: DeclarativeControl;
	render?: (setting: Setting) => void;
}

/** Settings whose changes must re-render open Markdown views. */
const VIEW_RESET_KEYS = new Set([
	"codeEmbedEnabled",
	"remoteCodeEmbedEnabled",
	"showLineNumbers",
	"foldMode",
	"foldThreshold",
	"foldPreviewLines",
	"foldExpandedLines",
	"wrapLongLines",
]);

export class importCodeSettingsTab extends PluginSettingTab {
	plugin: SettingsProvider;

	constructor(app: App, plugin: SettingsProvider) {
		super(app, plugin as unknown as Plugin);
		this.plugin = plugin;
	}

	/**
	 * Declarative settings definitions (Obsidian 1.13+). On 1.13+ Obsidian
	 * renders from these definitions — making settings searchable in the
	 * settings search — and skips display(); on older versions display()
	 * runs as before (dual support). Complex tabs (extensions table, remote
	 * and upload sources) cannot be expressed declaratively, so they reuse
	 * the existing imperative builders through custom renderers.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		const plugin = this.plugin;
		const renderPanel = (
			build: (el: HTMLElement, p: SettingsProvider) => void
		): SettingDefinitionItem => ({
			render: (setting: Setting) => {
				setting.settingEl.addClass("code-import-definition-panel");
				build(setting.controlEl, plugin);
			},
		});
		return [
			{
				type: "page",
				name: "Embed & storage",
				items: [
					{
						name: "Enable code embed",
						desc: "Render code files referenced by internal links as code blocks",
						control: { type: "toggle", key: "codeEmbedEnabled" },
					},
					{
						name: "Enable remote code embed",
						desc: "Allow embedding code files from remote URLs (HTTP/HTTPS)",
						control: { type: "toggle", key: "remoteCodeEmbedEnabled" },
					},
					{
						name: "Skip SSL certificate verification",
						desc: "For direct HTTPS wiki-link URLs only. Skip certificate validation for self-signed/expired/insecure certificates (desktop only).",
						control: { type: "toggle", key: "remoteSkipSslVerify" },
					},
					{
						name: "Show line numbers",
						desc: "Display line numbers alongside embedded code. Numbers reflect real source-file line numbers (respects @-range offsets).",
						control: { type: "toggle", key: "showLineNumbers" },
					},
					{
						name: "Fold mode",
						desc: "Full expands to all content; partial keeps a limited scrollable height; none disables folding.",
						control: {
							type: "dropdown",
							key: "foldMode",
							options: {
								full: "Full expand",
								partial: "Partial expand",
								none: "No folding",
							},
						},
					},
					{
						name: "Auto-fold threshold",
						desc: "Automatically fold code blocks longer than this many lines. Set 0 to disable folding.",
						visible: () => plugin.settings.foldMode !== "none",
						control: {
							type: "number",
							key: "foldThreshold",
							min: 0,
							placeholder: "50",
						},
					},
					{
						name: "Folded lines",
						desc: "Number of lines visible when folded. Excess content is scrollable.",
						visible: () => plugin.settings.foldMode !== "none",
						control: {
							type: "number",
							key: "foldPreviewLines",
							min: 1,
							placeholder: "10",
						},
					},
					{
						name: "Expanded lines",
						desc: "Number of lines visible when expanded (partial mode only). Excess content is scrollable.",
						visible: () => plugin.settings.foldMode === "partial",
						control: {
							type: "number",
							key: "foldExpandedLines",
							min: 1,
							placeholder: "30",
						},
					},
					{
						name: "Wrap long lines",
						desc: "Wrap lines that exceed the code block's width instead of showing horizontal scroll.",
						control: { type: "toggle", key: "wrapLongLines" },
					},
					{
						name: "File name strategy",
						desc: "Choose the file name generation strategy",
						control: {
							type: "dropdown",
							key: "fileNameStrategy",
							options: {
								auto: "Auto (based on code content)",
								hash: "Hash (user input as display text)",
								custom: "Custom file name",
							},
						},
					},
				],
			},
			{
				type: "page",
				name: "File extensions",
				items: [renderPanel(buildExtensionsTab)],
			},
			{
				type: "page",
				name: "Remote sources",
				items: [renderPanel(buildRemoteSourcesTab)],
			},
			{
				type: "page",
				name: "Upload sources",
				items: [renderPanel(buildUploadSourcesTab)],
			},
		];
	}

	/**
	 * Custom accessors for the declarative controls: settings keys are flat
	 * top-level properties, and some changes must refresh open views.
	 */
	getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		(this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
		await this.plugin.saveSettings();
		if (VIEW_RESET_KEYS.has(key)) {
			this.plugin.resetMarkdownViews();
		}
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// ---- Tab bar ----
		const tabBar = containerEl.createDiv({ cls: "code-import-tab-bar" });

		// ---- Panels ----
		const embedStoragePanel = containerEl.createDiv({
			cls: "code-import-tab-panel active",
		});
		const extensionsPanel = containerEl.createDiv({
			cls: "code-import-tab-panel",
		});
		const remoteSourcesPanel = containerEl.createDiv({
			cls: "code-import-tab-panel",
		});
		const uploadSourcesPanel = containerEl.createDiv({
			cls: "code-import-tab-panel",
		});

		const tabs = [
			{ label: "Embed & Storage", panel: embedStoragePanel },
			{ label: "File Extensions", panel: extensionsPanel },
			{ label: "Remote Sources", panel: remoteSourcesPanel },
			{ label: "Upload Sources", panel: uploadSourcesPanel },
		];

		// Build tab buttons with click handlers
		tabs.forEach((tab, i) => {
			const btn = tabBar.createEl("button", {
				cls: `code-import-tab${i === 0 ? " active" : ""}`,
				text: tab.label,
			});
			btn.addEventListener("click", () => {
				tabBar
					.querySelectorAll(".code-import-tab")
					.forEach((b) => b.removeClass("active"));
				containerEl
					.querySelectorAll(".code-import-tab-panel")
					.forEach((p) => p.removeClass("active"));
				btn.addClass("active");
				tab.panel.addClass("active");
			});
		});

		// ---- Build tab contents ----
		buildEmbedStorageTab(embedStoragePanel, this.plugin);
		buildExtensionsTab(extensionsPanel, this.plugin);
		buildRemoteSourcesTab(remoteSourcesPanel, this.plugin);
		buildUploadSourcesTab(uploadSourcesPanel, this.plugin);
	}
}
