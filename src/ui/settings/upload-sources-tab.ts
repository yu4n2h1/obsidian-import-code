import { Notice, Setting } from "obsidian";
import type { SettingsProvider, UploadSourceEntry } from "../../types";
import { rebuildSettingsSection } from "./rebuild";

export function buildUploadSourcesTab(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	buildUploadSourceSection(containerEl, plugin);
}

function buildUploadSourceSection(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	const wrapper = containerEl.createDiv({
		cls: "setting-items code-import-upload-source-section",
	});

	new Setting(wrapper).setName("Upload source aliases").setHeading();

	const entries = Object.entries(plugin.settings.uploadSources);

	for (const [alias, entry] of entries) {
		const card = wrapper.createDiv({ cls: "upload-source-card" });

		// Card header: alias input + delete button
		const header = card.createDiv({ cls: "upload-source-card-header" });
		const inputContainer = header.createDiv({
			cls: "upload-source-card-alias-input",
		});
		new Setting(inputContainer)
			.setName("Alias")
			.addText((text) => {
				text.setValue(alias);
				let currentAlias = alias;
				text.onChange(async (value) => {
					const trimmed = value.trim();
					if (!trimmed || trimmed === currentAlias) return;
					const sources = plugin.settings.uploadSources;
					if (sources[trimmed]) {
						new Notice(`Alias "${trimmed}" already exists`);
						text.setValue(currentAlias);
						return;
					}
					sources[trimmed] = entry;
					delete sources[currentAlias];
					currentAlias = trimmed;
					await plugin.saveSettings();
				});
			});
		const btnContainer = header.createDiv({
			cls: "upload-source-card-delete",
		});
		new Setting(btnContainer).addButton((btn) => {
			btn.setButtonText("Delete");
			btn.setWarning();
			btn.onClick(async () => {
				delete plugin.settings.uploadSources[alias];
				await plugin.saveSettings();
				rebuildSection(containerEl, plugin);
			});
		});

		// Card body: upload type + conditional config fields
		const body = card.createDiv({
			cls: "setting-items upload-source-card-body",
		});

		// Upload type dropdown
		let currentEntry: UploadSourceEntry = entry;
		new Setting(body)
			.setName("Upload type")
			.addDropdown((dd) => {
				dd.addOption("local", "Local (Obsidian vault)");
				dd.addOption("webdav", "WebDAV");
				dd.addOption("github-gist", "GitHub Gist");
				dd.setValue(entry.uploadType);
				dd.onChange(async (value) => {
					currentEntry.uploadType = value as UploadSourceEntry["uploadType"];
					currentEntry.config = {};
					await plugin.saveSettings();
					rebuildSection(containerEl, plugin);
				});
			});

		// Conditional config fields based on upload type
		buildUploadConfigFields(body, containerEl, currentEntry, plugin);
	}

	// Add button
	const addRow = wrapper.createDiv({ cls: "upload-source-add" });
	new Setting(addRow).addButton((btn) => {
		btn.setButtonText("Add upload source");
		btn.onClick(async () => {
			let n = 1;
			while (plugin.settings.uploadSources[`upload-${n}`]) n++;
			const alias = `upload-${n}`;
			plugin.settings.uploadSources[alias] = {
				uploadType: "local",
				useAlias: true,
				config: { storagePathType: "absolute", absolutePath: "assets" },
			};
			await plugin.saveSettings();
			rebuildSection(containerEl, plugin);
		});
	});
	addRow.createDiv({
		cls: "setting-item-description",
		text: "Add a new upload source alias to save code files to local vault, WebDAV server, or GitHub Gist.",
	});
}

function buildUploadConfigFields(
	body: HTMLElement,
	containerEl: HTMLElement,
	entry: UploadSourceEntry,
	plugin: SettingsProvider
): void {
	const cfg = entry.config;

	// 别名展示开关（对所有上传类型生效）
	new Setting(body)
		.setName("Include alias in link")
		.setDesc("When on, the generated link includes the display name as ![[path|alias]]. When off, it is ![[path]]. This affects only the link text, not the rendered code block.")
		.addToggle((toggle) => {
			toggle.setValue(entry.useAlias ?? true);
			toggle.onChange(async (value) => {
				entry.useAlias = value;
				await plugin.saveSettings();
			});
		});

	if (entry.uploadType === "local") {
		buildLocalFields(body, containerEl, cfg, plugin);
	} else if (entry.uploadType === "webdav") {
		buildWebdavFields(body, cfg, plugin);
	} else if (entry.uploadType === "github-gist") {
		buildGistFields(body, cfg, plugin);
	}
}

function buildLocalFields(
	body: HTMLElement,
	containerEl: HTMLElement,
	cfg: UploadSourceEntry["config"],
	plugin: SettingsProvider
): void {
	// Storage path type dropdown
	new Setting(body)
		.setName("Storage path type")
		.setDesc("Absolute path is relative to vault root; relative path is relative to current note")
		.addDropdown((dd) => {
			dd.addOption("absolute", "Absolute (vault root)");
			dd.addOption("relative", "Relative (current note)");
			dd.setValue(cfg.storagePathType ?? "absolute");
			dd.onChange(async (value) => {
				cfg.storagePathType = value as "absolute" | "relative";
				await plugin.saveSettings();
				// Rebuild to swap path input
				rebuildSection(containerEl, plugin);
			});
		});

	// Conditional path input
	const pathType = cfg.storagePathType ?? "absolute";
	if (pathType === "absolute") {
		new Setting(body)
			.setName("Absolute storage path")
			.setDesc("Path relative to vault root, e.g. assets/code")
			.addText((text) => {
				text.setPlaceholder("assets/code");
				text.setValue(cfg.absolutePath ?? "assets");
				text.onChange(async (value) => {
					cfg.absolutePath = value.trim();
					await plugin.saveSettings();
				});
			});
	} else {
		new Setting(body)
			.setName("Relative storage path")
			.setDesc("Path relative to current note, e.g. ./ or ../shared")
			.addText((text) => {
				text.setPlaceholder("./");
				text.setValue(cfg.relativePath ?? "./");
				text.onChange(async (value) => {
					cfg.relativePath = value.trim();
					await plugin.saveSettings();
				});
			});
	}
}

function buildWebdavFields(
	body: HTMLElement,
	cfg: UploadSourceEntry["config"],
	plugin: SettingsProvider
): void {
	new Setting(body)
		.setName("WebDAV URL")
		.setDesc("Base URL of the WebDAV server, e.g. https://example.com/remote.php/dav/files/user")
		.addText((text) => {
			text.setPlaceholder("https://example.com/remote.php/dav/files/user");
			text.setValue(cfg.url ?? "");
			text.onChange(async (value) => {
				cfg.url = value.trim();
				await plugin.saveSettings();
			});
		});

	new Setting(body)
		.setName("Username (optional)")
		.setDesc("Username for Basic authentication")
		.addText((text) => {
			text.setPlaceholder("username");
			text.setValue(cfg.username ?? "");
			text.onChange(async (value) => {
				cfg.username = value.trim() || undefined;
				await plugin.saveSettings();
			});
		});

	new Setting(body)
		.setName("Token")
		.setDesc("Token or password for authentication")
		.addText((text) => {
			text.setPlaceholder("token or password");
			text.inputEl.type = "password";
			text.setValue(cfg.token ?? "");
			text.onChange(async (value) => {
				cfg.token = value.trim();
				await plugin.saveSettings();
			});
		});

	new Setting(body)
		.setName("Path prefix")
		.setDesc("Directory path on the WebDAV server, e.g. uploads/code")
		.addText((text) => {
			text.setPlaceholder("uploads/code");
			text.setValue(cfg.pathPrefix ?? "");
			text.onChange(async (value) => {
				cfg.pathPrefix = value.trim() || undefined;
				await plugin.saveSettings();
			});
		});

	new Setting(body)
		.setName("Skip SSL verification")
		.setDesc("Skip SSL certificate verification for self-signed certificates")
		.addToggle((toggle) => {
			toggle.setValue(cfg.skipSslVerify ?? false);
			toggle.onChange(async (value) => {
				cfg.skipSslVerify = value;
				await plugin.saveSettings();
			});
		});
}

function buildGistFields(
	body: HTMLElement,
	cfg: UploadSourceEntry["config"],
	plugin: SettingsProvider
): void {
	new Setting(body)
		.setName("GitHub token")
		.setDesc("Personal access token with gist scope")
		.addText((text) => {
			text.setPlaceholder("ghp_xxxxxxxxxxxx");
			text.inputEl.type = "password";
			text.setValue(cfg.token ?? "");
			text.onChange(async (value) => {
				cfg.token = value.trim();
				await plugin.saveSettings();
			});
		});

	new Setting(body)
		.setName("API URL (optional)")
		.setDesc("GitHub API base URL, defaults to https://api.github.com")
		.addText((text) => {
			text.setPlaceholder("https://api.github.com");
			text.setValue(cfg.apiUrl ?? "");
			text.onChange(async (value) => {
				cfg.apiUrl = value.trim() || undefined;
				await plugin.saveSettings();
			});
		});

	new Setting(body)
		.setName("Skip SSL verification")
		.setDesc("Skip SSL certificate verification for self-signed certificates")
		.addToggle((toggle) => {
			toggle.setValue(cfg.skipSslVerify ?? false);
			toggle.onChange(async (value) => {
				cfg.skipSslVerify = value;
				await plugin.saveSettings();
			});
		});
}

function rebuildSection(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	rebuildSettingsSection(
		containerEl,
		"code-import-upload-source-section",
		(el) => buildUploadSourceSection(el, plugin)
	);
}
