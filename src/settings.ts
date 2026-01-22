import {App, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";

export interface CSVCodeViewSettings {
	csvCodeView: string;
}

export interface CodeEmbedSettings {
	codeEmbedEnabled: string;
	codeFileExtensions: string;
}

export interface PluginSettings extends CSVCodeViewSettings, CodeEmbedSettings {}

export const DEFAULT_SETTINGS: PluginSettings = {
	csvCodeView: 'enabled',
	codeEmbedEnabled: 'enabled',
	codeFileExtensions: 'js,ts,py,java,c,cpp,go,rs,rb,php,sh,sql,html,css,json,yaml,xml,md'
}

export class CSVCodeViewSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		// CSV Table View Setting
		containerEl.createEl('h3', { text: 'CSV Table View' });
		
		new Setting(containerEl)
			.setName('Enable CSV Table View')
			.setDesc('将内部链接引用的 CSV 文件渲染为表格')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.csvCodeView === 'enabled')
				.onChange(async (value: boolean) => {
					this.plugin.settings.csvCodeView = value ? 'enabled' : 'disabled';
					await this.plugin.saveSettings();
				}));

		// Code Embed Setting
		containerEl.createEl('h3', { text: 'Code Embed' });
		
		new Setting(containerEl)
			.setName('Enable Code Embed')
			.setDesc('将内部链接引用的代码文件渲染为代码块')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.codeEmbedEnabled === 'enabled')
				.onChange(async (value: boolean) => {
					this.plugin.settings.codeEmbedEnabled = value ? 'enabled' : 'disabled';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Supported File Extensions')
			.setDesc('支持的代码文件后缀名，用逗号分隔（如：js,ts,py,java）')
			.addText(text => text
				.setPlaceholder('js,ts,py,java,c,cpp')
				.setValue(this.plugin.settings.codeFileExtensions)
				.onChange(async (value: string) => {
					this.plugin.settings.codeFileExtensions = value;
					await this.plugin.saveSettings();
				}));
	}
}
