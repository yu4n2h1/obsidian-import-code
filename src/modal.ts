import { App, Modal, Setting, Notice, MarkdownView, normalizePath } from 'obsidian';
import { PluginSettings } from './settings';

/**
 * 计算字符串的 MD5 哈希值
 */
async function md5(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	// 取前16个字节作为简短哈希
	return hashArray.slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class FileModal extends Modal {
	private settings: PluginSettings;
	private fileContent: string = '';
	private fileExt: string = 'txt';
	private generatedFileName: string = '';
	private fileNameDisplay: HTMLInputElement;
	private onSubmit: (filePath: string, content: string) => void;

	constructor(app: App, settings: PluginSettings, onSubmit: (filePath: string, content: string) => void) {
		super(app);
		this.settings = settings;
		this.onSubmit = onSubmit;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('file-modal');

		// 标题
		contentEl.createEl('h2', { text: '创建代码文件' });

		// 文件扩展名选择
		new Setting(contentEl)
			.setName('文件扩展名')
			.setDesc('选择文件的扩展名')
			.addDropdown((dropdown) => {
				const extensions = this.settings.codeFileExtensions.split(',').map(ext => ext.trim());
				extensions.forEach(ext => {
					dropdown.addOption(ext, `.${ext}`);
				});
				dropdown.setValue(this.fileExt);
				dropdown.onChange(async (value) => {
					this.fileExt = value;
					await this.updateFileName();
				});
			});

		// 文件名显示（只读）
		new Setting(contentEl)
			.setName('生成的文件名')
			.setDesc('基于文件内容 MD5 自动生成')
			.addText((text) => {
				this.fileNameDisplay = text.inputEl;
				text.setDisabled(true);
				text.setPlaceholder('输入内容后自动生成');
				text.inputEl.style.width = '300px';
			});

		// 存储路径显示
		const pathInfo = this.getStoragePathInfo();
		new Setting(contentEl)
			.setName('存储路径')
			.setDesc(pathInfo);

		// 文件内容输入
		const contentLabel = contentEl.createEl('div', { cls: 'setting-item' });
		contentLabel.createEl('div', { cls: 'setting-item-info' })
			.createEl('div', { cls: 'setting-item-name', text: '文件内容' });
		
		const textareaContainer = contentEl.createEl('div', { cls: 'file-content-container' });
		const textarea = textareaContainer.createEl('textarea', {
			cls: 'file-content-input',
			attr: {
				placeholder: '在此输入文件内容...',
				rows: '10'
			}
		});
		textarea.style.width = '100%';
		textarea.style.minHeight = '200px';
		textarea.style.fontFamily = 'monospace';
		textarea.style.resize = 'vertical';

		textarea.addEventListener('input', async () => {
			this.fileContent = textarea.value;
			await this.updateFileName();
		});

		// 按钮容器
		const buttonContainer = contentEl.createEl('div', { cls: 'modal-button-container' });
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';

		// 取消按钮
		const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
		cancelBtn.addEventListener('click', () => {
			this.close();
		});

		// 确认按钮
		const confirmBtn = buttonContainer.createEl('button', { text: '创建文件', cls: 'mod-cta' });
		confirmBtn.addEventListener('click', async () => {
			await this.handleSubmit();
		});
	}

	private async updateFileName() {
		if (this.fileContent.trim()) {
			const hash = await md5(this.fileContent);
			this.generatedFileName = `${hash}.${this.fileExt}`;
		} else {
			this.generatedFileName = '';
		}
		if (this.fileNameDisplay) {
			this.fileNameDisplay.value = this.generatedFileName;
		}
	}

	private getStoragePathInfo(): string {
		if (this.settings.storagePathType === 'absolute') {
			return `根目录位置: ${this.settings.absoluteStoragePath}`;
		} else {
			return `相对位置: ${this.settings.relativeStoragePath}`;
		}
	}

	private getFullStoragePath(): string {
		if (this.settings.storagePathType === 'absolute') {
			return this.settings.absoluteStoragePath;
		} else {
			// 获取当前文档路径
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView?.file) {
				const currentDir = activeView.file.parent?.path || '';
				const relativePath = this.settings.relativeStoragePath;
				
				if (relativePath === './' || relativePath === '.') {
					return currentDir;
				}
				
				// 处理相对路径
				if (relativePath.startsWith('./')) {
					return normalizePath(`${currentDir}/${relativePath.slice(2)}`);
				} else if (relativePath.startsWith('../')) {
					const parts = currentDir.split('/');
					let relParts = relativePath.split('/');
					while (relParts[0] === '..') {
						parts.pop();
						relParts.shift();
					}
					return normalizePath([...parts, ...relParts].join('/'));
				}
				return normalizePath(`${currentDir}/${relativePath}`);
			}
			return this.settings.relativeStoragePath;
		}
	}

	private async handleSubmit() {
		if (!this.fileContent.trim()) {
			new Notice('请输入文件内容');
			return;
		}

		if (!this.generatedFileName) {
			await this.updateFileName();
		}

		const storagePath = this.getFullStoragePath();
		const fullPath = normalizePath(`${storagePath}/${this.generatedFileName}`);

		try {
			// 确保目录存在
			const folderPath = storagePath;
			if (folderPath && !await this.app.vault.adapter.exists(folderPath)) {
				await this.app.vault.createFolder(folderPath);
			}

			// 检查文件是否已存在
			if (await this.app.vault.adapter.exists(fullPath)) {
				new Notice(`文件已存在: ${fullPath}`);
			} else {
				// 创建文件
				await this.app.vault.create(fullPath, this.fileContent);
				new Notice(`文件已创建: ${fullPath}`);
			}

			this.onSubmit(fullPath, this.fileContent);
			this.close();
		} catch (error) {
			new Notice(`创建文件失败: ${error}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
