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
		
		// 2. 创建右上角工具栏容器（使用 flexbox 排列按钮）
		const toolbar = innerContainer.createDiv({ cls: 'code-embed-toolbar' });
		
		// 添加"打开文件"按钮
		const openButton = toolbar.createDiv({ cls: 'code-embed-open-btn' });
		openButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.app.workspace.openLinkText(filePath, sourcePath);
		});
		setIcon(openButton, 'external-link');
		openButton.setAttribute('aria-label', 'Open file');
		
		// 添加语言标签
		toolbar.createSpan({ 
			cls: 'code-block-flair', 
			text: language,
			attr: {
				'aria-label': '复制',
				'contenteditable': 'false'
			}
		});

		// 3. 创建代码包裹容器
		const wrapper = innerContainer.createDiv({ cls: 'code-embed-wrapper' });
	
		// 4. 渲染代码内容
		const markdownCodeBlock = '```' + language + '\n' + content + '\n```';
		await MarkdownRenderer.render(
			this.app,
			markdownCodeBlock,
			wrapper,
			sourcePath,
			this.plugin
		);
	
		// 5. 移除 MarkdownRenderer 生成的多余 <p> 标签包裹
		this.removeParagraphWrapper(wrapper);
		setTimeout(() => this.removeParagraphWrapper(wrapper), 0);
	}

	/**
	 * 移除 wrapper 中的多余 <p> 标签包裹
	 */
	private removeParagraphWrapper(wrapper: HTMLElement): void {
		// 查找所有直接子级 p 标签
		const paragraphs = wrapper.querySelectorAll(':scope > p');
		paragraphs.forEach(paragraph => {
			// 将 p 内的所有子元素移动到 wrapper
			while (paragraph.firstChild) {
				wrapper.insertBefore(paragraph.firstChild, paragraph);
			}
			paragraph.remove();
		});
	}

	protected setupClickInterceptor(targetElement: HTMLElement): void {
		const wrapper = targetElement.querySelector('.code-embed-wrapper');
		if (!wrapper) return;
		
		wrapper.addEventListener('click', (e) => {
			const target = e.target as HTMLElement;
			if (!this.isToolbarButton(target)) {
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
			}
		}, true);
	}

	protected isToolbarButton(target: HTMLElement): boolean {
		return !!target.closest('.code-embed-open-btn') || !!target.closest('.code-block-flair');
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

