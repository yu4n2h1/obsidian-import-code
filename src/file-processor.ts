import { App, TFile, MarkdownView, Plugin } from 'obsidian';
import { EditorView, ViewPlugin, ViewUpdate, PluginValue } from '@codemirror/view';

/**
 * 文件处理器抽象基类
 * 提供文件读取、渲染、Live Preview 支持和文件变化刷新等通用功能
 */

export abstract class FileProcessor {
	app: App;
	settings: any;

	constructor(app: App, settings: any) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * 抽象渲染方法：负责将处理后的数据渲染到 DOM 元素中
	 */
	abstract render(data: any, el: HTMLElement, filePath: string, sourcePath: string): Promise<void>;

	/**
	 * 抽象内容处理方法：负责对文件原始字符串进行初步处理
	 */
	abstract processContent(content: string): any;

	/**
	 * 异步读取文件内容
	 */
	async readFile(filePath: string, sourcePath: string): Promise<string | null> {
		const file = this.app.metadataCache.getFirstLinkpathDest(filePath, sourcePath);
		if (file instanceof TFile) {
			return await this.app.vault.read(file);
		}
		return null;
	}

	/**
	 * 通用的文件处理流程：显示加载中 -> 读取文件 -> 处理内容 -> 渲染
	 */
	async processFile(filePath: string, targetElement: HTMLElement, sourcePath: string): Promise<boolean> {
		try {
			// 1. 显示加载状态
			this.renderLoading(targetElement);

			const content = await this.readFile(filePath, sourcePath);
			
			if (content !== null) {
				const processedData = this.processContent(content);
				
				targetElement.empty();
				
				// 2. 执行特定渲染
				await this.render(processedData, targetElement, filePath, sourcePath);

				// 3. 设置点击拦截（需在渲染后执行，因为目标容器由render创建）
				this.setupClickInterceptor(targetElement);
				
				// 4. 移除包裹 targetElement 的多余 <p> 标签
				this.unwrapFromParagraph(targetElement);
				
				return true;
			} else {
				this.renderError(targetElement, `File not found: ${filePath}`);
				return false;
			}
		} catch (error) {
			console.error(`Failed to process file: ${filePath}`, error);
			this.renderError(targetElement, `Error loading: ${filePath}`);
			return false;
		}
	}

	/**
	 * 移除包裹在 targetElement 外面的多余 <p> 标签
	 * Obsidian 在渲染 Markdown 段落时会自动生成 <p dir="auto"> 包裹嵌入元素
	 */
	protected unwrapFromParagraph(targetElement: HTMLElement): void {
		const parent = targetElement.parentElement;
		if (parent && parent.tagName.toLowerCase() === 'p') {
			const grandparent = parent.parentElement;
			if (grandparent) {
				// 将 targetElement 移动到 <p> 的前面
				grandparent.insertBefore(targetElement, parent);
				// 如果 <p> 现在是空的，则删除它
				if (!parent.hasChildNodes() || parent.textContent?.trim() === '') {
					parent.remove();
				}
			}
		}
	}

	/**
	 * 设置点击事件拦截器
	 * 阻止非"打开文件"按钮的点击事件传播，避免意外触发其他交互
	 * @param targetElement - 需要设置拦截的目标元素
	 */
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
	



	/**
	 * 渲染加载状态
	 */
	protected renderLoading(el: HTMLElement): void {
		el.empty();
		el.createDiv({ cls: 'code-link-loading', text: 'Loading...' });
	}

	/**
	 * 渲染错误状态
	 */
	protected renderError(el: HTMLElement, message: string): void {
		el.empty();
		el.createDiv({ cls: 'code-link-error', text: message });
	}

	/**
	 * 检查点击的元素是否为“打开文件”按钮
	 */
	protected abstract isToolbarButton(target: HTMLElement): boolean;

	/**
	 * 注册编辑器扩展，实现 Live Preview 模式下的文件嵌入
	 * 子类需要实现 getSupportedExtensions, isExtensionSupported, isFeatureEnabled 和 getProcessedClassName
	 * @param plugin - Plugin 实例
	 */
	registerEditorExtension(plugin: Plugin): void {
		const processor = this;
		
		const livePreviewPlugin = ViewPlugin.fromClass(
			class implements PluginValue {
				private observer: MutationObserver | null = null;
				private view: EditorView;
				private processingSet: Set<HTMLElement> = new Set();

				constructor(view: EditorView) {
					this.view = view;
					this.setupObserver();
					// 初始处理
					setTimeout(() => this.processEmbeds(), 100);
				}

				/**
				 * 设置 MutationObserver 监听 DOM 变化
				 */
				private setupObserver(): void {
					this.observer = new MutationObserver((mutations) => {
						let shouldProcess = false;
						for (const mutation of mutations) {
							if (mutation.addedNodes.length > 0) {
								shouldProcess = true;
								break;
							}
						}
						if (shouldProcess) {
							this.processEmbeds();
						}
					});

					this.observer.observe(this.view.dom, {
						childList: true,
						subtree: true
					});
				}

				/**
				 * 处理 Live Preview 中的文件嵌入
				 */
				private async processEmbeds(): Promise<void> {
					const selector = processor.buildLivePreviewSelector();
					if (!selector) return;

					const processedClass = processor.getProcessedClassName();
					const embeds = this.view.dom.querySelectorAll(selector);
					
					for (let i = 0; i < embeds.length; i++) {
						const embed = embeds[i] as HTMLElement;
						
						// 避免重复处理
						if (embed.classList.contains(processedClass) || 
						    this.processingSet.has(embed)) {
							continue;
						}

						// 获取文件路径：支持 src 和 alt 属性
						const src = embed.getAttribute('src') || embed.getAttribute('alt') || '';
						if (!src || !processor.isExtensionSupported(src)) {
							continue;
						}

						// 检查功能是否启用
						if (!processor.isFeatureEnabled()) {
							continue;
						}

						this.processingSet.add(embed);
						embed.classList.add(processedClass);

						// 获取当前文件路径作为 sourcePath
						const sourcePath = this.getSourcePath();

						// 确保嵌入区域为只读
						this.makeReadOnly(embed);

						// 使用处理器渲染
						try {
							await processor.processFile(src, embed, sourcePath);
						} finally {
							this.processingSet.delete(embed);
						}
					}
				}

				/**
				 * 获取当前编辑文件的路径
				 */
				private getSourcePath(): string {
					const activeView = processor.app.workspace.getActiveViewOfType(MarkdownView);
					return activeView?.file?.path || '';
				}

				/**
				 * 确保嵌入区域为只读状态
				 */
				private makeReadOnly(embed: HTMLElement): void {
					embed.setAttribute('contenteditable', 'false');
					embed.classList.add(processor.getWidgetClassName());
					
					// 阻止编辑操作
					embed.addEventListener('beforeinput', (e) => {
						e.preventDefault();
					}, true);

					// 阻止键盘输入
					embed.addEventListener('keydown', (e) => {
						const key = e.key;
						// 允许导航键和复制操作
						const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
						                    'PageUp', 'PageDown', 'Home', 'End', 'Escape', 'Tab'];
						if (!allowedKeys.includes(key) && !(e.metaKey || e.ctrlKey)) {
							e.preventDefault();
						}
					}, true);
				}

				update(update: ViewUpdate): void {
					if (update.docChanged || update.viewportChanged) {
						// 延迟处理以确保 DOM 更新完成
						setTimeout(() => this.processEmbeds(), 50);
					}
				}

				destroy(): void {
					if (this.observer) {
						this.observer.disconnect();
						this.observer = null;
					}
					this.processingSet.clear();
				}
			}
		);

		plugin.registerEditorExtension(livePreviewPlugin);
	}

	/**
	 * 获取支持的文件扩展名列表
	 * 子类必须实现此方法
	 */
	abstract getSupportedExtensions(): string[];

	/**
	 * 检查文件扩展名是否被支持
	 * 子类必须实现此方法
	 */
	abstract isExtensionSupported(filePath: string): boolean;

	/**
	 * 检查功能是否启用
	 * 子类必须实现此方法
	 */
	abstract isFeatureEnabled(): boolean;

	/**
	 * 获取 Live Preview 处理完成后的 CSS 类名
	 * 子类可覆盖此方法
	 */
	getProcessedClassName(): string {
		return 'file-embed-lp-processed';
	}

	/**
	 * 获取 Widget 的 CSS 类名
	 * 子类可覆盖此方法
	 */
	getWidgetClassName(): string {
		return 'file-embed-widget';
	}

	/**
	 * 构建 Live Preview 模式的 CSS 选择器
	 * 支持 .internal-embed 和 .cm-embed-block 两种模式
	 */
	buildLivePreviewSelector(): string {
		const extensions = this.getSupportedExtensions();
		if (extensions.length === 0) {
			return '';
		}

		const processedClass = this.getProcessedClassName();
		const selectors: string[] = [];
		
		for (const ext of extensions) {
			// Reading mode 和 Live Preview 中的 internal-embed
			selectors.push(`.internal-embed[src$=".${ext}"]:not(.${processedClass})`);
			selectors.push(`.internal-embed[src$=".${ext.toUpperCase()}"]:not(.${processedClass})`);
			
			// Live Preview 中可能使用 alt 属性
			selectors.push(`.internal-embed[alt$=".${ext}"]:not(.${processedClass})`);
			selectors.push(`.internal-embed[alt$=".${ext.toUpperCase()}"]:not(.${processedClass})`);
			
			// cm-embed-block 包裹的嵌入元素
			selectors.push(`.cm-embed-block .internal-embed[src$=".${ext}"]:not(.${processedClass})`);
			selectors.push(`.cm-embed-block .internal-embed[alt$=".${ext}"]:not(.${processedClass})`);
		}

		return selectors.join(', ');
	}

	// ==================== 文件变化刷新相关方法 ====================

	/**
	 * 刷新指定视图中引用某文件的所有嵌入元素
	 * @param view - Markdown 视图
	 * @param modifiedFilePath - 被修改的文件路径
	 * @param sourcePath - 当前视图的文件路径
	 * @returns 是否成功刷新了至少一个元素
	 */
	async refreshEmbedsInView(view: MarkdownView, modifiedFilePath: string, sourcePath: string): Promise<boolean> {
		let refreshedCount = 0;
		
		try {
			// 获取修改文件的文件名
			const modifiedFile = this.app.vault.getAbstractFileByPath(modifiedFilePath);
			if (!(modifiedFile instanceof TFile)) return false;
			
			const fileName = modifiedFile.name;
			const fileBaseName = modifiedFile.basename;
			
			// 在阅读模式容器中查找嵌入元素
			const previewContainer = view.previewMode?.containerEl;
			if (previewContainer) {
				const embeds = previewContainer.querySelectorAll('.internal-embed.code-link-processed');
				
				for (const embed of Array.from(embeds)) {
					const src = embed.getAttribute('src') || '';
					
					if (this.isEmbedMatchingFile(src, fileName, fileBaseName, modifiedFilePath, sourcePath)) {
						await this.processFile(src, embed as HTMLElement, sourcePath);
						refreshedCount++;
					}
				}
			}
			
			// 在编辑模式（Live Preview）容器中查找嵌入元素
			const contentEl = view.contentEl;
			if (contentEl) {
				const processedClass = this.getProcessedClassName();
				const embeds = contentEl.querySelectorAll(`.internal-embed.${processedClass}`);
				
				for (const embed of Array.from(embeds)) {
					const embedEl = embed as HTMLElement;
					const src = embedEl.getAttribute('src') || embedEl.getAttribute('alt') || '';
					
					if (this.isEmbedMatchingFile(src, fileName, fileBaseName, modifiedFilePath, sourcePath)) {
						await this.processFile(src, embedEl, sourcePath);
						refreshedCount++;
					}
				}
			}
		} catch (error) {
			console.error('[FileProcessor] Error refreshing embeds in view:', error);
			return false;
		}
		
		return refreshedCount > 0;
	}

	/**
	 * 检查嵌入元素的 src 是否匹配修改的文件
	 */
	protected isEmbedMatchingFile(
		src: string, 
		fileName: string, 
		fileBaseName: string, 
		modifiedFilePath: string,
		sourcePath: string
	): boolean {
		// 首先检查是否是该处理器支持的文件类型
		if (!this.isExtensionSupported(src)) {
			return false;
		}
		
		// 直接路径匹配
		if (src === modifiedFilePath || src === fileName || src === fileBaseName) {
			return true;
		}
		
		// 通过 metadataCache 解析链接
		const linkedFile = this.app.metadataCache.getFirstLinkpathDest(src, sourcePath);
		return linkedFile?.path === modifiedFilePath;
	}

	/**
	 * 更新设置
	 */
	abstract updateSettings(settings: any): void;
}
