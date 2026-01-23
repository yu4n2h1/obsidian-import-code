import {TFile, App, MarkdownRenderer, Component, setIcon, MarkdownView, Plugin} from 'obsidian';
import { getLanguageFromPath } from './utils';
import { FileProcessor } from './file-processor';

export interface CodeEmbedSettings {
	codeEmbedEnabled: string;
	codeFileExtensions: string;
}

export class CodeEmbedProcessor extends FileProcessor {
	plugin: Component;  // Use plugin as Component for proper lifecycle

	/**
	 * 构造函数
	 */
	constructor(app: App, settings: CodeEmbedSettings, plugin: Component) {
		super(app, settings);
		this.plugin = plugin;
	} 

	/**
	 * 实现内容处理：代码文件目前直接返回原始内容
	 */
	processContent(content: string): string {
		return content;
	}

	/**
	 * 实现渲染逻辑：使用 Obsidian 原生 MarkdownRenderer 渲染代码块
	 */
	async render(content: string, targetElement: HTMLElement, filePath: string, sourcePath: string): Promise<void> {
		const [_, language] = getLanguageFromPath(filePath);

		// 1. 创建新的主容器
		const container = document.createElement('div');
		container.className = 'code-embed-container';

		// 2. 创建工具栏
		const toolbar = container.createDiv({ cls: 'code-embed-toolbar' });
		
		// 2.1 添加"打开文件"按钮
		const openButton = toolbar.createDiv({ cls: 'code-embed-open-btn' });
		openButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.app.workspace.openLinkText(filePath, sourcePath);
		});
		setIcon(openButton, 'external-link');
		openButton.setAttribute('aria-label', 'Open file');
		
		// 2.2 添加语言标签
		toolbar.createSpan({ 
			cls: 'code-block-flair', 
			text: language,
			attr: {
				'aria-label': '复制',
				'contenteditable': 'false'
			}
		});

		// 3. 创建代码包裹容器
		const wrapper = container.createDiv({ cls: 'code-embed-wrapper' });
	
		// 4. 渲染代码内容
		const markdownCodeBlock = '```' + language + '\n' + content + '\n```';
		await MarkdownRenderer.render(
			this.app,
			markdownCodeBlock,
			wrapper,
			sourcePath,
			this.plugin
		);

		// 5. 替换原有元素
		targetElement.replaceWith(container);
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

