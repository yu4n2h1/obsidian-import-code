import {Plugin, MarkdownView} from 'obsidian';
import {CSVCodeViewSettings, DEFAULT_SETTINGS, CSVCodeViewSettingTab} from './settings';
import {CSVProcessor} from './csv-processor';

export default class CSVCodeView extends Plugin {
  settings: CSVCodeViewSettings;
  csvProcessor: CSVProcessor;

  async onload() {
    await this.loadSettings();

    console.log('CSV Code View plugin loaded');
    console.log('CSV Table View setting:', this.settings.csvCodeView);

    // Initialize CSV processor
    this.csvProcessor = new CSVProcessor(this.app, this.settings);

    // Add settings tab for plugin
    this.addSettingTab(new CSVCodeViewSettingTab(this.app, this));

    // Register CSV code block processor for inline CSV data
    this.registerMarkdownCodeBlockProcessor("csv", (source, el, ctx) => {
      console.log('Processing CSV code block');
      this.csvProcessor.process(source, el, ctx);
    });

    // Register CSV file path code block processor
    this.registerMarkdownCodeBlockProcessor("csv-file", async (source, el, ctx) => {
      console.log('Processing CSV file code block');
      await this.csvProcessor.processCSVFilePath(source, el, ctx);
    });

    // Use layout-change event to process CSV embeds after Obsidian renders them
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.processAllCSVEmbeds();
      })
    );

    // Also process when switching between editor and reading mode
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        // Small delay to ensure DOM is ready
        setTimeout(() => this.processAllCSVEmbeds(), 100);
      })
    );

    // Process on file open
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        setTimeout(() => this.processAllCSVEmbeds(), 200);
      })
    );

    console.log('CSV Code View processors registered');
  }

  /**
   * Scan and process all CSV file embeds in active markdown views
   */
  processAllCSVEmbeds() {
    if (this.settings.csvCodeView !== 'enabled') {
      return;
    }

    // Get all markdown views
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const view = leaf.view;
        const container = view.containerEl;
        
        // Find all CSV file embeds that haven't been processed yet
        const csvEmbeds = container.querySelectorAll('.internal-embed[src$=".csv"]:not(.csv-processed), .internal-embed[src$=".CSV"]:not(.csv-processed)');
        
        console.log('Found CSV embeds in view:', csvEmbeds.length);
        
        csvEmbeds.forEach(async (embed) => {
          const src = embed.getAttribute('src');
          if (!src) return;
          
          console.log('Processing CSV embed:', src);
          
          // Mark as processed to avoid reprocessing
          embed.addClass('csv-processed');
          
          // Get the file and render
          const file = this.app.metadataCache.getFirstLinkpathDest(src, view.file?.path || '');
          
          if (file) {
            try {
              const content = await this.app.vault.read(file);
              
              // Clear the embed content and replace with table
              embed.empty();
              embed.addClass('csv-table-container');
              this.csvProcessor.renderTable(content, embed as HTMLElement);
              
              console.log('Successfully rendered CSV table for:', src);
            } catch (error) {
              console.error('Failed to read CSV file:', src, error);
            }
          } else {
            console.warn('CSV file not found:', src);
          }
        });
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    console.log('Settings saved, new value:', this.settings.csvCodeView);
    // Update processor settings
    this.csvProcessor.updateSettings(this.settings);
    // Refresh all markdown views to apply settings immediately
    this.refreshViews();
  }

  refreshViews() {
    console.log('Refreshing all markdown views...');
    // Force refresh all markdown views
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view.getViewType() === 'markdown') {
        const markdownView = leaf.view as any;
        if (markdownView.previewMode) {
          markdownView.previewMode.rerender(true);
        }
      }
    });
  }
}
