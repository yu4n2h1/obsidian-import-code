import {
	App,
	Modal,
	Setting,
	Component,
	MarkdownRenderer,
} from "obsidian";
import { LastFileReference } from "../types";
import { getLanguageFromPath } from "../utils/language";

export class EditLinkModal extends Modal {
	private lastRef: LastFileReference;
	private symbolName: string;
	private highlightSpec: string;
	private linkPreviewEl?: HTMLElement;
	private renderComponent: Component;
	private onSubmit: (linkText: string, symbolName: string, highlightSpec: string) => void;

	constructor(
		app: App,
		lastRef: LastFileReference,
		onSubmit: (linkText: string, symbolName: string, highlightSpec: string) => void
	) {
		super(app);
		this.lastRef = lastRef;
		this.symbolName = lastRef.symbolName;
		this.highlightSpec = lastRef.highlightSpec;
		this.onSubmit = onSubmit;
		this.renderComponent = new Component();
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("edit-link-modal");

		contentEl.createEl("h2", { text: "再次引用代码文件" });

		// Read-only info section
		const infoSection = contentEl.createDiv({ cls: "edit-link-info" });

		const pathTypeLabel =
			this.lastRef.storagePathType === "absolute"
				? "根目录"
				: this.lastRef.storagePathType === "relative"
					? "相对路径"
					: `远程上传 (${this.lastRef.remoteServiceType || ""})`;

		this.createInfoRow(infoSection, "存储方式", pathTypeLabel);
		this.createInfoRow(infoSection, "存储路径", this.lastRef.storagePath);
		this.createInfoRow(infoSection, "文件名", `${this.lastRef.fileName}.${this.lastRef.extension}`);
		this.createInfoRow(infoSection, "扩展名", `.${this.lastRef.extension}`);

		// Rendered code block
		const codeLabel = contentEl.createEl("div", { cls: "setting-item" });
		codeLabel
			.createEl("div", { cls: "setting-item-info" })
			.createEl("div", {
				cls: "setting-item-name",
				text: "文件内容预览",
			});

		const codeContainer = contentEl.createDiv({
			cls: "edit-link-code-container",
		});

		const [, language] = getLanguageFromPath(
			`file.${this.lastRef.extension}`
		);
		const markdownCodeBlock =
			"```" + language + "\n" + this.lastRef.content + "\n```";

		await MarkdownRenderer.render(
			this.app,
			markdownCodeBlock,
			codeContainer,
			"",
			this.renderComponent
		);

		// Editable @ symbol input
		new Setting(contentEl)
			.setName("符号 (@)")
			.setDesc("提取指定函数/类/方法，或行范围如 10-30")
			.addText((text) => {
				text.setPlaceholder("函数名 或 10-30");
				text.setValue(this.symbolName);
				text.onChange((value) => {
					this.symbolName = value.trim();
					this.updateLinkPreview();
				});
			});

		// Editable # highlight input
		new Setting(contentEl)
			.setName("高亮 (#)")
			.setDesc("高亮指定行，如 L5-L10")
			.addText((text) => {
				text.setPlaceholder("L5-L10");
				text.setValue(this.highlightSpec);
				text.onChange((value) => {
					this.highlightSpec = value.trim();
					this.updateLinkPreview();
				});
			});

		// Link preview
		const previewSection = contentEl.createDiv({
			cls: "link-preview-section",
		});
		previewSection.createEl("div", {
			cls: "setting-item-name",
			text: "链接预览",
		});
		this.linkPreviewEl = previewSection.createDiv({
			cls: "link-preview-content",
		});
		this.updateLinkPreview();

		// Buttons
		const buttonContainer = contentEl.createEl("div", {
			cls: "modal-button-container",
		});

		const cancelBtn = buttonContainer.createEl("button", { text: "取消" });
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		const confirmBtn = buttonContainer.createEl("button", {
			text: "插入引用",
			cls: "mod-cta",
		});
		confirmBtn.addEventListener("click", () => {
			const linkText = this.buildLinkText();
			this.onSubmit(linkText, this.symbolName, this.highlightSpec);
			this.close();
		});
	}

	private createInfoRow(
		container: HTMLElement,
		label: string,
		value: string
	): void {
		const row = container.createDiv({ cls: "edit-link-info-row" });
		row.createEl("span", { cls: "edit-link-info-label", text: label });
		row.createEl("span", { cls: "edit-link-info-value", text: value });
	}

	private buildLinkText(): string {
		const { linkPath, displayName } = this.buildPathAndDisplay();
		return `![[${linkPath}|${displayName}]]`;
	}

	private buildPathAndDisplay(): {
		linkPath: string;
		displayName: string;
	} {
		let base = this.lastRef.linkPath;

		// Strip existing @ and # from the stored linkPath
		const atIdx = base.lastIndexOf("@");
		const hashIdx = base.lastIndexOf("#");
		let cleanPath = base;

		if (hashIdx !== -1 && hashIdx > atIdx) {
			cleanPath = base.substring(0, hashIdx);
		}
		if (atIdx !== -1) {
			cleanPath = base.substring(0, atIdx);
		}

		const parts: string[] = [cleanPath];
		if (this.symbolName) parts.push(`@${this.symbolName}`);
		if (this.highlightSpec) parts.push(`#${this.highlightSpec}`);

		return {
			linkPath: parts.join(""),
			displayName: this.lastRef.fileName,
		};
	}

	private updateLinkPreview(): void {
		if (!this.linkPreviewEl) return;
		const linkText = this.buildLinkText();
		this.linkPreviewEl.textContent = linkText;
	}

	onClose() {
		this.renderComponent.unload();
		const { contentEl } = this;
		contentEl.empty();
	}
}
