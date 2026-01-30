import {
	App,
	Modal,
	Setting,
	Notice,
	MarkdownView,
	normalizePath,
} from "obsidian";
import { PluginSettings } from "./settings";

/**
 * 计算字符串的 MD5 哈希值
 */
async function md5(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	// 取前16个字节作为简短哈希
	return hashArray
		.slice(0, 16)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

export class FileModal extends Modal {
	private settings: PluginSettings;
	private fileContent: string = "";
	private fileExt: string = "txt";
	private customFileName: string = ""; // 用户自定义文件名（不含扩展名）
	private generatedFileName: string = "";
	private fileNameInput: HTMLInputElement;
	private onSubmit: (filePath: string, content: string) => void;

	constructor(
		app: App,
		settings: PluginSettings,
		onSubmit: (filePath: string, content: string) => void
	) {
		super(app);
		this.settings = settings;
		this.onSubmit = onSubmit;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("file-modal");

		// 标题
		contentEl.createEl("h2", { text: "创建代码文件" });

		// 文件扩展名选择
		new Setting(contentEl)
			.setName("文件扩展名")
			.setDesc("选择文件的扩展名")
			.addDropdown((dropdown) => {
				const extensions = this.settings.codeFileExtensions
					.split(",")
					.map((ext) => ext.trim());
				extensions.forEach((ext) => {
					dropdown.addOption(ext, `.${ext}`);
				});
				dropdown.setValue(this.fileExt);
				dropdown.onChange(async (value) => {
					this.fileExt = value;
					await this.updateFileName();
				});
			});

		// 文件名输入（可编辑，空则自动生成MD5）
		new Setting(contentEl)
			.setName("文件名")
			.setDesc("留空则基于内容 MD5 自动生成")
			.addText((text) => {
				this.fileNameInput = text.inputEl;
				text.setPlaceholder("留空自动生成");
				text.inputEl.style.width = "300px";
				text.onChange((value) => {
					this.customFileName = value.trim();
					this.updateFileNameDisplay();
				});
			});

		// 存储路径显示
		const pathInfo = this.getStoragePathInfo();
		new Setting(contentEl).setName("存储路径").setDesc(pathInfo);

		// 文件内容输入
		const contentLabel = contentEl.createEl("div", { cls: "setting-item" });
		contentLabel
			.createEl("div", { cls: "setting-item-info" })
			.createEl("div", { cls: "setting-item-name", text: "文件内容" });

		const textareaContainer = contentEl.createEl("div", {
			cls: "file-content-container",
		});
		const textarea = textareaContainer.createEl("textarea", {
			cls: "file-content-input",
			attr: {
				placeholder: "在此输入文件内容...",
				rows: "10",
			},
		});
		textarea.style.width = "100%";
		textarea.style.minHeight = "200px";
		textarea.style.fontFamily = "monospace";
		textarea.style.resize = "vertical";

		textarea.addEventListener("input", async () => {
			this.fileContent = textarea.value;
			await this.updateFileNameFromContent();
		});

		// 按钮容器
		const buttonContainer = contentEl.createEl("div", {
			cls: "modal-button-container",
		});
		buttonContainer.style.display = "flex";
		buttonContainer.style.justifyContent = "flex-end";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.marginTop = "20px";

		// 取消按钮
		const cancelBtn = buttonContainer.createEl("button", { text: "取消" });
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		// 确认按钮
		const confirmBtn = buttonContainer.createEl("button", {
			text: "创建文件",
			cls: "mod-cta",
		});
		confirmBtn.addEventListener("click", async () => {
			await this.handleSubmit();
		});
	}

	// 根据内容更新 MD5 文件名（仅在用户未输入自定义名称时生效）
	private async updateFileNameFromContent() {
		if (!this.customFileName && this.fileContent.trim()) {
			const hash = await md5(this.fileContent);
			this.generatedFileName = `${hash}.${this.fileExt}`;
		}
		this.updateFileNameDisplay();
	}

	// 更新显示的文件名
	private updateFileNameDisplay() {
		if (this.customFileName) {
			// 用户输入了自定义文件名
			this.generatedFileName = `${this.customFileName}.${this.fileExt}`;
		}
	}

	// 扩展名变化时更新文件名
	private async updateFileName() {
		if (this.customFileName) {
			this.generatedFileName = `${this.customFileName}.${this.fileExt}`;
		} else if (this.fileContent.trim()) {
			const hash = await md5(this.fileContent);
			this.generatedFileName = `${hash}.${this.fileExt}`;
		} else {
			this.generatedFileName = "";
		}
	}

	private getStoragePathInfo(): string {
		if (this.settings.storagePathType === "absolute") {
			return `根目录位置: ${this.settings.absoluteStoragePath}`;
		} else {
			return `相对位置: ${this.settings.relativeStoragePath}`;
		}
	}

	private getFullStoragePath(): string {
		if (this.settings.storagePathType === "absolute") {
			return this.settings.absoluteStoragePath;
		} else {
			// 获取当前文档路径
			const activeView =
				this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView?.file) {
				const currentDir = activeView.file.parent?.path || "";
				const relativePath = this.settings.relativeStoragePath;

				if (relativePath === "./" || relativePath === ".") {
					return currentDir;
				}

				// 处理相对路径
				if (relativePath.startsWith("./")) {
					return normalizePath(
						`${currentDir}/${relativePath.slice(2)}`
					);
				} else if (relativePath.startsWith("../")) {
					const parts = currentDir.split("/");
					let relParts = relativePath.split("/");
					while (relParts[0] === "..") {
						parts.pop();
						relParts.shift();
					}
					return normalizePath([...parts, ...relParts].join("/"));
				}
				return normalizePath(`${currentDir}/${relativePath}`);
			}
			return this.settings.relativeStoragePath;
		}
	}

	// 获取用于链接的路径（相对模式返回相对路径，绝对模式返回完整路径），证明目前无法自动处理末尾存在/的情况
	private getLinkPath(fullPath: string): string {
		if (this.settings.storagePathType === "relative") {
			// 相对模式：返回相对于当前文档的路径
			const relativePath = this.settings.relativeStoragePath;
			if (relativePath === "./" || relativePath === ".") {
				return this.generatedFileName;
			}
			let linkPath = relativePath;
			if (linkPath.startsWith("./")) {
				linkPath = linkPath.slice(2);
			}
			return `${linkPath}/${this.generatedFileName}`;
		}
		// 绝对模式：返回完整路径
		return fullPath;
	}

	private async handleSubmit() {
		if (!this.fileContent.trim()) {
			new Notice("请输入文件内容");
			return;
		}

		if (!this.generatedFileName) {
			await this.updateFileName();
		}

		const storagePath = this.getFullStoragePath();
		const fullPath = normalizePath(
			`${storagePath}/${this.generatedFileName}`
		);

		try {
			// 确保目录存在
			const folderPath = storagePath;
			if (
				folderPath &&
				!(await this.app.vault.adapter.exists(folderPath))
			) {
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

			// 获取用于链接的路径
			const linkPath = this.getLinkPath(fullPath);
			this.onSubmit(linkPath, this.fileContent);
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
