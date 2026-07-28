import {
	App,
	Modal,
	Setting,
	Notice,
	MarkdownView,
	normalizePath,
} from "obsidian";
import type { PluginSettings, EmbedLinkInfo, RemoteServiceConfig } from "../../types";
import { guessExtensionFromContent, extractFirstSymbolName } from "../../utils/language";
import { getSupportedExtensions } from "../../utils/helpers";
import { createUploadServices, uploadToService } from "../../upload";
import type { UploadServiceType } from "../../upload";

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
	private modalStoragePathType: "absolute" | "relative";
	private modalAbsolutePath: string;
	private modalRelativePath: string;

	// Path UI
	private pathInputEl?: HTMLElement;
	private absoluteRowEl: HTMLElement | null = null;
	private relativeRowEl: HTMLElement | null = null;
	private storagePathSectionEl?: HTMLElement;
	private uploadTargetEl?: HTMLElement;
	private gistTokenEl?: HTMLElement;

	// Upload target
	private selectedServiceType: UploadServiceType = "local";
	private selectedServiceConfig: Partial<RemoteServiceConfig> = {};
	// 回退模式下用户输入的 gist token（独立持久，避免切换服务类型再切回 gist 时丢失——
	// selectedServiceConfig 在切换时会被重置，而该 token 是 UI 持久态，不可与提交配置混为一谈）
	private fallbackGistToken: string = "";
	// 是否在生成的 wiki 链接中带别名（![[path|alias]] vs ![[path]]）
	private useAlias: boolean = true;

	// Upload source alias selection (from settings)
	private selectedUploadSourceAlias: string = "";
	private summaryEl?: HTMLElement;

	private onSubmit: (info: EmbedLinkInfo) => void;

	constructor(
		app: App,
		settings: PluginSettings,
		onSubmit: (info: EmbedLinkInfo) => void
	) {
		super(app);
		this.settings = settings;
		this.onSubmit = onSubmit;

		// Initialize editable storage path with built-in defaults (used only by the
		// backward-compat path UI when no upload source is configured).
		this.modalStoragePathType = "absolute";
		this.modalAbsolutePath = "assets";
		this.modalRelativePath = "./";

		// Pre-select first upload source alias if configured
		const firstAlias = Object.keys(settings.uploadSources)[0];
		if (firstAlias) {
			this.selectedUploadSourceAlias = firstAlias;
			this.applyUploadSourceConfig(firstAlias);
		}
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("code-import-file-modal");

		contentEl.createEl("h2", { text: "Create code file" });

		// 0. Upload source selection
		const hasUploadSources =
			Object.keys(this.settings.uploadSources).length > 0;

		if (hasUploadSources) {
			// === 新模式：从设置中的上传源别名选择 ===
			new Setting(contentEl)
				.setName("Upload source")
				.setDesc("Select a configured upload destination")
				.addDropdown((dropdown) => {
					for (const [alias, entry] of Object.entries(
						this.settings.uploadSources
					)) {
						const typeLabel =
							entry.uploadType === "local"
								? "Local"
								: entry.uploadType === "webdav"
									? "WebDAV"
									: "GitHub Gist";
						dropdown.addOption(
							alias,
							`${alias} (${typeLabel})`
						);
					}
					dropdown.setValue(this.selectedUploadSourceAlias);
					dropdown.onChange((value) => {
						this.selectedUploadSourceAlias = value;
						this.applyUploadSourceConfig(value);
						this.toggleUploadSections();
						this.refreshSourceSummary();
					});
				});

			// 摘要信息行
			this.summaryEl = contentEl.createDiv({
				cls: "upload-source-summary",
			});
			this.refreshSourceSummary();
		} else {
			// === 回退模式：手动配置上传目标 ===
			this.uploadTargetEl = contentEl.createDiv({
				cls: "upload-target-section",
			});

			new Setting(this.uploadTargetEl)
				.setName("Upload destination")
				.setDesc("Choose where to save the file")
				.addDropdown((dropdown) => {
					dropdown.addOption("local", "Local (Obsidian vault)");
					dropdown.addOption("github-gist", "GitHub Gist");

					if (this.settings.remoteSources) {
						for (const [alias, entry] of Object.entries(
							this.settings.remoteSources
						)) {
							if (entry.serviceType === "webdav") {
								dropdown.addOption(
									`webdav:${alias}`,
									`WebDAV (${alias})`
								);
							}
						}
					}

					dropdown.setValue(this.selectedServiceType);
					dropdown.onChange((value) => {
						if (value.startsWith("webdav:")) {
							const alias = value.slice(7);
							this.selectedServiceType = "webdav";
							const entry =
								this.settings.remoteSources[alias];
							this.selectedServiceConfig =
								entry?.config ?? {};
						} else if (value === "github-gist") {
							this.selectedServiceType = "github-gist";
							// 从持久态恢复已输入的 token，避免切换服务类型再切回 gist 时丢失
							this.selectedServiceConfig = {
								token: this.fallbackGistToken,
							};
						} else {
							this.selectedServiceType = "local";
							this.selectedServiceConfig = {};
						}
						this.toggleUploadSections();
					});
				});

			// Gist token input (only shown for github-gist)
			this.gistTokenEl = contentEl.createDiv({
				cls: "gist-token-section",
			});
			new Setting(this.gistTokenEl)
				.setName("GitHub token")
				.setDesc("Personal access token for GitHub Gist API")
				.addText((text) => {
					text.setPlaceholder("ghp_xxxxxxxxxxxx");
					text.inputEl.type = "password";
					text.setValue(this.fallbackGistToken);
					text.onChange((value) => {
						this.fallbackGistToken = value.trim();
						this.selectedServiceConfig = {
							...this.selectedServiceConfig,
							token: value.trim(),
						};
					});
				});
		}

		// 1. File extension dropdown
		new Setting(contentEl)
			.setName("File extension")
			.setDesc("Select file extension")
			.addDropdown((dropdown) => {
				const extensions = getSupportedExtensions(this.settings);
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
			.setName("File name")
			.setDesc("Leave empty to auto-generate from content hash")
			.addText((text) => {
				text.setPlaceholder("Auto-generated if empty");
				text.inputEl.addClass("file-name-input");
				text.onChange((value) => {
					this.customFileName = value.trim();
					void this.updateFileName();
				});
			});

		// 3. Storage path controls (only in backward-compat / non-alias mode)
		if (!hasUploadSources) {
			new Setting(contentEl)
				.setName("Storage path type")
				.setDesc("Choose file storage method")
				.addDropdown((dropdown) => {
					dropdown.addOption("absolute", "Absolute (vault root)");
					dropdown.addOption("relative", "Relative (current note)");
					dropdown.setValue(this.modalStoragePathType);
					dropdown.onChange((value) => {
						this.modalStoragePathType = value as
							| "absolute"
							| "relative";
						this.toggleStorageSections();
					});
				});

			// 4. Local path input (absolute or relative)
			this.storagePathSectionEl = contentEl.createDiv({
				cls: "storage-path-wrapper",
			});
			this.pathInputEl = this.storagePathSectionEl.createDiv({
				cls: "storage-path-section",
			});

			new Setting(this.pathInputEl)
				.setName("Absolute storage path")
				.setDesc("Path relative to vault root")
				.addText((text) => {
					text.setPlaceholder("Assets/code");
					text.setValue(this.modalAbsolutePath);
					text.onChange((value) => {
						this.modalAbsolutePath = value.trim();
					});
				});

			new Setting(this.pathInputEl)
				.setName("Relative storage path")
				.setDesc("Path relative to current note (./ or ../shared)")
				.addText((text) => {
					text.setPlaceholder("./");
					text.setValue(this.modalRelativePath);
					text.onChange((value) => {
						this.modalRelativePath = value.trim();
					});
				});

			this.absoluteRowEl = this.pathInputEl.querySelector(
				".setting-item:nth-child(1)"
			) as HTMLElement;
			this.relativeRowEl = this.pathInputEl.querySelector(
				".setting-item:nth-child(2)"
			) as HTMLElement;
		}

		// 5. @ symbol input
		new Setting(contentEl)
			.setName("Symbol (@)")
			.setDesc("Extract specific function/class/method, or line range e.g. 10-30")
			.addText((text) => {
				text.setPlaceholder("functionName or 10-30");
				text.onChange((value) => {
					this.symbolName = value.trim();
				});
			});

		// 6. # highlight input
		new Setting(contentEl)
			.setName("Highlight (#)")
			.setDesc("Highlight specific lines, e.g. L5-L10")
			.addText((text) => {
				text.setPlaceholder("L5-L10");
				text.onChange((value) => {
					this.highlightSpec = value.trim();
				});
			});

		// 7. File content textarea
		const contentLabel = contentEl.createEl("div", { cls: "setting-item" });
		contentLabel
			.createEl("div", { cls: "setting-item-info" })
			.createEl("div", { cls: "setting-item-name", text: "File content" });

		const textareaContainer = contentEl.createEl("div", {
			cls: "file-content-container",
		});
		const textarea = textareaContainer.createEl("textarea", {
			cls: "file-content-input",
			attr: {
				placeholder: "Enter file content...",
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

		// 8. Buttons
		const buttonContainer = contentEl.createEl("div", {
			cls: "modal-button-container",
		});

		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		const confirmBtn = buttonContainer.createEl("button", {
			text: "Create file",
			cls: "mod-cta",
		});
		confirmBtn.addEventListener("click", () => {
			void this.handleSubmit();
		});

		// Setup visibility based on initial state
		this.applyVisibility();

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
			// Clipboard read failed, silently skip
		}
	}

	private toggleStorageSections(): void {
		// 别名模式下无需切换存储路径 UI；仅回退模式（无上传源）应用可见性
		if (this.summaryEl) return;
		this.applyVisibility();
	}

	private toggleUploadSections(): void {
		// 别名模式刷新摘要；回退模式切换可见性
		if (this.summaryEl) {
			this.refreshSourceSummary();
		} else {
			this.applyVisibility();
		}
	}

	/** 根据当前上传目标与存储路径类型，切换回退模式 UI 的可见性。 */
	private applyVisibility(): void {
		const isLocal = this.selectedServiceType === "local";
		const isAbsolute = this.modalStoragePathType === "absolute";

		// 上传目标相关的 UI（仅回退模式存在）
		if (this.storagePathSectionEl) {
			this.storagePathSectionEl.style.display = isLocal ? "" : "none";
		}
		if (this.gistTokenEl) {
			this.gistTokenEl.style.display =
				this.selectedServiceType === "github-gist" ? "" : "none";
		}

		// 存储路径类型相关的 UI（仅回退模式存在）
		if (isLocal && this.pathInputEl) {
			this.pathInputEl.setCssProps({ display: "block" });
		}
		if (this.absoluteRowEl) {
			this.absoluteRowEl.style.display =
				isLocal && isAbsolute ? "" : "none";
		}
		if (this.relativeRowEl) {
			this.relativeRowEl.style.display =
				isLocal && !isAbsolute ? "" : "none";
		}
	}

	/** 从 settings 中的上传源别名配置中提取上传参数 */
	private applyUploadSourceConfig(alias: string): void {
		const entry = this.settings.uploadSources[alias];
		if (!entry) return;

		const cfg = entry.config;

		// 设置上传类型
		this.selectedServiceType = entry.uploadType;

		// 读取别名展示开关
		this.useAlias = entry.useAlias ?? true;

		// 构建 RemoteServiceConfig
		if (entry.uploadType === "local") {
			this.selectedServiceConfig = {};
			this.modalStoragePathType = cfg.storagePathType ?? "absolute";
			if (cfg.storagePathType === "relative") {
				this.modalRelativePath = cfg.relativePath ?? "./";
			} else {
				this.modalAbsolutePath = cfg.absolutePath ?? "assets";
			}
		} else if (entry.uploadType === "webdav") {
			this.selectedServiceConfig = {
				url: cfg.url ?? "",
				token: cfg.token ?? "",
				username: cfg.username,
				path: cfg.pathPrefix,
				skipSslVerify: cfg.skipSslVerify,
			};
		} else if (entry.uploadType === "github-gist") {
			this.selectedServiceConfig = {
				url: cfg.apiUrl ?? "https://api.github.com",
				token: cfg.token ?? "",
				skipSslVerify: cfg.skipSslVerify,
			};
		}
	}

	/** 刷新上传源摘要信息（仅别名模式下 summaryEl 存在时生效）。 */
	private refreshSourceSummary(): void {
		if (!this.summaryEl) return;
		const entry =
			this.settings.uploadSources[this.selectedUploadSourceAlias];
		if (!entry) {
			this.summaryEl.setText("");
			return;
		}
		const cfg = entry.config;
		if (entry.uploadType === "local") {
			const pathType = cfg.storagePathType ?? "absolute";
			const path =
				pathType === "relative"
					? cfg.relativePath ?? "./"
					: cfg.absolutePath ?? "assets";
			this.summaryEl.setText(`Path: ${path} (${pathType})`);
		} else if (entry.uploadType === "webdav") {
			this.summaryEl.setText(`URL: ${cfg.url || "(not set)"}`);
		} else {
			this.summaryEl.setText(
				`API: ${cfg.apiUrl || "https://api.github.com"}`
			);
		}
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
	 * 计算内容的 SHA-256 摘要并返回前 16 字节（32 个十六进制字符）。
	 * 调用方通常再 `.substring(0, N)` 截到所需长度。
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

	private getDialectForExtension(extension: string): string {
		const entry = this.settings.codeFileExtensions.find(
			(e) => e.suffix.toLowerCase() === extension.toLowerCase(),
		);
		return entry?.dialect || extension;
	}

	private async generateFileName(
		content: string,
		extension: string,
		strategy: string,
		customName: string
	): Promise<string> {
		if (strategy === "hash") {
			const hash = await this.computeFileHash(content);
			// 16 个十六进制字符 = 64 bit：碰撞概率 ~50% @ 4×10⁹ 个文件，实际等价于永不碰撞。
			// 旧版为 8 位 (32 bit)，~65k 个文件即到 50%，容易撞。
			return `${hash.substring(0, 16)}.${extension}`;
		}
		if ((strategy === "content" || strategy === "custom") && customName.trim()) {
			return customName.trim().endsWith(`.${extension}`)
				? customName.trim()
				: `${customName.trim()}.${extension}`;
		}
		// "auto" mode (or custom strategy with empty name)
		const dialect = this.getDialectForExtension(extension);
			const symbolName = extractFirstSymbolName(content, dialect);
		if (symbolName) {
			const kebab = symbolName
				.replace(/([a-z])([A-Z])/g, "$1-$2")
				.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
				.replace(/[_]+/g, "-")
				.toLowerCase();
			return `${kebab}.${extension}`;
		}
		// Fallback: timestamp name
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

	private async handleSubmit() {
		if (!this.fileContent.trim()) {
			new Notice("Please enter file content");
			return;
		}

		if (!this.generatedFileName) {
			await this.updateFileName();
		}

		const storagePath = this.getFullStoragePath();

		// 构建上传配置（补全必填字段默认值）
		const config: RemoteServiceConfig = {
			url: "",
			token: "",
			...this.selectedServiceConfig,
		};
		// 补全 gist API URL 默认值（token 已在 selectedServiceConfig 中）
		if (this.selectedServiceType === "github-gist") {
			if (!config.url) config.url = "https://api.github.com";
		}

		const services = createUploadServices(this.app);
		const result = await uploadToService(
			services,
			this.selectedServiceType,
			config,
			{
				content: this.fileContent,
				fileName: this.generatedFileName,
				folderPath: storagePath,
			},
			this.selectedServiceConfig.skipSslVerify ?? this.settings.remoteSkipSslVerify
		);

		if (!result.success) {
			new Notice(`Upload failed: ${result.error}`);
			return;
		}

		// 根据上传类型构建 linkPath
		let linkPath: string;
		if (this.selectedServiceType === "local") {
			// 本地上传：沿用现有的 getLinkPath 逻辑（带 @/# 修饰符）
			const fullPath = normalizePath(
				`${storagePath}/${this.generatedFileName}`
			);
			linkPath = this.getLinkPath(fullPath);
			new Notice(`File created: ${fullPath}`);
		} else {
			// 远程上传：直接使用返回的 URL
			linkPath = result.reference!;
			new Notice(
				`File uploaded to ${this.selectedServiceType}: ${linkPath}`
			);
		}

		const info: EmbedLinkInfo = {
			linkPath,
			displayName: this.getDisplayName(),
			useAlias: this.useAlias,
			content: this.fileContent,
			extension: this.fileExt,
			symbolName: this.symbolName,
			highlightSpec: this.highlightSpec,
			storagePathType: this.modalStoragePathType,
			storagePath: storagePath,
		};
		this.onSubmit(info);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
