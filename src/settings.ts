import {App, PluginSettingTab, Setting} from "obsidian";
import MyPlugin from "./main";

export interface CSVCodeViewSettings {
	csvCodeView: string;
}

export const DEFAULT_SETTINGS: CSVCodeViewSettings = {
	csvCodeView: 'enabled' as 'enabled' | 'disabled'
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
		new Setting(containerEl)
			.setName('CSV Table View')
			.setDesc('将代码当中的csv数据转换为表格')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.csvCodeView === 'enabled')
				.onChange(async (value: boolean) => {
					this.plugin.settings.csvCodeView = value ? 'enabled' : 'disabled';
					await this.plugin.saveSettings();
				}));
			
	}
}
