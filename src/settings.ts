import { App, PluginSettingTab, Setting } from "obsidian";
import importCode from "./main";

export interface CodeEmbedSettings {
	codeEmbedEnabled: string;
	codeFileExtensions: string;
}

export interface FileStorageSettings {
	// 存储路径类型: 'absolute' 根目录指定位置, 'relative' 相对当前文档位置
	storagePathType: "absolute" | "relative";
	// 根目录指定位置的路径
	absoluteStoragePath: string;
	// 相对位置的路径
	relativeStoragePath: string;
}

export interface PluginSettings
	extends CodeEmbedSettings,
		FileStorageSettings {}

export const DEFAULT_SETTINGS: PluginSettings = {
	codeEmbedEnabled: "enabled",
	codeFileExtensions:
		"js,ts,py,java,c,cpp,go,rs,rb,php,sh,sql,html,css,json,yaml,xml",
	storagePathType: "absolute",
	absoluteStoragePath: "assets",
	relativeStoragePath: "./",
};

export class importCodeSettingsTab extends PluginSettingTab {
	plugin: importCode;

	constructor(app: App, plugin: importCode) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Code Embed Setting
		containerEl.createEl("h3", { text: "Code Embed" });

		new Setting(containerEl)
			.setName("Enable Code Embed")
			.setDesc("将内部链接引用的代码文件渲染为代码块")
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
			.setName("Supported File Extensions")
			.setDesc("支持的代码文件后缀名，用逗号分隔（如：js,ts,py,java）")
			.addText((text) =>
				text
					.setPlaceholder("js,ts,py,java,c,cpp")
					.setValue(this.plugin.settings.codeFileExtensions)
					.onChange(async (value: string) => {
						this.plugin.settings.codeFileExtensions = value;
						await this.plugin.saveSettings();
					})
			);

		// File Storage Settings
		containerEl.createEl("h3", { text: "File Storage" });

		new Setting(containerEl)
			.setName("Storage Path Type")
			.setDesc("选择文件存储路径类型")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("absolute", "根目录指定位置")
					.addOption("relative", "相对当前文档位置")
					.setValue(this.plugin.settings.storagePathType)
					.onChange(async (value) => {
						this.plugin.settings.storagePathType = value as "absolute" | "relative";
						await this.plugin.saveSettings();
						this.display();
					})
			);

		if (this.plugin.settings.storagePathType === "absolute") {
			new Setting(containerEl)
				.setName("Absolute Storage Path")
				.setDesc(
					"相对于 Vault 根目录的存储路径（如：attachments/code）"
				)
				.addText((text) =>
					text
						.setPlaceholder("attachments")
						.setValue(this.plugin.settings.absoluteStoragePath)
						.onChange(async (value: string) => {
							this.plugin.settings.absoluteStoragePath = value;
							await this.plugin.saveSettings();
						})
				);
		} else {
			new Setting(containerEl)
				.setName("Relative Storage Path")
				.setDesc(
					"相对于当前文档的存储路径（如：./assets 或 ../shared）"
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
	}
}
