import { App, Plugin, PluginSettingTab } from "obsidian";
import type { SettingsProvider } from "./types";
import { buildEmbedStorageTab } from "./ui/settings/embed-storage-tab";
import { buildExtensionsTab } from "./ui/settings/extensions-tab";
import { buildRemoteSourcesTab } from "./ui/settings/remote-sources-tab";

export class importCodeSettingsTab extends PluginSettingTab {
	plugin: SettingsProvider;

	constructor(app: App, plugin: SettingsProvider) {
		super(app, plugin as unknown as Plugin);
		this.plugin = plugin;
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

		const tabs = [
			{ label: "Embed & Storage", panel: embedStoragePanel },
			{ label: "File Extensions", panel: extensionsPanel },
			{ label: "Remote Sources", panel: remoteSourcesPanel },
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
	}
}
