import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { SettingsProvider, RemoteServiceType } from "./types";
import { buildRemoteConfigFields } from "./ui/remote-config-fields";

export class importCodeSettingsTab extends PluginSettingTab {
	plugin: SettingsProvider;

	constructor(app: App, plugin: SettingsProvider) {
		super(app, plugin as unknown as Plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		this.buildEmbedSection(containerEl);
		this.buildStorageSection(containerEl);
		this.buildRemoteSourceSection(containerEl);
	}

	private buildEmbedSection(containerEl: HTMLElement): void {
		// Code Embed Setting
		new Setting(containerEl).setName("Code embed").setHeading();

		new Setting(containerEl)
			.setName("Enable code embed")
			.setDesc("Render code files referenced by internal links as code blocks")
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.codeEmbedEnabled === "enabled"
					)
					.onChange(async (value: boolean) => {
						this.plugin.settings.codeEmbedEnabled = value
							? "enabled"
							: "disabled";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Enable remote code embed")
			.setDesc("Allow embedding code files from remote URLs (HTTP/HTTPS)")
			.addToggle((toggle) =>
				toggle
					.setValue(
						this.plugin.settings.remoteCodeEmbedEnabled === "enabled"
					)
					.onChange(async (value: boolean) => {
						this.plugin.settings.remoteCodeEmbedEnabled = value
							? "enabled"
							: "disabled";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Skip SSL certificate verification")
			.setDesc("Skip HTTPS certificate validation, allowing self-signed/expired/insecure certificates (desktop only)")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.remoteSkipSslVerify)
					.onChange(async (value: boolean) => {
						this.plugin.settings.remoteSkipSslVerify = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Supported file extensions")
			.setDesc("Comma-separated list of supported code file extensions (e.g. js,ts,py,java)")
			.addText((text) =>
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("js,ts,py,java,c,cpp")
					.setValue(this.plugin.settings.codeFileExtensions)
					.onChange(async (value: string) => {
						this.plugin.settings.codeFileExtensions = value;
						await this.plugin.saveSettings();
					})
			);
	}

	private buildStorageSection(containerEl: HTMLElement): void {
		const wrapper = containerEl.createDiv({ cls: "code-import-storage-section" });

		// File Storage Settings
		new Setting(wrapper).setName("File storage").setHeading();

		new Setting(wrapper)
			.setName("Storage path type")
			.setDesc("Choose the file storage path type")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("absolute", "Absolute (vault root)")
					.addOption("relative", "Relative (current note)")
					.setValue(this.plugin.settings.storagePathType)
					.onChange(async (value) => {
						this.plugin.settings.storagePathType = value as "absolute" | "relative";
						await this.plugin.saveSettings();
						const oldWrapper = containerEl.querySelector(".code-import-storage-section");
						if (oldWrapper) {
							oldWrapper.remove();
							this.buildStorageSection(containerEl);
						}
					})
			);

		if (this.plugin.settings.storagePathType === "absolute") {
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
						.setValue(this.plugin.settings.absoluteStoragePath)
						.onChange(async (value: string) => {
							this.plugin.settings.absoluteStoragePath = value;
							await this.plugin.saveSettings();
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
						.setValue(this.plugin.settings.relativeStoragePath)
						.onChange(async (value: string) => {
							this.plugin.settings.relativeStoragePath = value;
							await this.plugin.saveSettings();
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
					.setValue(this.plugin.settings.fileNameStrategy)
					.onChange(async (value) => {
						this.plugin.settings.fileNameStrategy = value as "hash" | "custom" | "auto";
						await this.plugin.saveSettings();
					})
			);
	}

	private buildRemoteSourceSection(containerEl: HTMLElement): void {
		const wrapper = containerEl.createDiv({ cls: "code-import-remote-source-section" });

		new Setting(wrapper).setName("Remote source aliases").setHeading();

		const entries = Object.entries(this.plugin.settings.remoteSources);

		for (const [alias, entry] of entries) {
			const aliasWrapper = wrapper.createDiv({ cls: "code-import-remote-source-entry" });

			new Setting(aliasWrapper)
				.setName("Alias")
				.addText((text) => {
					text.setValue(alias);
					let currentAlias = alias;
					text.onChange(async (value) => {
						const trimmed = value.trim();
						if (!trimmed || trimmed === currentAlias) return;
						const sources = this.plugin.settings.remoteSources;
						sources[trimmed] = entry;
						delete sources[currentAlias];
						currentAlias = trimmed;
						await this.plugin.saveSettings();
					});
				})
				.addButton((btn) => {
					btn.setButtonText("Delete");
					btn.onClick(async () => {
						delete this.plugin.settings.remoteSources[alias];
						await this.plugin.saveSettings();
						const oldWrapper = containerEl.querySelector(".code-import-remote-source-section");
						if (oldWrapper) {
							oldWrapper.remove();
							this.buildRemoteSourceSection(containerEl);
						}
					});
				});

			new Setting(aliasWrapper)
				.setName("Service type")
				.addDropdown((dd) => {
					dd.addOption("generic", "Generic URL");
					dd.addOption("github", "GitHub");
					dd.addOption("gitlab", "GitLab");
					dd.addOption("gitea", "Gitea");
					dd.addOption("webdav", "WebDAV");
					dd.setValue(entry.serviceType);
					dd.onChange(async (value) => {
						entry.serviceType = value as RemoteServiceType;
						await this.plugin.saveSettings();
						const oldWrapper = containerEl.querySelector(".code-import-remote-source-section");
						if (oldWrapper) {
							oldWrapper.remove();
							this.buildRemoteSourceSection(containerEl);
						}
					});
				});

			buildRemoteConfigFields(
				aliasWrapper,
				entry.serviceType,
				{
					url: entry.config.url,
					token: entry.config.token,
					username: entry.config.username,
					repo: entry.config.repo,
					branch: entry.config.branch,
					path: entry.config.path,
				},
				async (key, value) => {
					switch (key) {
						case "url":
							entry.config.url = value;
							break;
						case "token":
							entry.config.token = value;
							break;
						case "username":
							entry.config.username = value || undefined;
							break;
						case "repo":
							entry.config.repo = value || undefined;
							break;
						case "branch":
							entry.config.branch = value || "main";
							break;
						case "path":
							entry.config.path = value || undefined;
							break;
					}
					await this.plugin.saveSettings();
				}
			);
		}

		new Setting(wrapper)
			.addButton((btn) => {
				btn.setButtonText("Add remote source");
				btn.onClick(async () => {
					const alias = `source-${Object.keys(this.plugin.settings.remoteSources).length + 1}`;
					this.plugin.settings.remoteSources[alias] = {
						serviceType: "generic",
						config: { url: "", token: "" },
					};
					await this.plugin.saveSettings();
					const oldWrapper = containerEl.querySelector(".code-import-remote-source-section");
					if (oldWrapper) {
						oldWrapper.remove();
						this.buildRemoteSourceSection(containerEl);
					}
				});
			});
	}
}
