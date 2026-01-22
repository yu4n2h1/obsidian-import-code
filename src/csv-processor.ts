import {MarkdownPostProcessorContext, TFile, App, setIcon} from 'obsidian';
import { FileProcessor } from './file-processor';

export interface CSVProcessorSettings {
	csvCodeView: string;
}

export class CSVProcessor extends FileProcessor {
	constructor(app: App, settings: CSVProcessorSettings) {
		super(app, settings);
	}

	/**
	 * 实现内容处理：将 CSV 字符串解析为行和列
	 */
	processContent(content: string): string[][] {
		return content.split("\n")
			.filter((row) => row.trim().length > 0)
			.map(row => row.split(","));
	}

	/**
	 * 实现渲染逻辑：将解析后的行数据转换为 HTML 表格
	 */
	async render(rows: string[][], el: HTMLElement, filePath: string, sourcePath: string): Promise<void> {
		const container = el.createDiv({ cls: 'csv-table-container' });

		// 添加“打开文件”按钮
		const openButton = container.createDiv({ cls: 'csv-open-btn' });
		setIcon(openButton, 'external-link');
		openButton.setAttribute('aria-label', 'Open CSV file');
		openButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.app.workspace.openLinkText(filePath, sourcePath);
		});

		const table = container.createEl("table");
		const body = table.createEl("tbody");

		for (const cols of rows) {
			const row = body.createEl("tr");
			for (const col_text of cols) {
				row.createEl("td", { text: col_text.trim() });
			}
		}
	}

	protected setupClickInterceptor(targetElement: HTMLElement): void {
		targetElement.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			if (!this.isToolbarButton(target)) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
			}
		}, true);
	}

	protected isToolbarButton(target: HTMLElement): boolean {
		return !!target.closest('.csv-open-btn');
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
		const rows = this.processContent(source);
		this.render(rows, el, "", ctx.sourcePath); // Path is empty for raw source
	}

	/**
	 * Render CSV as plain text
	 */
	private renderAsPlainText(source: string, el: HTMLElement): void {
		el.createEl("pre").setText(source);
	}

	/**
	 * Render CSV file content and replace target element
	 */
	public async renderCSVFileAndReplace(filePath: string, targetElement: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		await this.processFile(filePath, targetElement, ctx.sourcePath);
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
		if (!filePath) {
			el.createEl("div", { text: "Error: No file path provided", cls: "csv-error" });
			return;
		}

		await this.processFile(filePath, el, ctx.sourcePath);
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: CSVProcessorSettings): void {
		this.settings = settings;
	}

	/**
	 * 获取支持的文件扩展名列表
	 */
	getSupportedExtensions(): string[] {
		return ['csv'];
	}

	/**
	 * 检查文件扩展名是否被支持
	 */
	isExtensionSupported(filePath: string): boolean {
		const lowerPath = filePath.toLowerCase();
		return lowerPath.endsWith('.csv');
	}

	/**
	 * 检查功能是否启用
	 */
	isFeatureEnabled(): boolean {
		return (this.settings as CSVProcessorSettings).csvCodeView === 'enabled';
	}

	/**
	 * 获取 Live Preview 处理完成后的 CSS 类名
	 */
	getProcessedClassName(): string {
		return 'csv-embed-lp-processed';
	}

	/**
	 * 获取 Widget 的 CSS 类名
	 */
	getWidgetClassName(): string {
		return 'csv-embed-widget';
	}
}
