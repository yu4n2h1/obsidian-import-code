import { Setting } from "obsidian";
import type { SettingsProvider } from "../../types";

export function buildEmbedStorageTab(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	// ---- Code Embed ----
	const embedGroup = containerEl.createDiv({ cls: "setting-items" });
	new Setting(embedGroup).setName("Code embed").setHeading();

	new Setting(embedGroup)
		.setName("Enable code embed")
		.setDesc("Render code files referenced by internal links as code blocks")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.codeEmbedEnabled)
				.onChange(async (value: boolean) => {
					plugin.settings.codeEmbedEnabled = value;
					await plugin.saveSettings();
					plugin.resetMarkdownViews();
				})
		);

	new Setting(embedGroup)
		.setName("Enable remote code embed")
		.setDesc("Allow embedding code files from remote URLs (HTTP/HTTPS)")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.remoteCodeEmbedEnabled)
				.onChange(async (value: boolean) => {
					plugin.settings.remoteCodeEmbedEnabled = value;
					await plugin.saveSettings();
					plugin.resetMarkdownViews();
				})
		);

	new Setting(embedGroup)
		.setName("Skip SSL certificate verification")
		.setDesc("For direct HTTPS wiki-link URLs only. Skip certificate validation for self-signed/expired/insecure certificates (desktop only). Configure per-service SSL skip in remote source aliases below.")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.remoteSkipSslVerify)
				.onChange(async (value: boolean) => {
					plugin.settings.remoteSkipSslVerify = value;
					await plugin.saveSettings();
				})
		);

	new Setting(embedGroup)
		.setName("Show line numbers")
		.setDesc("Display line numbers alongside embedded code. Numbers reflect real source-file line numbers (respects @-range offsets).")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.showLineNumbers)
				.onChange(async (value: boolean) => {
					plugin.settings.showLineNumbers = value;
					await plugin.saveSettings();
					plugin.resetMarkdownViews();
				})
		);

	new Setting(embedGroup)
		.setName("Fold mode")
		.setDesc("完整展开: 展开后显示全部；部分展开: 展开后仍限高可滚动；不折叠: 不折叠。")
		.addDropdown((dropdown) => {
			dropdown.addOption("full", "完整展开");
			dropdown.addOption("partial", "部分展开");
			dropdown.addOption("none", "不折叠");
			dropdown.setValue(plugin.settings.foldMode);
			dropdown.onChange(async (value) => {
				plugin.settings.foldMode = value as "full" | "partial" | "none";
				updateFoldVisibility(value);
				await plugin.saveSettings();
				plugin.resetMarkdownViews();
			});
		});

	const thresholdSetting = new Setting(embedGroup)
		.setName("Auto-fold threshold")
		.setDesc("Automatically fold code blocks longer than this many lines. Set 0 to disable folding.")
		.addText((text) =>
			text
				.setPlaceholder("50")
				.setValue(String(plugin.settings.foldThreshold))
				.onChange(async (value: string) => {
					const parsed = parseInt(value, 10);
					if (isNaN(parsed) || parsed < 0) return;
					plugin.settings.foldThreshold = parsed;
					await plugin.saveSettings();
					plugin.resetMarkdownViews();
				})
		);

	const collapsedSetting = new Setting(embedGroup)
		.setName("Folded lines")
		.setDesc("Number of lines visible when folded. Excess content is scrollable.")
		.addText((text) =>
			text
				.setPlaceholder("10")
				.setValue(String(plugin.settings.foldPreviewLines))
				.onChange(async (value: string) => {
					const parsed = parseInt(value, 10);
					if (isNaN(parsed) || parsed < 0) return;
					plugin.settings.foldPreviewLines = parsed;
					await plugin.saveSettings();
					plugin.resetMarkdownViews();
				})
		);

	const expandedSetting = new Setting(embedGroup)
		.setName("Expanded lines")
		.setDesc("Number of lines visible when expanded (partial mode only). Excess content is scrollable.")
		.addText((text) =>
			text
				.setPlaceholder("30")
				.setValue(String(plugin.settings.foldExpandedLines))
				.onChange(async (value: string) => {
					const parsed = parseInt(value, 10);
					if (isNaN(parsed) || parsed < 0) return;
					plugin.settings.foldExpandedLines = parsed;
					await plugin.saveSettings();
					plugin.resetMarkdownViews();
				})
		);

	function updateFoldVisibility(mode: string): void {
		const show = mode !== "none";
		thresholdSetting.settingEl.style.display = show ? "" : "none";
		collapsedSetting.settingEl.style.display = show ? "" : "none";
		expandedSetting.settingEl.style.display = mode === "partial" ? "" : "none";
	}
	updateFoldVisibility(plugin.settings.foldMode);

	new Setting(embedGroup)
		.setName("Wrap long lines")
		.setDesc("Wrap lines that exceed the code block's width instead of showing horizontal scroll.")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.wrapLongLines)
				.onChange(async (value: boolean) => {
					plugin.settings.wrapLongLines = value;
					await plugin.saveSettings();
					plugin.resetMarkdownViews();
				})
		);

	// ---- File Naming ----
	buildStorageSection(containerEl, plugin);
}

function buildStorageSection(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	const wrapper = containerEl.createDiv({ cls: "setting-items code-import-storage-section" });

	new Setting(wrapper).setName("File naming").setHeading();

	// Storage destination is configured per upload source in the "Upload Sources" tab.

	// File name strategy
	new Setting(wrapper)
		.setName("File name strategy")
		.setDesc("Choose the file name generation strategy")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("auto", "Auto (based on code content)")
				.addOption("hash", "Hash (user input as display text)")
				.addOption("custom", "Custom file name")
				.setValue(plugin.settings.fileNameStrategy)
				.onChange(async (value) => {
					plugin.settings.fileNameStrategy = value as "hash" | "custom" | "auto";
					await plugin.saveSettings();
				})
		);
}
