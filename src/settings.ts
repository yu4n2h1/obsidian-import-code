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
	// 文件名生成策略: 'md5' 基于内容MD5哈希, 'content' 直接使用用户输入内容
	fileNameStrategy: "md5" | "content";
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
	fileNameStrategy: "md5",
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
		new Setting(containerEl).setName("Code embed").setHeading();

		new Setting(containerEl)
			.setName("Enable code embed")
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
			.setName("Supported file extensions")
			.setDesc("支持的代码文件后缀名，用逗号分隔（如：js,ts,py,java）")
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

		// File Storage Settings
		new Setting(containerEl).setName("File storage").setHeading();

		new Setting(containerEl)
			.setName("Storage path type")
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
				.setName("Absolute storage path")
				.setDesc(
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					"相对于 Vault 根目录的存储路径（如：attachments/code）"
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
			new Setting(containerEl)
				.setName("Relative storage path")
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

		// File name strategy
		new Setting(containerEl)
			.setName("File name strategy")
			.setDesc("选择文件名生成策略")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("md5", "MD5哈希（用户输入作为链接显示文本）")
					.addOption("content", "直接使用输入内容作为文件名")
					.setValue(this.plugin.settings.fileNameStrategy)
					.onChange(async (value) => {
						this.plugin.settings.fileNameStrategy = value as "md5" | "content";
						await this.plugin.saveSettings();
					})
			);
	}
}
