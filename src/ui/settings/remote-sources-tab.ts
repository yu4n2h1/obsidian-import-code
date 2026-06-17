import { Notice, Setting } from "obsidian";
import type { SettingsProvider, RemoteServiceType } from "../../types";
import { buildRemoteConfigFields } from "./remote-config-fields";
import { rebuildSettingsSection } from "./rebuild";

const REMOTE_SOURCE_SECTION = "code-import-remote-source-section";

export function buildRemoteSourcesTab(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	buildRemoteSourceSection(containerEl, plugin);
}

function rebuildSection(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	rebuildSettingsSection(containerEl, REMOTE_SOURCE_SECTION, (el) =>
		buildRemoteSourceSection(el, plugin)
	);
}

function buildRemoteSourceSection(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	const section = containerEl.createDiv({ cls: REMOTE_SOURCE_SECTION });

	const headingGroup = section.createDiv({ cls: "setting-items" });
	new Setting(headingGroup).setName("Remote source aliases").setHeading();

	const entries = Object.entries(plugin.settings.remoteSources);

	for (const [alias, entry] of entries) {
		// Each source is its own setting-items group
		const sourceGroup = section.createDiv({ cls: "setting-items" });

		// Alias + Delete on same row
		new Setting(sourceGroup)
			.setName("Alias")
			.setDesc("Display name used in wiki links")
			.addText((text) => {
				text.setValue(alias);
				let currentAlias = alias;
				text.onChange(async (value) => {
					const trimmed = value.trim();
					if (!trimmed || trimmed === currentAlias) return;
					const sources = plugin.settings.remoteSources;
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
			})
			.addButton((btn) => {
				btn.setButtonText("Delete");
				btn.setWarning();
				btn.onClick(async () => {
					delete plugin.settings.remoteSources[alias];
					await plugin.saveSettings();
					rebuildSection(containerEl, plugin);
				});
			});

		// Service type
		new Setting(sourceGroup)
			.setName("Service type")
			.addDropdown((dd) => {
				dd.addOption("generic", "Generic URL");
				dd.addOption("github", "GitHub");
				dd.addOption("gitlab", "GitLab");
				dd.addOption("gitea", "Gitea");
				dd.addOption("webdav", "WebDAV");
				dd.addOption("local", "Local directory");
				dd.setValue(entry.serviceType);
				dd.onChange(async (value) => {
					entry.serviceType = value as RemoteServiceType;
					await plugin.saveSettings();
					rebuildSection(containerEl, plugin);
				});
			});

		buildRemoteConfigFields(
			sourceGroup,
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
			(key, value) => {
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
				void plugin.saveSettings();
			}
		);
	}

	const addRow = section.createDiv({ cls: "remote-source-add" });
	new Setting(addRow)
		.addButton((btn) => {
			btn.setButtonText("Add remote source");
			btn.onClick(async () => {
				let n = 1;
				while (plugin.settings.remoteSources[`source-${n}`]) n++;
				const alias = `source-${n}`;
				plugin.settings.remoteSources[alias] = {
					serviceType: "generic",
					config: { url: "", token: "", skipSslVerify: false },
				};
				await plugin.saveSettings();
				rebuildSection(containerEl, plugin);
			});
		});
	addRow.createDiv({
		cls: "setting-item-description",
		text: "Add a new remote source alias to embed code from external services or local directories.",
	});
}
