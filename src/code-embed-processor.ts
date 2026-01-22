import {TFile, App, MarkdownRenderer, Component, setIcon, MarkdownView, Plugin} from 'obsidian';
import { getLanguageFromPath } from './utils';
import { FileProcessor } from './file-processor';

export interface CodeEmbedSettings {
	codeEmbedEnabled: string;
	codeFileExtensions: string;
}

export class CodeEmbedProcessor extends FileProcessor {
	plugin: Component;  // Use plugin as Component for proper lifecycle

	constructor(app: App, settings: CodeEmbedSettings, plugin: Component) {
		super(app, settings);
		this.plugin = plugin;
	} // 构造器，没什么好说的倒是

	/**
	 * 实现内容处理：代码文件目前直接返回原始内容
	 */
	processContent(content: string): string {
		return content;
	}

	/**
	 * 实现渲染逻辑：使用 Obsidian 原生 MarkdownRenderer 渲染代码块
	 */
	async render(content: string, el: HTMLElement, filePath: string, sourcePath: string): Promise<void> {
		const [_, language] = getLanguageFromPath(filePath);
		
		// 1. 创建特定的布局结构
		const innerContainer = el.createDiv({ cls: 'code-embed-container' });
		innerContainer.createDiv({ cls: 'code-embed-label', text: language });

		// 2. 添加“打开文件”按钮
		const openButton = innerContainer.createDiv({ cls: 'code-embed-open-btn' });
		setIcon(openButton, 'external-link');
		openButton.setAttribute('aria-label', 'Open file');
		openButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.app.workspace.openLinkText(filePath, sourcePath);
		});
		
		const wrapper = innerContainer.createDiv({ cls: 'code-embed-wrapper' });

		// 3. 渲染代码内容
		const markdownCodeBlock = '```' + language + '\n' + content + '\n```';
		await MarkdownRenderer.render(
			this.app,
			markdownCodeBlock,
			wrapper,
			sourcePath,
			this.plugin
		);
	}

	protected isOpenButton(target: HTMLElement): boolean {
		return !!target.closest('.code-embed-open-btn');
	}

	/**
	 * Get the list of supported file extensions from settings
	 * 从设置当中获取支持渲染的文件列表
	 */
	getSupportedExtensions(): string[] {
		const extensions = (this.settings as CodeEmbedSettings).codeFileExtensions
			.split(',')
			.map(ext => ext.trim().toLowerCase())
			.filter(ext => ext.length > 0);
		return extensions;
	}

	/**
	 * Check if a file extension is supported
	 * 检查特定文件扩展名是否被支持
	 */
	isExtensionSupported(filePath: string): boolean {
		const extensions = this.getSupportedExtensions();
		const lowerPath = filePath.toLowerCase();
		return extensions.some(ext => lowerPath.endsWith('.' + ext));
	}

	/**
	 * Build CSS selector for all supported extensions
	 * 生成支持的扩展名的 CSS 选择器
	 */
	buildSelector(): string {
		const extensions = this.getSupportedExtensions();
		if (extensions.length === 0) {
			return '';
		}
		
		const selectors = extensions.flatMap(ext => [
			`.internal-embed[src$=".${ext}"]:not(.code-embed-processed)`,
			`.internal-embed[src$=".${ext.toUpperCase()}"]:not(.code-embed-processed)`
		]);
		
		return selectors.join(', ');
	}

	/**
	 * Render code file and replace target element
	 */
	async renderCodeFile(filePath: string, targetElement: HTMLElement, sourcePath: string): Promise<boolean> {
		return await this.processFile(filePath, targetElement, sourcePath);
	}


	/**
	 * Update settings reference
	 */
	updateSettings(settings: CodeEmbedSettings): void {
		this.settings = settings;
	}

	/**
	 * 检查功能是否启用
	 */
	isFeatureEnabled(): boolean {
		return (this.settings as CodeEmbedSettings).codeEmbedEnabled === 'enabled';
	}

	/**
	 * 获取 Live Preview 处理完成后的 CSS 类名
	 */
	getProcessedClassName(): string {
		return 'code-embed-lp-processed';
	}

	/**
	 * 获取 Widget 的 CSS 类名
	 */
	getWidgetClassName(): string {
		return 'code-embed-widget';
	}
}
