import { Setting } from "obsidian";
import type { SettingsProvider } from "../../types";

export function buildEmbedStorageTab(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	// ---- Code Embed ----
	new Setting(containerEl).setName("Code embed").setHeading();

	const embedGroup = containerEl.createDiv({ cls: "setting-items" });

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
		.setDesc("For direct HTTPS wiki-link URLs only. Skip certificate validation for self-signed/expired/insecure certificates (desktop only). Configure per-service SSL skip in Remote Source Aliases below.")
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.remoteSkipSslVerify)
				.onChange(async (value: boolean) => {
					plugin.settings.remoteSkipSslVerify = value;
					await plugin.saveSettings();
				})
		);

	// ---- File Storage ----
	buildStorageSection(containerEl, plugin);
}

function buildStorageSection(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	const wrapper = containerEl.createDiv({ cls: "setting-items code-import-storage-section" });

	new Setting(wrapper).setName("File storage").setHeading();

	new Setting(wrapper)
		.setName("Storage path type")
		.setDesc("Choose the file storage path type")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("absolute", "Absolute (vault root)")
				.addOption("relative", "Relative (current note)")
				.setValue(plugin.settings.storagePathType)
				.onChange(async (value) => {
					plugin.settings.storagePathType = value as "absolute" | "relative";
					await plugin.saveSettings();
					const oldWrapper = containerEl.querySelector(".code-import-storage-section");
					if (oldWrapper) {
						oldWrapper.remove();
						buildStorageSection(containerEl, plugin);
					}
				})
		);

	if (plugin.settings.storagePathType === "absolute") {
		new Setting(wrapper)
			.setName("Absolute storage path")
			.setDesc(
				// eslint-disable-next-line obsidianmd/ui/sentence-case
				"Storage path relative to the vault root (e.g. attachments/code)"
			)
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("E.g. attachments")
					.setValue(plugin.settings.absoluteStoragePath)
					.onChange(async (value: string) => {
						plugin.settings.absoluteStoragePath = value;
						await plugin.saveSettings();
					})
			);
	} else {
		new Setting(wrapper)
			.setName("Relative storage path")
			.setDesc(
				"Storage path relative to the current note (e.g. ./assets or ../shared)"
			)
			.addText((text) =>
				text
					.setPlaceholder("./")
					.setValue(plugin.settings.relativeStoragePath)
					.onChange(async (value: string) => {
						plugin.settings.relativeStoragePath = value;
						await plugin.saveSettings();
					})
			);
	}

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
