import {Plugin, MarkdownView, MarkdownRenderer, MarkdownPostProcessorContext, setIcon} from 'obsidian';
import {PluginSettings, DEFAULT_SETTINGS, CSVCodeViewSettingTab} from './settings';
import {CSVProcessor} from './csv-processor';
import {CodeEmbedProcessor} from './code-embed-processor';
import {createCodeEmbedExtension} from './editor-extension';

export default class CSVCodeView extends Plugin {
  settings: PluginSettings;
  csvProcessor: CSVProcessor;
  codeEmbedProcessor: CodeEmbedProcessor;
  private checkInterval: number | null = null;

  async onload() {
    await this.loadSettings();

    console.log('Code Link plugin loaded');
    console.log('CSV Table View setting:', this.settings.csvCodeView);
    console.log('Code Embed setting:', this.settings.codeEmbedEnabled);
    console.log('Code File Extensions:', this.settings.codeFileExtensions);

    // Initialize processors
    this.csvProcessor = new CSVProcessor(this.app, this.settings);
    this.codeEmbedProcessor = new CodeEmbedProcessor(this.app, this.settings, this);

    // Add settings tab for plugin
    this.addSettingTab(new CSVCodeViewSettingTab(this.app, this));

    // Register CodeMirror extension for Live Preview mode code embeds
    // This provides readonly preview with syntax highlighting in editor mode
    this.registerEditorExtension(
      createCodeEmbedExtension(
        this.app,
        this.settings,
        this,
        () => this.app.workspace.getActiveFile()?.path || ''
      )
    );

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

    // Register Markdown Post Processor to handle code embeds in Reading mode
    this.registerMarkdownPostProcessor(async (el, ctx) => {
      await this.processCodeEmbedsInElement(el, ctx);
    });

    // Use layout-change event to process embeds after Obsidian renders them
    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        this.processAllEmbeds();
      })
    );

    // Also process when switching between editor and reading mode
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        // Small delay to ensure DOM is ready
        setTimeout(() => this.processAllEmbeds(), 100);
      })
    );

    // Process on file open
    this.registerEvent(
      this.app.workspace.on('file-open', () => {
        setTimeout(() => this.processAllEmbeds(), 200);
      })
    );

    // Register interval to periodically check for new embeds
    // This handles: 1) newly typed links, 2) Live Preview mode
    this.checkInterval = window.setInterval(() => {
      this.processAllEmbeds();
    }, 500);
    this.registerInterval(this.checkInterval);

    // Process immediately on plugin load
    setTimeout(() => this.processAllEmbeds(), 100);

    console.log('Code Link processors registered');
  }

  /**
   * Process code embeds in a given element using MarkdownPostProcessor
   */
  async processCodeEmbedsInElement(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    if (this.settings.codeEmbedEnabled !== 'enabled') {
      return;
    }

    const extensions = this.codeEmbedProcessor.getSupportedExtensions();
    if (extensions.length === 0) {
      return;
    }

    // Build selector for code file embeds
    const selectors = extensions.flatMap(ext => [
      `.internal-embed[src$=".${ext}"]:not(.code-embed-processed)`,
      `.internal-embed[src$=".${ext.toUpperCase()}"]:not(.code-embed-processed)`,
      `.internal-embed[alt$=".${ext}"]:not(.code-embed-processed)`,
      `.internal-embed[alt$=".${ext.toUpperCase()}"]:not(.code-embed-processed)`,
    ]);

    const codeEmbeds = el.querySelectorAll(selectors.join(', '));
    
    for (const embed of Array.from(codeEmbeds)) {
      let src = embed.getAttribute('src') || embed.getAttribute('alt');
      if (!src) continue;
      
      src = src.trim();
      if (!this.codeEmbedProcessor.isExtensionSupported(src)) continue;
      
      // Mark as processed
      embed.addClass('code-embed-processed');
              
      // Get the code file
      const file = this.app.metadataCache.getFirstLinkpathDest(src, ctx.sourcePath);
      if (!file) {
        console.warn('Code file not found:', src);
        continue;
      }
              
      try {
        const content = await this.app.vault.read(file);
        const language = this.codeEmbedProcessor.getLanguageFromPath(src);
                
        // Clear embed and create container
        embed.empty();
        embed.addClass('code-embed-container');
                
        // Prevent click from opening file
        (embed as HTMLElement).addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
                
        // Create container with label
        const container = (embed as HTMLElement).createDiv({ cls: 'code-embed-container' });
        container.createDiv({ cls: 'code-embed-label', text: language });
                
        // Add "Open File" button
        const openButton = container.createDiv({ cls: 'code-embed-open-btn' });
        setIcon(openButton, 'external-link');
        openButton.setAttribute('aria-label', 'Open file');
        const fileSrc = src; // Capture for closure
        openButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.app.workspace.openLinkText(fileSrc, ctx.sourcePath);
        });
                
        const wrapper = container.createDiv({ cls: 'code-embed-wrapper' });
        
        // Create standard Markdown code block and let Obsidian render it
        const markdownCodeBlock = '```' + language + '\n' + content + '\n```';
        
        // Use MarkdownRenderer to render the code block
        // Obsidian will automatically apply syntax highlighting
        await MarkdownRenderer.render(
          this.app,
          markdownCodeBlock,
          wrapper,
          ctx.sourcePath,
          this
        );
        
        console.log('Rendered code embed via PostProcessor:', src);
      } catch (error) {
        console.error('Failed to process code embed:', src, error);
      }
    }
  }

  onunload() {
    if (this.checkInterval) {
      window.clearInterval(this.checkInterval);
    }
  }

  /**
   * Process all file embeds (CSV and code files)
   */
  processAllEmbeds() {
    this.processAllCSVEmbeds();
    this.processAllCodeEmbeds();
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
        
        // Selector for both Reading mode and Live Preview mode
        // Reading mode: .internal-embed[src$=".csv"]
        // Live Preview: .cm-embed-block .internal-embed, or elements with data-src
        const csvSelectors = [
          '.internal-embed[src$=".csv"]:not(.csv-processed)',
          '.internal-embed[src$=".CSV"]:not(.csv-processed)',
          '.cm-embed-block .internal-embed[src$=".csv"]:not(.csv-processed)',
          '.cm-embed-block .internal-embed[src$=".CSV"]:not(.csv-processed)',
          // Also check for alt attribute which sometimes contains filename in Live Preview
          '.internal-embed[alt$=".csv"]:not(.csv-processed)',
          '.internal-embed[alt$=".CSV"]:not(.csv-processed)',
        ].join(', ');
        
        const csvEmbeds = container.querySelectorAll(csvSelectors);
        
        if (csvEmbeds.length > 0) {
          console.log('Found CSV embeds in view:', csvEmbeds.length);
        }
        
        csvEmbeds.forEach(async (embed) => {
          // Try to get src from multiple attributes
          let src = embed.getAttribute('src') || embed.getAttribute('alt');
          if (!src) return;
          
          // Clean up the src (remove any leading/trailing whitespace)
          src = src.trim();
          
          // Make sure it ends with .csv
          if (!src.toLowerCase().endsWith('.csv')) return;
          
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
              
              // Prevent click from opening file
              (embed as HTMLElement).addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
              });
              
              // Add "Open File" button
              const openButton = (embed as HTMLElement).createDiv({ cls: 'csv-open-btn' });
              setIcon(openButton, 'external-link');
              openButton.setAttribute('aria-label', 'Open CSV file');
              const fileSrc = src; // Capture for closure
              const viewPath = view.file?.path || '';
              openButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.app.workspace.openLinkText(fileSrc, viewPath);
              });
              
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

  /**
   * Scan and process all code file embeds in active markdown views
   */
  processAllCodeEmbeds() {
    if (this.settings.codeEmbedEnabled !== 'enabled') {
      return;
    }

    const extensions = this.codeEmbedProcessor.getSupportedExtensions();
    if (extensions.length === 0) {
      return;
    }

    // Get all markdown views
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view instanceof MarkdownView) {
        const view = leaf.view;
        const container = view.containerEl;
        
        // Build selectors for both Reading mode and Live Preview mode
        const codeSelectors: string[] = [];
        extensions.forEach(ext => {
          // Reading mode selectors
          codeSelectors.push(`.internal-embed[src$=".${ext}"]:not(.code-embed-processed)`);
          codeSelectors.push(`.internal-embed[src$=".${ext.toUpperCase()}"]:not(.code-embed-processed)`);
          // Live Preview mode selectors
          codeSelectors.push(`.cm-embed-block .internal-embed[src$=".${ext}"]:not(.code-embed-processed)`);
          codeSelectors.push(`.cm-embed-block .internal-embed[src$=".${ext.toUpperCase()}"]:not(.code-embed-processed)`);
          // Alt attribute fallback
          codeSelectors.push(`.internal-embed[alt$=".${ext}"]:not(.code-embed-processed)`);
          codeSelectors.push(`.internal-embed[alt$=".${ext.toUpperCase()}"]:not(.code-embed-processed)`);
        });
        
        const selector = codeSelectors.join(', ');
        const codeEmbeds = container.querySelectorAll(selector);
        
        if (codeEmbeds.length > 0) {
          console.log('Found code embeds in view:', codeEmbeds.length);
        }
        
        codeEmbeds.forEach(async (embed) => {
          // Try to get src from multiple attributes
          let src = embed.getAttribute('src') || embed.getAttribute('alt');
          if (!src) return;
          
          // Clean up the src
          src = src.trim();
          
          // Verify it's a supported extension
          if (!this.codeEmbedProcessor.isExtensionSupported(src)) return;
          
          console.log('Processing code embed:', src);
          
          // Mark as processed to avoid reprocessing
          embed.addClass('code-embed-processed');
          
          // Render the code file
          await this.codeEmbedProcessor.renderCodeFile(src, embed as HTMLElement, view.file?.path || '');
        });
      }
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    console.log('Settings saved');
    // Update processor settings
    this.csvProcessor.updateSettings(this.settings);
    this.codeEmbedProcessor.updateSettings(this.settings);
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
