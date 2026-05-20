import {
	App,
	Modal,
	Setting,
	Notice,
	MarkdownView,
	normalizePath,
} from "obsidian";
import {
	PluginSettings,
	EmbedLinkInfo,
	RemoteServiceType,
	RemoteServiceConfig,
} from "../types";
import { guessExtensionFromContent, extractFirstSymbolName } from "../utils/language";
import { uploadToRemote } from "../remote/remote-manager";
import { SERVICE_LABELS } from "../utils/constants";
import { buildRemoteConfigFields, RemoteConfigState } from "./remote-config-fields";

export class FileModal extends Modal {
	private settings: PluginSettings;
	private fileContent: string = "";
	private fileExt: string = "txt";
	private customFileName: string = "";
	private generatedFileName: string = "";
	private userManuallySetExt: boolean = false;
	private dropdownEl?: HTMLSelectElement;

	// @ and # fields
	private symbolName: string = "";
	private highlightSpec: string = "";

	// Editable storage path
	private modalStoragePathType: "absolute" | "relative" | "remote";
	private modalAbsolutePath: string;
	private modalRelativePath: string;

	// Remote config
	private remoteServiceType: RemoteServiceType = "github";
	private remoteUrl: string = "";
	private remoteToken: string = "";
	private remoteUsername: string = "";
	private remoteRepo: string = "";
	private remoteBranch: string = "main";
	private remoteUploadPath: string = "";

	// Remote config UI containers (for show/hide)
	private remoteConfigEl?: HTMLElement;
	private pathInputEl?: HTMLElement;

	private onSubmit: (info: EmbedLinkInfo) => void;

	constructor(
		app: App,
		settings: PluginSettings,
		onSubmit: (info: EmbedLinkInfo) => void
	) {
		super(app);
		this.settings = settings;
		this.onSubmit = onSubmit;

		// Initialize from settings
		this.modalStoragePathType = settings.storagePathType;
		this.modalAbsolutePath = settings.absoluteStoragePath;
		this.modalRelativePath = settings.relativeStoragePath;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("file-modal");

		contentEl.createEl("h2", { text: "创建代码文件" });

		// 1. File extension dropdown
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
				this.dropdownEl = dropdown.selectEl;
				dropdown.onChange(async (value) => {
					this.fileExt = value;
					this.userManuallySetExt = true;
					await this.updateFileName();
				});
			});

		// 2. File name input
		new Setting(contentEl)
			.setName("文件名")
			.setDesc("留空则基于内容 MD5 自动生成")
			.addText((text) => {
				text.setPlaceholder("留空自动生成");
				text.inputEl.addClass("file-name-input");
				text.onChange((value) => {
					this.customFileName = value.trim();
					void this.updateFileName();
				});
			});

		// 3. Storage path type dropdown
		const configuredServices = Object.keys(
			this.settings.remoteServices
		) as RemoteServiceType[];
		const hasRemoteServices = configuredServices.length > 0;

		new Setting(contentEl)
			.setName("存储路径类型")
			.setDesc("选择文件存储方式")
			.addDropdown((dropdown) => {
				dropdown.addOption("absolute", "根目录");
				dropdown.addOption("relative", "相对路径");
				if (hasRemoteServices) {
					dropdown.addOption("remote", "远程上传");
				}
				if (
					this.modalStoragePathType === "remote" &&
					!hasRemoteServices
				) {
					this.modalStoragePathType = "absolute";
				}
				dropdown.setValue(this.modalStoragePathType);
				dropdown.onChange((value) => {
					this.modalStoragePathType = value as
						| "absolute"
						| "relative"
						| "remote";
					this.toggleStorageSections();
				});
			});

		// 4. Local path input (absolute or relative)
		this.pathInputEl = contentEl.createDiv({ cls: "storage-path-section" });

		new Setting(this.pathInputEl)
			.setName("根目录存储路径")
			.setDesc("相对于 Vault 根目录的路径")
			.addText((text) => {
				text.setPlaceholder("assets/code");
				text.setValue(this.modalAbsolutePath);
				text.onChange((value) => {
					this.modalAbsolutePath = value.trim();
				});
			});

		const relativePathSetting = new Setting(this.pathInputEl)
			.setName("相对存储路径")
			.setDesc("相对于当前文档的路径（./ 或 ../shared）")
			.addText((text) => {
				text.setPlaceholder("./");
				text.setValue(this.modalRelativePath);
				text.onChange((value) => {
					this.modalRelativePath = value.trim();
				});
			});

		const absoluteRow = this.pathInputEl.querySelector(
			".setting-item:nth-child(1)"
		) as HTMLElement;
		const relativeRow = this.pathInputEl.querySelector(
			".setting-item:nth-child(2)"
		) as HTMLElement;

		// 5. Remote config section
		this.remoteConfigEl = contentEl.createDiv({
			cls: "remote-config-section",
		});

		new Setting(this.remoteConfigEl)
			.setName("远程服务类型")
			.addDropdown((dropdown) => {
				for (const svc of configuredServices) {
					dropdown.addOption(svc, SERVICE_LABELS[svc]);
				}
				if (!configuredServices.includes(this.remoteServiceType)) {
					this.remoteServiceType =
						configuredServices[0] || "github";
				}
				dropdown.setValue(this.remoteServiceType);
				dropdown.onChange((value) => {
					this.remoteServiceType = value as RemoteServiceType;
					this.rebuildRemoteConfig();
				});
			});

		const remoteFieldsEl = this.remoteConfigEl.createDiv({
			cls: "remote-fields-container",
		});

		// 6. @ symbol input
		new Setting(contentEl)
			.setName("符号 (@)")
			.setDesc("提取指定函数/类/方法，或行范围如 10-30")
			.addText((text) => {
				text.setPlaceholder("函数名 或 10-30");
				text.onChange((value) => {
					this.symbolName = value.trim();
				});
			});

		// 7. # highlight input
		new Setting(contentEl)
			.setName("高亮 (#)")
			.setDesc("高亮指定行，如 L5-L10")
			.addText((text) => {
				text.setPlaceholder("L5-L10");
				text.onChange((value) => {
					this.highlightSpec = value.trim();
				});
			});

		// 8. File content textarea
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

		textarea.addEventListener("input", () => {
			this.fileContent = textarea.value;
			if (!this.userManuallySetExt) {
				this.guessAndSetExtension();
			}
			void this.updateFileName();
		});

		// 9. Buttons
		const buttonContainer = contentEl.createEl("div", {
			cls: "modal-button-container",
		});

		const cancelBtn = buttonContainer.createEl("button", { text: "取消" });
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		const confirmBtn = buttonContainer.createEl("button", {
			text: "创建文件",
			cls: "mod-cta",
		});
		confirmBtn.addEventListener("click", () => {
			void this.handleSubmit();
		});

		// Setup visibility based on initial state
		const setVisibility = () => {
			const isRemote = this.modalStoragePathType === "remote";
			const isAbsolute = this.modalStoragePathType === "absolute";

			if (this.pathInputEl) {
				this.pathInputEl.style.display = isRemote ? "none" : "block";
			}
			if (absoluteRow) {
				absoluteRow.style.display = isAbsolute && !isRemote ? "" : "none";
			}
			if (relativeRow) {
				relativeRow.style.display =
					!isAbsolute && !isRemote ? "" : "none";
			}
			if (this.remoteConfigEl) {
				this.remoteConfigEl.style.display = isRemote ? "block" : "none";
			}
		};

		this.toggleStorageSections = () => setVisibility();
		setVisibility();

		// Build initial remote fields
		this.rebuildRemoteConfig(remoteFieldsEl);

		// Clipboard auto-fill
		try {
			const clipText = await navigator.clipboard.readText();
			if (clipText.trim()) {
				textarea.value = clipText;
				this.fileContent = clipText;
				this.guessAndSetExtension();
				void this.updateFileName();
			}
		} catch {
			// 剪贴板读取失败，静默跳过
		}
	}

	private toggleStorageSections(): void {
		// Overridden in onOpen with closure over local DOM elements
	}

	private rebuildRemoteConfig(container?: HTMLElement): void {
		const target =
			container ||
			this.remoteConfigEl?.querySelector(
				".remote-fields-container"
			) as HTMLElement;
		if (!target) return;

		const svc = this.remoteServiceType;
		const savedConfig = this.settings.remoteServices[svc];
		if (savedConfig) {
			if (!this.remoteUrl) this.remoteUrl = savedConfig.url || "";
			if (!this.remoteUsername) this.remoteUsername = savedConfig.username || "";
			if (!this.remoteRepo) this.remoteRepo = savedConfig.repo || "";
			if (!this.remoteBranch || this.remoteBranch === "main") this.remoteBranch = savedConfig.branch || "main";
			if (!this.remoteUploadPath) this.remoteUploadPath = savedConfig.uploadPath || "";
		}

		target.empty();

		const state: RemoteConfigState = {
			url: this.remoteUrl,
			token: this.remoteToken,
			username: this.remoteUsername,
			repo: this.remoteRepo,
			branch: this.remoteBranch,
			uploadPath: this.remoteUploadPath,
		};

		buildRemoteConfigFields(target, svc, state, (key, value) => {
			switch (key) {
				case "url": this.remoteUrl = value; break;
				case "token": this.remoteToken = value; break;
				case "username": this.remoteUsername = value; break;
				case "repo": this.remoteRepo = value; break;
				case "branch": this.remoteBranch = value; break;
				case "uploadPath": this.remoteUploadPath = value; break;
			}
		});
	}

	private guessAndSetExtension(): void {
		const guessed = guessExtensionFromContent(this.fileContent);
		if (guessed && this.dropdownEl) {
			const options = Array.from(this.dropdownEl.options).map(
				(o) => o.value
			);
			if (options.includes(guessed)) {
				this.dropdownEl.value = guessed;
				this.fileExt = guessed;
			}
		}
	}

	/**
	 * 计算文件内容的 SHA-256 哈希值，返回 16 位十六进制字符串。
	 */
	private async computeFileHash(content: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(content);
		const hashBuffer = await crypto.subtle.digest("SHA-256", data);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray
			.slice(0, 16)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	/**
	 * 根据策略生成文件名。
	 * - "hash": SHA-256 前 8 位
	 * - "content"（或 "custom"）: 直接使用用户输入的名称
	 * - "auto" / 其他回退: 提取第一个符号名并转换为 kebab-case，再回退到时间戳
	 */
	private async generateFileName(
		content: string,
		extension: string,
		strategy: string,
		customName: string
	): Promise<string> {
		if (strategy === "hash") {
			const hash = await this.computeFileHash(content);
			return `${hash.substring(0, 8)}.${extension}`;
		}
		if ((strategy === "content" || strategy === "custom") && customName.trim()) {
			return customName.trim().endsWith(`.${extension}`)
				? customName.trim()
				: `${customName.trim()}.${extension}`;
		}
		// "auto" 模式（或 custom 策略但名称为空）
		const symbolName = extractFirstSymbolName(content, extension);
		if (symbolName) {
			// 转换为 kebab-case: UserService -> user-service, getUserData -> get-user-data
			const kebab = symbolName
				.replace(/([a-z])([A-Z])/g, "$1-$2")
				.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
				.replace(/[_]+/g, "-")
				.toLowerCase();
			return `${kebab}.${extension}`;
		}
		// 回退：时间戳名称
		const now = new Date();
		const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
		return `code-${ts}.${extension}`;
	}

	private async updateFileName() {
		if (!this.fileContent.trim()) {
			this.generatedFileName = "";
			return;
		}
		this.generatedFileName = await this.generateFileName(
			this.fileContent,
			this.fileExt,
			this.settings.fileNameStrategy,
			this.customFileName
		);
	}

	private getFullStoragePath(): string {
		if (this.modalStoragePathType === "absolute") {
			return this.modalAbsolutePath;
		} else {
			const activeView =
				this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView?.file) {
				const currentDir = activeView.file.parent?.path || "";
				const relativePath = this.modalRelativePath;

				if (relativePath === "./" || relativePath === ".") {
					return currentDir;
				}

				if (relativePath.startsWith("./")) {
					return normalizePath(
						`${currentDir}/${relativePath.slice(2)}`
					);
				} else if (relativePath.startsWith("../")) {
					const parts = currentDir.split("/");
					const relParts = relativePath.split("/");
					while (relParts[0] === "..") {
						parts.pop();
						relParts.shift();
					}
					return normalizePath([...parts, ...relParts].join("/"));
				}
				return normalizePath(`${currentDir}/${relativePath}`);
			}
			return this.modalRelativePath;
		}
	}

	private getLinkPath(fullPath: string): string {
		let base: string;
		if (this.modalStoragePathType === "relative") {
			const relativePath = this.modalRelativePath;
			if (relativePath === "./" || relativePath === ".") {
				base = this.generatedFileName;
			} else {
				let linkPath = relativePath;
				if (linkPath.startsWith("./")) {
					linkPath = linkPath.slice(2);
				}
				base = `${linkPath}/${this.generatedFileName}`;
			}
		} else {
			base = fullPath;
		}

		const parts: string[] = [base];
		if (this.symbolName) parts.push(`@${this.symbolName}`);
		if (this.highlightSpec) parts.push(`#${this.highlightSpec}`);
		return parts.join("");
	}

	private getDisplayName(): string {
		if (this.customFileName) {
			return this.customFileName;
		}
		const name = this.generatedFileName.replace(/\.[^.]+$/, "");
		return name;
	}

	private getRemoteConfig(): RemoteServiceConfig {
		return {
			url: this.remoteUrl,
			token: this.remoteToken,
			username: this.remoteUsername || undefined,
			repo: this.remoteRepo || undefined,
			branch: this.remoteBranch || "main",
			uploadPath: this.remoteUploadPath || undefined,
		};
	}

	private async handleSubmit() {
		if (!this.fileContent.trim()) {
			new Notice("请输入文件内容");
			return;
		}

		if (!this.generatedFileName) {
			await this.updateFileName();
		}

		// Remote upload branch
		if (this.modalStoragePathType === "remote") {
			if (!this.remoteUrl.trim() || !this.remoteToken.trim()) {
				new Notice("请填写远程服务的 URL 和 Token");
				return;
			}

			const confirmBtn = this.contentEl.querySelector(
				".mod-cta"
			) as HTMLButtonElement;
			if (confirmBtn) {
				confirmBtn.disabled = true;
				confirmBtn.textContent = "上传中...";
			}

			try {
				const config = this.getRemoteConfig();
				const result = await uploadToRemote(
					this.remoteServiceType,
					this.fileContent,
					this.generatedFileName,
					config,
					this.settings.remoteSkipSslVerify
				);

				if (!result.success || !result.url) {
					new Notice(result.error || "远程上传失败");
					if (confirmBtn) {
						confirmBtn.disabled = false;
						confirmBtn.textContent = "创建文件";
					}
					return;
				}

				// 内联 buildRemoteLinkPath：拼接 URL + @symbolName + #highlightSpec
				const remoteParts: string[] = [result.url];
				if (this.symbolName) remoteParts.push(`@${this.symbolName}`);
				if (this.highlightSpec) remoteParts.push(`#${this.highlightSpec}`);
				const remoteLinkPath = remoteParts.join("");

				const info: EmbedLinkInfo = {
					linkPath: remoteLinkPath,
					displayName: this.getDisplayName(),
					content: this.fileContent,
					isRemote: true,
					extension: this.fileExt,
					symbolName: this.symbolName,
					highlightSpec: this.highlightSpec,
					storagePathType: "remote",
					storagePath: result.url,
				};
				this.onSubmit(info);
				this.close();
			} catch (err) {
				const message =
					err instanceof Error ? err.message : String(err);
				new Notice(`远程上传失败: ${message}`);
				if (confirmBtn) {
					confirmBtn.disabled = false;
					confirmBtn.textContent = "创建文件";
				}
			}
			return;
		}

		// Local file branch
		const storagePath = this.getFullStoragePath();
		const fullPath = normalizePath(
			`${storagePath}/${this.generatedFileName}`
		);

		try {
			const folderPath = storagePath;
			if (
				folderPath &&
				!(await this.app.vault.adapter.exists(folderPath))
			) {
				await this.app.vault.createFolder(folderPath);
			}

			if (await this.app.vault.adapter.exists(fullPath)) {
				new Notice(`文件已存在: ${fullPath}`);
			} else {
				await this.app.vault.create(fullPath, this.fileContent);
				new Notice(`文件已创建: ${fullPath}`);
			}

			const linkPath = this.getLinkPath(fullPath);
			const info: EmbedLinkInfo = {
				linkPath,
				displayName: this.getDisplayName(),
				content: this.fileContent,
				isRemote: false,
				extension: this.fileExt,
				symbolName: this.symbolName,
				highlightSpec: this.highlightSpec,
				storagePathType: this.modalStoragePathType,
				storagePath: storagePath,
			};
			this.onSubmit(info);
			this.close();
		} catch (error: unknown) {
			const message =
				error instanceof Error ? error.message : String(error);
			new Notice(`创建文件失败: ${message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
