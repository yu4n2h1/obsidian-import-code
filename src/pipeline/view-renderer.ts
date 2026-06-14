import {
	App,
	MarkdownRenderer,
	Component,
	setIcon,
} from "obsidian";
import type { RenderContext } from "./types";

/**
 * 阶段 5：视图渲染器。
 * 接收渲染上下文，组装最终的 DOM 结构并高亮指定行。
 */
export class ViewRenderer {
	private app: App;
	private plugin: Component;

	constructor(app: App, plugin: Component) {
		this.app = app;
		this.plugin = plugin;
	}

	async render(ctx: RenderContext): Promise<HTMLElement> {
		const { file, slice, sourcePath } = ctx;
		const { displayContent, highlightLines } = slice;

		const container = document.createElement("div");
		container.className = "code-embed-container";

		this.buildToolbar(container, file.filePath, file.language, displayContent, sourcePath);

		const wrapper = container.createDiv({ cls: "code-embed-wrapper" });
		await MarkdownRenderer.render(
			this.app,
			`\`\`\`${file.language}\n${displayContent}\n\`\`\``,
			wrapper,
			sourcePath,
			this.plugin,
		);

		if (highlightLines.length > 0) {
			const codeEl = wrapper.querySelector("code");
			if (codeEl) {
				const codeLines = codeEl.innerHTML.split("\n");
				for (const lineIdx of highlightLines) {
					if (lineIdx < codeLines.length) {
						codeLines[lineIdx] = `<span class="code-highlight-line">${codeLines[lineIdx] || "&nbsp;"}</span>`;
					}
				}
				codeEl.replaceChildren(...Array.from(new DOMParser().parseFromString(codeLines.join("\n"), "text/html").body.childNodes));
			}
		}

		return container;
	}

	private buildToolbar(
		container: HTMLElement,
		filePath: string,
		language: string,
		displayContent: string,
		sourcePath: string,
	): void {
		const toolbar = container.createDiv({ cls: "code-embed-toolbar" });

		const openButton = toolbar.createEl("button", { cls: "code-embed-open-btn" });
		openButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void this.app.workspace.openLinkText(filePath, sourcePath);
		});
		setIcon(openButton, "external-link");
		openButton.setAttribute("aria-label", "Open file");

		const langLabel = toolbar.createEl("button", {
			cls: "code-block-flair",
			text: language,
			attr: { "aria-label": "复制" },
		});
		langLabel.dataset.content = displayContent;
		langLabel.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			const btn = e.currentTarget as HTMLButtonElement;
			const content = btn.dataset.content;
			if (!content) return;
			void (async () => {
				try {
					await navigator.clipboard.writeText(content);
					btn.textContent = "已复制";
					setTimeout(() => { btn.textContent = language; }, 1500);
				} catch (err) {
					console.error("复制失败:", err);
				}
			})();
		});
	}
}
