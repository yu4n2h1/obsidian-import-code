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
				.setValue(
					plugin.settings.codeEmbedEnabled === "enabled"
				)
				.onChange(async (value: boolean) => {
					plugin.settings.codeEmbedEnabled = value
						? "enabled"
						: "disabled";
					await plugin.saveSettings();
					plugin.resetMarkdownViews();
				})
		);

	new Setting(embedGroup)
		.setName("Enable remote code embed")
		.setDesc("Allow embedding code files from remote URLs (HTTP/HTTPS)")
		.addToggle((toggle) =>
			toggle
				.setValue(
					plugin.settings.remoteCodeEmbedEnabled === "enabled"
				)
				.onChange(async (value: boolean) => {
					plugin.settings.remoteCodeEmbedEnabled = value
						? "enabled"
						: "disabled";
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
