import { App, TFile } from "obsidian";

export abstract class FileProcessor {
	app: App;
	settings: any;

	/*
	 * 构造函数
	 * app: Obsidian 应用实例
	 * settings: 插件设置
	 */
	constructor(app: App, settings: any) {
		this.app = app;
		this.settings = settings;
	}

	/**
	 * 抽象渲染方法：负责将处理后的数据渲染到 DOM 元素中
	 * data: 处理后的数据
	 * targetElement: 目标 DOM 元素，渲染完成后会被新容器替换
	 * filePath: 文件路径
	 * sourcePath: 源文件路径
	 */
	abstract render(
		data: any,
		targetElement: HTMLElement,
		filePath: string,
		sourcePath: string
	): Promise<HTMLElement>;

	/**
	 * 抽象内容处理方法：负责对文件原始字符串进行初步处理
	 * content: 文件原始字符串
	 */
	abstract processContent(content: string): any;

	/**
	 * 异步读取文件内容
	 * filePath: 文件路径
	 * sourcePath: 源文件路径
	 */
	async readFile(
		filePath: string,
		sourcePath: string
	): Promise<string | null> {
		const file = this.app.metadataCache.getFirstLinkpathDest(
			filePath,
			sourcePath
		);
		if (file instanceof TFile) {
			return await this.app.vault.read(file);
		}
		return null;
	}

	/**
	 * 通用的文件处理流程：显示加载中 -> 读取文件 -> 处理内容 -> 渲染
	 * filePath: 文件路径
	 * targetElement: 目标 DOM 元素，渲染完成后会被新容器替换
	 * sourcePath: 源文件路径
	 * 返回值表示是否成功处理文件
	 */
	async processFile(
		filePath: string,
		targetElement: HTMLElement,
		sourcePath: string
	): Promise<boolean> {
		try {
			// 0. 阻止 Obsidian 默认嵌入处理
			targetElement.setAttribute("data-code-link-handled", "true");
			targetElement.style.display = "block";

			// 1. 显示加载状态
			targetElement.empty();
			targetElement.createDiv({
				cls: "code-link-loading",
				text: "Loading...",
			});

			const content = await this.readFile(filePath, sourcePath);

			if (content !== null) {
				const processedData = this.processContent(content);

				// 2. 清空并在目标容器内渲染（不使用 replaceWith，避免破坏 CodeMirror DOM 管理）
				targetElement.empty();
				const result = await this.render(
					processedData,
					targetElement,
					filePath,
					sourcePath
				);
				if (result) {
					// 从渲染的结果当中添加阻止事件冒泡
					result.addEventListener("click", (e: MouseEvent) => {
						const target = e.target as HTMLElement;

						// 如果点击的是按钮或按钮内部元素，直接返回，让按钮自己处理
						if (target.closest("button")) {
							e.stopPropagation();
							return;
						}

						// 否则阻止 .internal-embed 的默认跳转
						e.preventDefault();
						e.stopPropagation();
					});

					targetElement.appendChild(result);

					return true;
				}
			} else {
			}
			return false;
		} catch (error) {
			return false;
		}
	}
}
