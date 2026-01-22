import { Plugin, MarkdownPostProcessorContext, MarkdownView } from 'obsidian';
import { PluginSettings, DEFAULT_SETTINGS, CSVCodeViewSettingTab } from './settings';
import { CSVProcessor } from './csv-processor';
import { CodeEmbedProcessor } from './code-embed-processor';
import { getLanguageFromPath } from './utils';


export default class MyPlugin extends Plugin {	
	settings: PluginSettings;
	csvProcessor: CSVProcessor | null = null;
	codeEmbedProcessor: CodeEmbedProcessor | null = null;

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


