import { Plugin, MarkdownPostProcessorContext, MarkdownView, TFile } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, CSVCodeViewSettingTab } from './settings';
import { CSVProcessor } from './csv-processor';
import { CodeEmbedProcessor } from './code-embed-processor';
import { getLanguageFromPath } from './utils';


export default class MyPlugin extends Plugin {	
	settings: PluginSettings;
	csvProcessor: CSVProcessor | null = null;
	codeEmbedProcessor: CodeEmbedProcessor | null = null;
	
	// 文件修改防抖定时器映射
	private fileModifyDebounceMap: Map<string, ReturnType<typeof setTimeout>> = new Map();
	// 防抖延迟时间（毫秒）
	private readonly DEBOUNCE_DELAY = 300;

	async onload() {
		await this.loadSettings();

		// 初始化处理器
		this.initProcessors();
		
		// 通过处理器实例注册编辑器扩展
		if (this.codeEmbedProcessor) {
			this.codeEmbedProcessor.registerEditorExtension(this);
		}
		if (this.csvProcessor) {
			this.csvProcessor.registerEditorExtension(this);
		}

		// Add settings tab
		this.addSettingTab(new CSVCodeViewSettingTab(this.app, this));

		// 监听文件修改事件，刷新引用该文件的嵌入渲染
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile) {
					this.handleFileModify(file);
				}
			})
		);

		// 注册统一的 Markdown 后处理器
		// 设置 sortOrder 为 -100 以提高优先级，确保在其他插件处理之前运行
		this.registerMarkdownPostProcessor(async (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const embeds = el.querySelectorAll('.internal-embed');
			
			for (let i = 0; i < embeds.length; i++) {
				const embed = embeds[i] as HTMLElement;
				if (embed.classList.contains('code-link-processed')) continue;
				
				const src = embed.getAttribute('src');
				if (!src) continue;

				const [extension, language] = getLanguageFromPath(src);

				// 使用 FileProcessor 基类的 processFile 方法处理渲染逻辑
				// 该方法已内置加载状态显示、点击拦截和错误处理
				if (language === 'csv' && this.csvProcessor && this.settings.csvCodeView === 'enabled') {
					embed.classList.add('code-link-processed');
					await this.csvProcessor.processFile(src, embed, ctx.sourcePath);
				} 
				else if (this.codeEmbedProcessor?.isExtensionSupported(src) && this.settings.codeEmbedEnabled === 'enabled') {
					embed.classList.add('code-link-processed');
					await this.codeEmbedProcessor.processFile(src, embed, ctx.sourcePath);
				}
			}
		}, -100);

		// 注册 CSV 代码块处理器，同样使用基类的 processFile
		this.registerMarkdownCodeBlockProcessor("csv", async (source, el, ctx) => {
			if (this.csvProcessor && this.settings.csvCodeView === 'enabled') {
				await this.csvProcessor.processFile(source.trim(), el, ctx.sourcePath);
			}
		});
	}

	/**
	 * 根据当前设置初始化或更新处理器
	 */
	initProcessors() {
		if (this.settings.csvCodeView === 'enabled' && !this.csvProcessor) {
			this.csvProcessor = new CSVProcessor(this.app, this.settings);
		}
		if (this.settings.codeEmbedEnabled === 'enabled' && !this.codeEmbedProcessor) {
			this.codeEmbedProcessor = new CodeEmbedProcessor(this.app, this.settings, this);
		}
	}

	async onunload() {
		console.log('Unloading Code Link plugin');
		// 清理所有防抖定时器
		this.clearAllDebounceTimers();
	}

	/**
	 * 清理所有防抖定时器
	 */
	private clearAllDebounceTimers(): void {
		for (const timer of this.fileModifyDebounceMap.values()) {
			clearTimeout(timer);
		}
		this.fileModifyDebounceMap.clear();
	}

	/**
	 * 处理文件修改事件（带防抖）
	 */
	private handleFileModify(file: TFile): void {
		const filePath = file.path;
		const extension = file.extension.toLowerCase();
		
		// 检查是否是支持的文件类型
		const isCSV = extension === 'csv' && this.settings.csvCodeView === 'enabled';
		const isCodeFile = this.codeEmbedProcessor?.isExtensionSupported(filePath) && 
		                   this.settings.codeEmbedEnabled === 'enabled';
		
		if (!isCSV && !isCodeFile) {
			return;
		}

		// 清除之前的防抖定时器
		const existingTimer = this.fileModifyDebounceMap.get(filePath);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// 设置新的防抖定时器
		const timer = setTimeout(() => {
			this.fileModifyDebounceMap.delete(filePath);
			this.refreshEmbedsForFile(filePath);
		}, this.DEBOUNCE_DELAY);
		
		this.fileModifyDebounceMap.set(filePath, timer);
	}

	/**
	 * 刷新引用指定文件的所有嵌入元素
	 */
	private refreshEmbedsForFile(modifiedFilePath: string): void {
		try {
			this.app.workspace.iterateAllLeaves(async (leaf) => {
				if (!(leaf.view instanceof MarkdownView)) return;
				
				const viewFile = leaf.view.file;
				if (!viewFile) return;

				// 获取该视图中的所有嵌入链接
				const cache = this.app.metadataCache.getFileCache(viewFile);
				const embeds = cache?.embeds || [];
				
				// 检查是否引用了修改的文件
				const hasReference = embeds.some(embed => {
					const linkedFile = this.app.metadataCache.getFirstLinkpathDest(
						embed.link, 
						viewFile.path
					);
					return linkedFile?.path === modifiedFilePath;
				});

				if (hasReference) {
					// 使用处理器的刷新方法
					let refreshed = false;
					
					if (this.csvProcessor) {
						const csvRefreshed = await this.csvProcessor.refreshEmbedsInView(
							leaf.view, modifiedFilePath, viewFile.path
						);
						refreshed = refreshed || csvRefreshed;
					}
					
					if (this.codeEmbedProcessor) {
						const codeRefreshed = await this.codeEmbedProcessor.refreshEmbedsInView(
							leaf.view, modifiedFilePath, viewFile.path
						);
						refreshed = refreshed || codeRefreshed;
					}
					
					// 如果精确刷新失败，回退到整个视图刷新
					if (!refreshed) {
						leaf.view.previewMode?.rerender(true);
					}
				}
			});
		} catch (error) {
			console.error('[Code Link] Error refreshing embeds for file:', modifiedFilePath, error);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// 在保存设置时重新确定处理器的使用情况
		this.initProcessors();
		
		// 更新现有处理器的设置引用
		if (this.csvProcessor) this.csvProcessor.updateSettings(this.settings);
		if (this.codeEmbedProcessor) this.codeEmbedProcessor.updateSettings(this.settings);
		
		// 强制刷新所有打开的 Markdown 视图以应用新设置
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof MarkdownView) {
				leaf.view.previewMode?.rerender(true);
			}
		});
	}
}


