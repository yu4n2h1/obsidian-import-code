import { Setting } from "obsidian";
import type { SettingsProvider, ExtensionEntry } from "../../types";
import { rebuildSettingsSection } from "./rebuild";

export function buildExtensionsTab(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	buildExtensionTable(containerEl, plugin);
}

function buildExtensionTable(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	const wrapper = containerEl.createDiv({ cls: "setting-items extension-table-section" });

	new Setting(wrapper).setName("Supported file extensions").setHeading();

	// Header row
	const header = wrapper.createDiv({ cls: "extension-table-header" });
	header.createDiv({ cls: "extension-table-col dialect-col", text: "Dialect" });
	header.createDiv({ cls: "extension-table-col suffix-col", text: "Suffix" });
	header.createDiv({ cls: "extension-table-col toggle-col" });
	header.createDiv({ cls: "extension-table-col delete-col" });

	// Data rows
	const entries = plugin.settings.codeFileExtensions;
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (entry) {
			buildExtensionRow(wrapper, entry, i, containerEl, plugin);
		}
	}

	// Add button
	const addRowEl = wrapper.createDiv({ cls: "extension-table-add" });
	new Setting(addRowEl).addButton((btn) => {
		btn.setButtonText("Add extension");
		btn.onClick(async () => {
			plugin.settings.codeFileExtensions.push({
				suffix: "",
				dialect: "",
				active: false,
			});
			await plugin.saveSettings();
			rebuildExtensionTable(containerEl, plugin);
		});
	});
	addRowEl.createDiv({
		cls: "setting-item-description",
		text: "Add a custom file extension not listed above.",
	});
}

function buildExtensionRow(
	wrapper: HTMLElement,
	entry: ExtensionEntry,
	index: number,
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	const stripeCls = index % 2 === 0 ? "stripe-even" : "stripe-odd";
	const row = wrapper.createDiv({ cls: `extension-table-row ${stripeCls}` });

	// Dialect input — inline-styled to defeat any theme overrides
	const dialectCol = row.createDiv({ cls: "extension-table-col dialect-col" });
	const dialectInput = dialectCol.createEl("input", {
		type: "text",
		cls: "extension-table-input",
		attr: {
			placeholder: "E.g. JavaScript",
			style: "border:none;outline:none;box-shadow:none;background:transparent;width:100%;",
		},
	});
	dialectInput.value = entry.dialect;
	dialectInput.addEventListener("input", () => {
		entry.dialect = dialectInput.value.trim();
		void plugin.saveSettings();
	});

	// Suffix input — inline-styled to defeat any theme overrides
	const suffixCol = row.createDiv({ cls: "extension-table-col suffix-col" });
	const suffixInput = suffixCol.createEl("input", {
		type: "text",
		cls: "extension-table-input",
		attr: {
			placeholder: "E.g. Js",
			style: "border:none;outline:none;box-shadow:none;background:transparent;width:100%;",
		},
	});
	suffixInput.value = entry.suffix;
	suffixInput.addEventListener("input", () => {
		entry.suffix = suffixInput.value.trim().toLowerCase();
		void plugin.saveSettings();
	});

	// Toggle — keep Obsidian's toggle component
	const toggleContainer = row.createDiv({ cls: "extension-table-col toggle-col" });
	new Setting(toggleContainer)
		.addToggle((toggle) => {
			toggle.setValue(entry.active);
			toggle.onChange(async (value) => {
				entry.active = value;
				await plugin.saveSettings();
				plugin.resetMarkdownViews();
			});
		});

	// Delete button — keep Obsidian's extra-button component
	const deleteContainer = row.createDiv({ cls: "extension-table-col delete-col" });
	new Setting(deleteContainer)
		.addExtraButton((btn) => {
			btn.setIcon("x");
			btn.setTooltip("Remove extension");
			btn.onClick(async () => {
				plugin.settings.codeFileExtensions.splice(index, 1);
				await plugin.saveSettings();
				plugin.resetMarkdownViews();
				rebuildExtensionTable(containerEl, plugin);
			});
		});
}

function rebuildExtensionTable(
	containerEl: HTMLElement,
	plugin: SettingsProvider
): void {
	rebuildSettingsSection(
		containerEl,
		"extension-table-section",
		(el) => buildExtensionTable(el, plugin)
	);
}
