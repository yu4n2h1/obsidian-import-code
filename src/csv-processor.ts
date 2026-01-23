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
	 * @param content - CSV 字符串
	 * @return 解析后的行和列数据，每行数据为字符串数组
	 */
	processContent(content: string): string[][] {
		return content.split("\n")
			.filter((row) => row.trim().length > 0)
			.map(row => row.split(","));
	}

	/**
	 * 实现渲染逻辑：将解析后的行数据转换为 HTML 表格
	 */
	async render(rows: string[][], targetElement: HTMLElement, filePath: string, sourcePath: string): Promise<void> {
		// 1. 创建新的主容器
		const container = document.createElement('div');
		container.className = 'csv-table-container';
	
		// 2. 创建工具栏
		const toolbar = container.createDiv({ cls: 'csv-table-toolbar' });

		// 2.1 添加"打开文件"按钮
		const openButton = toolbar.createDiv({ cls: 'csv-open-btn' });
		setIcon(openButton, 'external-link');
		openButton.setAttribute('aria-label', 'Open CSV file');
		openButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.app.workspace.openLinkText(filePath, sourcePath);
		});
	
		// 3. 创建表格
		const table = container.createEl("table");
		const body = table.createEl("tbody");
	
		for (const cols of rows) {
			const row = body.createEl("tr");
			for (const col_text of cols) {
				row.createEl("td", { text: col_text.trim() });
			}
		}
	
		// 4. 替换原有元素
		targetElement.replaceWith(container);
	}
}
