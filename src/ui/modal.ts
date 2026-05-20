import {
	App,
	Modal,
	Setting,
	Notice,
	MarkdownView,
	normalizePath,
} from "obsidian";
import { PluginSettings, EmbedLinkInfo } from "../types";
import { guessExtensionFromContent, extractFirstSymbolName } from "../utils/language";

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

		contentEl.createEl("h2", { text: "Create code file" });

		// 1. File extension dropdown
		new Setting(contentEl)
			.setName("File extension")
			.setDesc("Select file extension")
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

		// 3. Storage path type dropdown
		new Setting(contentEl)
			.setName("Storage path type")
			.setDesc("Choose file storage method")
			.addDropdown((dropdown) => {
				dropdown.addOption("absolute", "Absolute (vault root)");
				dropdown.addOption("relative", "Relative (current note)");
				dropdown.setValue(this.modalStoragePathType);
				dropdown.onChange((value) => {
					this.modalStoragePathType = value as "absolute" | "relative";
					this.toggleStorageSections();
				});
			});

		// 4. Local path input (absolute or relative)
		this.pathInputEl = contentEl.createDiv({ cls: "storage-path-section" });

		new Setting(this.pathInputEl)
			.setName("Absolute storage path")
			.setDesc("Path relative to vault root")
			.addText((text) => {
				text.setPlaceholder("assets/code");
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

		const absoluteRow = this.pathInputEl.querySelector(
			".setting-item:nth-child(1)"
		) as HTMLElement;
		const relativeRow = this.pathInputEl.querySelector(
			".setting-item:nth-child(2)"
		) as HTMLElement;

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
		const setVisibility = () => {
			const isAbsolute = this.modalStoragePathType === "absolute";

			if (this.pathInputEl) {
				this.pathInputEl.style.display = "block";
			}
			if (absoluteRow) {
				absoluteRow.style.display = isAbsolute ? "" : "none";
			}
			if (relativeRow) {
				relativeRow.style.display = !isAbsolute ? "" : "none";
			}
		};

		this.toggleStorageSections = () => setVisibility();
		setVisibility();

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
		// Overridden in onOpen with closure over local DOM elements
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
		// "auto" mode (or custom strategy with empty name)
		const symbolName = extractFirstSymbolName(content, extension);
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
				new Notice(`File already exists: ${fullPath}`);
			} else {
				await this.app.vault.create(fullPath, this.fileContent);
				new Notice(`File created: ${fullPath}`);
			}

			const linkPath = this.getLinkPath(fullPath);
			const info: EmbedLinkInfo = {
				linkPath,
				displayName: this.getDisplayName(),
				content: this.fileContent,
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
			new Notice(`Failed to create file: ${message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
