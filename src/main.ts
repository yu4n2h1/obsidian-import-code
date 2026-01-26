import { Plugin, MarkdownPostProcessorContext, MarkdownView, TFile, Editor, App } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, importCodeSettingsTab } from './settings';
import { FileProcessor } from './file-processor';
import { CSVProcessor } from './csv-processor';
import { CodeEmbedProcessor } from './code-embed-processor';
import { getLanguageFromPath, isExtensionSupported } from './utils';
import { EditorView, ViewPlugin } from '@codemirror/view';



export default class importCode extends Plugin {
	// 值为fileProcessor的map
	fileProcessorMap: Map<string, FileProcessor> = new Map();
	settings: PluginSettings;

	/*
	 * 加载设置从data.js
	 */
	async loadSettings() {
		// 从data.js当中读取并加载配置
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	/**
	 * 保存设置到data.js当中
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/* 
	 * 根据设置初始化处理器
	 */
	initProcessors() {
		this.fileProcessorMap.clear();
		if (this.settings.csvCodeView === 'enabled') {
			this.fileProcessorMap.set('csv', new CSVProcessor(this.app, this.settings));
		}
		if (this.settings.codeEmbedEnabled === 'enabled') {
			this.fileProcessorMap.set('code', new CodeEmbedProcessor(this.app, this.settings, this));
		}
	}



	/**
	 * 加载插件
	 */
	async onload() {
		// 加载设置
		await this.loadSettings();
		// 根据设置初始化处理器
		this.initProcessors();
		// 添加设置选项卡
		this.addSettingTab(new importCodeSettingsTab(this.app, this));

		// 注册 Markdown 后处理器（用于阅读模式）
		this.registerMarkdownPostProcessor(async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			
			const embeds = el.querySelectorAll('.internal-embed');
			for (let i = 0; i < embeds.length; i++) {
				const embed = embeds[i] as HTMLElement;

				// 跳过已处理的嵌入元素
				if (embed.classList.contains('code-link-processed')) continue;
				
				// 获取嵌入元素的 src 属性
				const src = embed.getAttribute('src');
				if (!src) continue;

				const [extension, language] = getLanguageFromPath(src);

				// 根据文件类型选择处理器
				let processor: FileProcessor | undefined;
				if (this.settings.csvCodeView === 'enabled' && language === 'csv') {
					processor = this.fileProcessorMap.get('csv');
				} else if (this.settings.codeEmbedEnabled === 'enabled' && isExtensionSupported(this.settings, extension)) {
					// 其他已知代码文件类型使用 code 处理器
					processor = this.fileProcessorMap.get('code');
				}

				if (processor) {
					embed.classList.add('code-link-processed');
					await processor.processFile(src, embed, ctx.sourcePath);
				}
			}
		});		
		this.registerEditorExtension(ViewPlugin.define((view:EditorView) => {
			const processingSet = new Set<HTMLElement>();

			setTimeout(() => processEmbeds(view, processingSet, this.fileProcessorMap, this.settings, this.app), 50);

			return {
				update: (update) => {
					if (update.docChanged || update.viewportChanged) {
						setTimeout(() => processEmbeds(view, processingSet, this.fileProcessorMap, this.settings, this.app), 50);
					}
				},
				destroy: () => {
					processingSet.clear();
				}
			}
		}));
	}

	async onunload() {
		console.log('Unloading importCode plugin');
		// 清空处理器映射
		this.fileProcessorMap.clear();
		// 重新渲染所有已打开的 Markdown 视图，清除插件渲染的内容
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				// 强制重新加载视图
				const state = leaf.getViewState();
				leaf.setViewState({ type: 'empty' }).then(() => {
					leaf.setViewState(state);
				});
			}
		});
	}
}


function processEmbeds(view: EditorView, processingSet: Set<HTMLElement>, fileProcessorMap: Map<string, FileProcessor>, settings: PluginSettings, app: App) {
	const embeds = view.dom.querySelectorAll('.internal-embed');
	for (let i = 0; i < embeds.length; i++) {
		const embed = embeds[i] as HTMLElement;

		// 跳过已处理的嵌入元素
		if (embed.classList.contains('code-link-processed')) continue;
		
		// 获取嵌入元素的 src 属性
		const src = embed.getAttribute('src');
		if (!src) continue;

		const [extension, language] = getLanguageFromPath(src);

		// 根据文件类型选择处理器
		let processor: FileProcessor | undefined;
		if (fileProcessorMap.has('csv') && language === 'csv') {
			processor = fileProcessorMap.get('csv');
		} else if (settings.codeEmbedEnabled === 'enabled' && isExtensionSupported(settings, extension)) {
			// 其他已知代码文件类型使用 code 处理器
			processor = fileProcessorMap.get('code');
		}
		const activeView = app.workspace.getActiveViewOfType(MarkdownView);
		const sourcePath = activeView?.file?.path || '';

		if (processor) {
			embed.classList.add('code-link-processed');
			// 立即清空防止 Obsidian 默认内容显示
			embed.empty();
			processor.processFile(src, embed, sourcePath);
		}
	}
}
