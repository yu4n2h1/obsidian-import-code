import {Plugin} from 'obsidian';
import {CSVCodeViewSettings, DEFAULT_SETTINGS, CSVCodeViewSettingTab} from './settings';

export default class CSVCodeView extends Plugin {
  settings: CSVCodeViewSettings;

  async onload() {
    await this.loadSettings();

    // Add settings tab for plugin
    this.addSettingTab(new CSVCodeViewSettingTab(this.app, this));

    this.registerMarkdownCodeBlockProcessor("csv", (source, el, ctx) => {
      // Check if CSV table view is enabled
      if (this.settings.csvCodeView !== 'enabled') {
        el.createEl("pre").setText(source);
        return;
      }

      const rows = source.split("\n").filter((row) => row.length > 0); // 切出每一行来

      const table = el.createEl("table"); // Create table element
      const body = table.createEl("tbody"); // Create table body

      for (let i = 0; i < rows.length; i++) {
        const row_text = rows[i];
        if (!row_text) continue;
        
        const cols = row_text.split(","); // 将每一行再分开

        const row = body.createEl("tr"); // Create table row

        for (let j = 0; j < cols.length; j++) {
          const col_text = cols[j];
          if (col_text !== undefined) {
            row.createEl("td", { text: col_text });
          }
        }
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
