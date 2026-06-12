import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { SettingsProvider, RemoteServiceType, ExtensionEntry } from "./types";
import { buildRemoteConfigFields } from "./ui/settings/remote-config-fields";

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
			.setDesc("For direct HTTPS wiki-link URLs only. Skip certificate validation for self-signed/expired/insecure certificates (desktop only). Configure per-service SSL skip in Remote Source Aliases below.")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.remoteSkipSslVerify)
					.onChange(async (value: boolean) => {
						this.plugin.settings.remoteSkipSslVerify = value;
						await this.plugin.saveSettings();
					})
			);

		this.buildExtensionTable(containerEl);
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
			const card = wrapper.createDiv({ cls: "remote-source-card" });

			// Card header: alias input + delete button
			const header = card.createDiv({ cls: "remote-source-card-header" });
			const inputContainer = header.createDiv({ cls: "remote-source-card-alias-input" });
			new Setting(inputContainer)
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
				});
			const btnContainer = header.createDiv({ cls: "remote-source-card-delete" });
			new Setting(btnContainer)
				.addButton((btn) => {
					btn.setButtonText("Delete");
					btn.setWarning();
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

			// Card body: service type + config fields
			const body = card.createDiv({ cls: "remote-source-card-body" });
			new Setting(body)
				.setName("Service type")
				.addDropdown((dd) => {
					dd.addOption("generic", "Generic URL");
					dd.addOption("github", "GitHub");
					dd.addOption("gitlab", "GitLab");
					dd.addOption("gitea", "Gitea");
					dd.addOption("webdav", "WebDAV");
					dd.addOption("local", "Local Directory");
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
				body,
				entry.serviceType,
				{
					url: entry.config.url,
					token: entry.config.token,
					username: entry.config.username,
					repo: entry.config.repo,
					branch: entry.config.branch,
					path: entry.config.path,
					skipSslVerify: entry.config.skipSslVerify,
				},
				async (key, value) => {
					switch (key) {
						case "url":
							entry.config.url = value as string;
							break;
						case "token":
							entry.config.token = value as string;
							break;
						case "username":
							entry.config.username = (value as string) || undefined;
							break;
						case "repo":
							entry.config.repo = (value as string) || undefined;
							break;
						case "branch":
							entry.config.branch = (value as string) || "main";
							break;
						case "path":
							entry.config.path = (value as string) || undefined;
							break;
						case "skipSslVerify":
							entry.config.skipSslVerify = value as boolean;
							break;
					}
					await this.plugin.saveSettings();
				}
			);
		}

		const addRow = wrapper.createDiv({ cls: "remote-source-add" });
		new Setting(addRow)
			.addButton((btn) => {
				btn.setButtonText("Add remote source");
				btn.onClick(async () => {
					const alias = `source-${Object.keys(this.plugin.settings.remoteSources).length + 1}`;
					this.plugin.settings.remoteSources[alias] = {
						serviceType: "generic",
						config: { url: "", token: "", skipSslVerify: false },
					};
					await this.plugin.saveSettings();
					const oldWrapper = containerEl.querySelector(".code-import-remote-source-section");
					if (oldWrapper) {
						oldWrapper.remove();
						this.buildRemoteSourceSection(containerEl);
					}
				});
			});
		addRow.createDiv({
			cls: "setting-item-description",
			text: "Add a new remote source alias to embed code from external services or local directories.",
		});
	}

	private buildExtensionTable(containerEl: HTMLElement): void {
		const wrapper = containerEl.createDiv({ cls: "extension-table-section" });

		new Setting(wrapper).setName("Supported file extensions").setHeading();

		// Header row
		const header = wrapper.createDiv({ cls: "extension-table-header" });
		header.createDiv({ cls: "extension-table-col dialect-col", text: "Dialect" });
		header.createDiv({ cls: "extension-table-col suffix-col", text: "Suffix" });
		header.createDiv({ cls: "extension-table-col toggle-col" });
		header.createDiv({ cls: "extension-table-col delete-col" });

		// Data rows
		const entries = this.plugin.settings.codeFileExtensions;
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i];
			if (entry) {
				this.buildExtensionRow(wrapper, entry, i);
			}
		}

		// Add button
		const addRowEl = wrapper.createDiv({ cls: "extension-table-add" });
		new Setting(addRowEl).addButton((btn) => {
			btn.setButtonText("Add extension");
			btn.onClick(async () => {
				this.plugin.settings.codeFileExtensions.push({
					suffix: "",
					dialect: "",
					active: false,
				});
				await this.plugin.saveSettings();
				this.rebuildExtensionTable(containerEl);
			});
		});
		addRowEl.createDiv({
			cls: "setting-item-description",
			text: "Add a custom file extension not listed above.",
		});
	}

	private buildExtensionRow(
		wrapper: HTMLElement,
		entry: ExtensionEntry,
		index: number
	): void {
		const stripeCls = index % 2 === 0 ? "stripe-even" : "stripe-odd";
		const row = wrapper.createDiv({ cls: `extension-table-row ${stripeCls}` });

		// Dialect input — inline-styled to defeat any theme overrides
		const dialectCol = row.createDiv({ cls: "extension-table-col dialect-col" });
		const dialectInput = dialectCol.createEl("input", {
			type: "text",
			cls: "extension-table-input",
			attr: {
				placeholder: "e.g. javascript",
				style: "border:none;outline:none;box-shadow:none;background:transparent;width:100%;",
			},
		});
		dialectInput.value = entry.dialect;
		dialectInput.addEventListener("input", () => {
			entry.dialect = dialectInput.value.trim();
			void this.plugin.saveSettings();
		});

		// Suffix input — inline-styled to defeat any theme overrides
		const suffixCol = row.createDiv({ cls: "extension-table-col suffix-col" });
		const suffixInput = suffixCol.createEl("input", {
			type: "text",
			cls: "extension-table-input",
			attr: {
				placeholder: "e.g. js",
				style: "border:none;outline:none;box-shadow:none;background:transparent;width:100%;",
			},
		});
		suffixInput.value = entry.suffix;
		suffixInput.addEventListener("input", () => {
			entry.suffix = suffixInput.value.trim();
			void this.plugin.saveSettings();
		});

		// Toggle — keep Obsidian's toggle component
		const toggleContainer = row.createDiv({ cls: "extension-table-col toggle-col" });
		new Setting(toggleContainer)
			.addToggle((toggle) => {
				toggle.setValue(entry.active);
				toggle.onChange(async (value) => {
					entry.active = value;
					await this.plugin.saveSettings();
				});
			});

		// Delete button — keep Obsidian's extra-button component
		const deleteContainer = row.createDiv({ cls: "extension-table-col delete-col" });
		new Setting(deleteContainer)
			.addExtraButton((btn) => {
				btn.setIcon("x");
				btn.setTooltip("Remove extension");
				btn.onClick(async () => {
					this.plugin.settings.codeFileExtensions.splice(index, 1);
					await this.plugin.saveSettings();
					this.rebuildExtensionTable(this.containerEl);
				});
			});
	}

	private rebuildExtensionTable(containerEl: HTMLElement): void {
		const oldWrapper = containerEl.querySelector(".extension-table-section");
		if (oldWrapper) oldWrapper.remove();
		this.buildExtensionTable(containerEl);
	}
}
