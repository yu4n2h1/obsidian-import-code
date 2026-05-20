import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { SettingsProvider, RemoteServiceType, RemoteServiceConfig } from "./types";
import { SERVICE_LABELS } from "./utils/constants";
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
		this.buildRemoteSection(containerEl);
	}

	private buildEmbedSection(containerEl: HTMLElement): void {
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
			.setName("Enable remote code embed")
			.setDesc("允许嵌入远程URL（HTTP/HTTPS）的代码文件")
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
			.setDesc("跳过HTTPS证书验证，允许访问自签名/过期/不安全证书的网站（仅桌面端）")
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
	}

	private buildStorageSection(containerEl: HTMLElement): void {
		const wrapper = containerEl.createDiv({ cls: "code-import-storage-section" });

		// File Storage Settings
		new Setting(wrapper).setName("File storage").setHeading();

		new Setting(wrapper)
			.setName("Storage path type")
			.setDesc("选择文件存储路径类型")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("absolute", "根目录指定位置")
					.addOption("relative", "相对当前文档位置")
					.setValue(this.plugin.settings.storagePathType)
					.onChange(async (value) => {
						this.plugin.settings.storagePathType = value as "absolute" | "relative" | "remote";
						await this.plugin.saveSettings();
						// Targeted rebuild — remove old wrapper and recreate storage section
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
			new Setting(wrapper)
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
		new Setting(wrapper)
			.setName("File name strategy")
			.setDesc("选择文件名生成策略")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("auto", "自动（基于代码内容）")
					.addOption("hash", "哈希（用户输入作为链接显示文本）")
					.addOption("custom", "自定义文件名")
					.setValue(this.plugin.settings.fileNameStrategy)
					.onChange(async (value) => {
						this.plugin.settings.fileNameStrategy = value as "hash" | "custom" | "auto";
						await this.plugin.saveSettings();
					})
			);
	}

	private buildRemoteSection(containerEl: HTMLElement): void {
		const wrapper = containerEl.createDiv({ cls: "code-import-remote-section" });

		// Remote Upload Settings
		new Setting(wrapper).setName("远程上传").setHeading();

		for (const svc of ["webdav", "github", "gitlab", "gitea"] as RemoteServiceType[]) {
			const label = SERVICE_LABELS[svc];
			const config = this.plugin.settings.remoteServices[svc];

			new Setting(wrapper)
				.setName(label)
				.setDesc(`${label} 远程服务配置`)
				.addToggle((toggle) => {
					toggle
						.setValue(!!config)
						.onChange(async (value) => {
							if (value) {
								this.plugin.settings.remoteServices[svc] = {
									url: "",
									token: "",
									branch: "main",
								};
							} else {
								delete this.plugin.settings.remoteServices[svc];
							}
							await this.plugin.saveSettings();
							// Targeted rebuild — remove old wrapper and recreate remote section
							const oldWrapper = containerEl.querySelector(".code-import-remote-section");
							if (oldWrapper) {
								oldWrapper.remove();
								this.buildRemoteSection(containerEl);
							}
						});
				});

			if (config) {
				buildRemoteConfigFields(
					wrapper,
					svc,
					{
						url: config.url,
						token: config.token,
						username: config.username,
						repo: config.repo,
						branch: config.branch,
						uploadPath: config.uploadPath,
					},
					async (key, value) => {
						switch (key) {
							case "url":
								config.url = value;
								break;
							case "token":
								config.token = value;
								break;
							case "username":
								config.username = value || undefined;
								break;
							case "repo":
								config.repo = value || undefined;
								break;
							case "branch":
								config.branch = value || "main";
								break;
							case "uploadPath":
								config.uploadPath = value || undefined;
								break;
						}
						await this.plugin.saveSettings();
					}
				);
			}
		}
	}
}
