import {MarkdownPostProcessorContext, TFile, App} from 'obsidian';

export interface CSVProcessorSettings {
	csvCodeView: string;
}

export class CSVProcessor {
	settings: CSVProcessorSettings;
	app: App;

	constructor(app: App, settings: CSVProcessorSettings) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * Process CSV source code and render as table or plain text
	 * @param source - CSV source string
	 * @param el - Container element
	 * @param ctx - Markdown processor context
	 */
	process(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void {
		// Check if CSV table view is enabled
		if (this.settings.csvCodeView !== 'enabled') {
			this.renderAsPlainText(source, el);
			return;
		}

		this.renderAsTable(source, el);
	}

	/**
	 * Render CSV as plain text
	 */
	private renderAsPlainText(source: string, el: HTMLElement): void {
		el.createEl("pre").setText(source);
	}

	/**
	 * Render CSV as HTML table (public method)
	 */
	renderTable(source: string, el: HTMLElement): void {
		this.renderAsTable(source, el);
	}

	/**
	 * Render CSV as HTML table (private implementation)
	 */
	private renderAsTable(source: string, el: HTMLElement): void {
		const rows = source.split("\n").filter((row) => row.length > 0);

		const table = el.createEl("table");
		const body = table.createEl("tbody");

		for (let i = 0; i < rows.length; i++) {
			const row_text = rows[i];
			if (!row_text) continue;
			
			const cols = row_text.split(",");
			const row = body.createEl("tr");

			for (let j = 0; j < cols.length; j++) {
				const col_text = cols[j];
				if (col_text !== undefined) {
					row.createEl("td", { text: col_text });
				}
			}
		}
	}

	/**
	 * Process markdown post-processor to replace ![](file.csv) with table
	 * @param el - Container element
	 * @param ctx - Markdown processor context
	 */
	async processMarkdownImages(el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		// Check if CSV table view is enabled
		if (this.settings.csvCodeView !== 'enabled') {
			return;
		}

		// Debug: Log to see what elements we're processing
		console.log('Processing markdown post-processor for element:', el.tagName, el.className);

		// Check if the current element itself is a file-embed for CSV
		if (el.classList.contains('internal-embed') && el.classList.contains('file-embed')) {
			const src = el.getAttribute('src');
			console.log('Current element is file-embed, src:', src);
			if (src && src.toLowerCase().endsWith('.csv')) {
				console.log('Processing current element as CSV embed');
				await this.renderCSVFileAndReplace(src, el, ctx);
				return; // Early return after processing
			}
		}

		// Priority 1: Handle file-embed containers (for ![[file.csv]] syntax)
		// Use a broader selector to catch all possible CSV embeds
		const fileEmbeds = el.querySelectorAll('[src$=".csv"], [src$=".CSV"]');
		console.log('Found elements with .csv src:', fileEmbeds.length);
		
		for (let i = 0; i < fileEmbeds.length; i++) {
			const embed = fileEmbeds[i] as HTMLElement;
			if (!embed) continue;

			// Get file path from src attribute
			const src = embed.getAttribute('src');
			const alt = embed.getAttribute('alt');
			
			console.log('Processing element with CSV src:', src, 'element:', embed.tagName, embed.className);
			
			if (!src) continue;

			console.log('Found CSV embed, rendering:', src);
			await this.renderCSVFileAndReplace(src, embed, ctx);
		}

		// Priority 2: Find all img elements (standard markdown images)
		const images = el.querySelectorAll('img[src$=".csv"], img[src$=".CSV"]');
		console.log('Found img elements with .csv:', images.length);
		
		for (let i = 0; i < images.length; i++) {
			const img = images[i] as HTMLElement;
			if (!img) continue;

			const src = img.getAttribute('src');
			console.log('Processing img with CSV src:', src);
			
			if (!src) continue;

			await this.renderCSVFileAndReplace(src, img, ctx);
		}

		// Priority 3: Handle Obsidian internal links with .csv in data-href
		const internalLinks = el.querySelectorAll('a.internal-link[data-href$=".csv"], a.internal-link[data-href$=".CSV"]');
		console.log('Found internal-link elements with .csv:', internalLinks.length);
		
		for (let i = 0; i < internalLinks.length; i++) {
			const link = internalLinks[i] as HTMLElement;
			if (!link) continue;

			const dataHref = link.getAttribute('data-href');
			const href = link.getAttribute('href');
			const linkPath = dataHref || href;
			
			console.log('Processing internal link with CSV:', linkPath);
			
			if (!linkPath) continue;

			// Check if this is an embed (has parent with class 'internal-embed')
			const embedContainer = link.closest('.internal-embed');
			if (embedContainer) {
				console.log('Found CSV embed container, rendering...');
				await this.renderCSVFileAndReplace(linkPath, embedContainer as HTMLElement, ctx);
			}
		}
	}

	/**
	 * Render CSV file content and replace target element
	 */
	private async renderCSVFileAndReplace(filePath: string, targetElement: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		try {
			// Get the CSV file
			const file = this.app.metadataCache.getFirstLinkpathDest(filePath, ctx.sourcePath);
			
			if (file instanceof TFile) {
				console.log('Reading CSV file:', file.path);
				const content = await this.app.vault.read(file);
				
				// Create container for table
				const container = createDiv();
				container.addClass('csv-table-container');
				this.renderAsTable(content, container);
				
				// Replace target element with table
				if (targetElement.parentElement) {
					targetElement.parentElement.replaceChild(container, targetElement);
					console.log('Successfully rendered CSV table');
				} else {
					// If no parent, empty the element and append table
					targetElement.empty();
					targetElement.appendChild(container);
					console.log('Successfully appended CSV table');
				}
			} else {
				console.warn('CSV file not found:', filePath);
			}
		} catch (error) {
			console.error(`Failed to read CSV file: ${filePath}`, error);
		}
	}

	/**
	 * Process CSV file path from code block and render as table
	 * @param source - CSV file path
	 * @param el - Container element
	 * @param ctx - Markdown processor context
	 */
	async processCSVFilePath(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		// Check if CSV table view is enabled
		if (this.settings.csvCodeView !== 'enabled') {
			el.createEl("pre").setText(source);
			return;
		}

		const filePath = source.trim();
		console.log('Processing CSV file path from code block:', filePath);

		if (!filePath) {
			el.createEl("div", { text: "Error: No file path provided", cls: "csv-error" });
			return;
		}

		try {
			const file = this.app.metadataCache.getFirstLinkpathDest(filePath, ctx.sourcePath);
			
			if (file instanceof TFile) {
				console.log('Reading CSV file for code block:', file.path);
				const content = await this.app.vault.read(file);
				const container = createDiv();
				container.addClass('csv-table-container');
				this.renderAsTable(content, container);
				el.appendChild(container);
			} else {
				el.createEl("div", { text: `CSV file not found: ${filePath}`, cls: "csv-error" });
			}
		} catch (error) {
			el.createEl("div", { text: `Error loading CSV: ${error}`, cls: "csv-error" });
		}
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: CSVProcessorSettings): void {
		this.settings = settings;
	}
}
