import {
	App,
	MarkdownRenderer,
	Component,
	setIcon,
} from "obsidian";
import type { RenderContext } from "../../pipeline/types";

/**
 * 阶段 5：渲染层。接收 RenderContext，组装代码嵌入 DOM。
 * 从 pipeline/view-renderer.ts 抽取为纯函数，增加 sourceMode 分支。
 */

// ── 公开渲染函数 ──

export async function renderSuccess(
	app: App,
	plugin: Component,
	ctx: RenderContext,
): Promise<HTMLElement> {
	const { file, slice, sourcePath, options } = ctx;
	const { displayContent, highlightLines, startLine } = slice;
	const showLineNumbers = options?.showLineNumbers === true;
	const wrapLongLines = options?.wrapLongLines === true;

	const container = document.createElement("div");
	container.className = "code-embed-container";
	if (showLineNumbers) container.classList.add("code-embed-with-line-numbers");
	if (wrapLongLines) container.classList.add("code-embed-wrap-lines");

	buildToolbar(container, file, displayContent, sourcePath, app);

	const wrapper = container.createDiv({ cls: "code-embed-wrapper" });
	// MarkdownRenderer.render 是异步的：先 await 让 Obsidian 把 code 元素渲染上，
	// 再做 querySelector 与高亮。历史上这里用 `void MarkdownRenderer.render(...)`
	// 后紧接着 querySelector，依赖 Obsidian 当前实现里 render 同步落 DOM 的巧合——
	// API 契约本身是异步，未来升级可能打破。
	await MarkdownRenderer.render(
		app,
		`\`\`\`${file.language}\n${displayContent}\n\`\`\``,
		wrapper,
		sourcePath,
		plugin,
	);

	// 行高亮 & 行号都需要遍历 <code> 里的行结构，共用一次 DFS 扁平化。
	// 若只有行号无高亮，也走同一函数，highlightLines 空数组走通默认路径。
	if (highlightLines.length > 0 || showLineNumbers) {
		const codeEl = wrapper.querySelector("code");
		if (codeEl) {
			applyLineHighlights(codeEl, highlightLines, showLineNumbers ? startLine : null);
		}
	}

	// 折叠：只在超过阈值时启用。默认折叠状态，用户点按钮切换。
	const foldThreshold = options?.foldThreshold ?? 0;
	if (foldThreshold > 0) {
		const totalLines = displayContent.split("\n").length;
		if (totalLines > foldThreshold) {
			applyFoldable(container, wrapper, totalLines);
		}
	}

	return container;
}

export function renderError(message: string): HTMLElement {
	const container = document.createElement("div");
	container.className = "code-embed-container";
	const errorDiv = container.createDiv({ cls: "code-link-error" });
	errorDiv.textContent = `Error: ${message}`;
	return container;
}

// ── 内部工具函数 ──

/**
 * 给容器挂折叠状态与展开/收起按钮。
 *
 * 默认折叠（container 加 .code-embed-folded），wrapper 上的 CSS
 * 限制 max-height 只显示前几行，并加渐变遮罩暗示"下面还有"。
 * 按钮 toggle 折叠 class 与自身文本。
 */
function applyFoldable(
	container: HTMLElement,
	wrapper: HTMLElement,
	totalLines: number,
): void {
	// wrapper 参数保留：未来若需要 wrapper 特化行为可用；当前只挂 container 的 class。
	void wrapper;
	container.classList.add("code-embed-foldable", "code-embed-folded");

	const toolbar = container.querySelector(".code-embed-toolbar");
	if (!toolbar) return;

	const btn = document.createElement("button");
	btn.className = "code-embed-fold-btn";
	const setLabel = (folded: boolean) => {
		btn.textContent = folded ? `展开 (${totalLines} 行)` : "收起";
		btn.setAttribute("aria-expanded", folded ? "false" : "true");
	};
	setLabel(true);
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const folded = container.classList.toggle("code-embed-folded");
		setLabel(folded);
	});
	toolbar.appendChild(btn);
}

/**
 * 构建工具栏：打开按钮 + 语言/复制按钮。
 * sourceMode 分支：local 走 Obsidian 内部链接，http/alias 走浏览器新标签页。
 */
function buildToolbar(
	container: HTMLElement,
	file: RenderContext["file"],
	displayContent: string,
	sourcePath: string,
	app: App,
): void {
	const toolbar = container.createDiv({ cls: "code-embed-toolbar" });

	const openButton = toolbar.createEl("button", { cls: "code-embed-open-btn" });

	if (file.sourceMode === "local") {
		openButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			void app.workspace.openLinkText(file.filePath, sourcePath);
		});
	} else {
		// http 或 alias 模式
		openButton.addEventListener("click", (e) => {
			e.preventDefault();
			e.stopPropagation();
			window.open(file.filePath, "_blank");
		});
	}

	setIcon(openButton, "external-link");
	openButton.setAttribute("aria-label", "Open file");

	const langLabel = toolbar.createEl("button", {
		cls: "code-block-flair",
		text: file.language,
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
				setTimeout(() => { btn.textContent = file.language; }, 1500);
			} catch (err) {
				console.error("复制失败:", err);
			}
		})();
	});
}

/**
 * 对 Prism 渲染后的 <code> 元素按「逻辑行」应用高亮 class。
 *
 * 不能用 codeEl.innerHTML.split("\n")：PHP 等 markup-templating 语言的
 * Prism token span 会跨行，split 切断 span → DOMParser 重解析时 DOM 错乱，
 * 导致整片高亮。改为按 DOM 结构扁平化、按文本中的 \n 分行重建。
 *
 * ⚠️ class 必须整段保留、**不能拆开**：Prism 主题的 CSS 用组合选择器
 * （`.token.keyword`、`.token.string` 等），要求同一元素上同时挂 token
 * 和具体类型 class。若在栈里把 "token keyword" split 成两个原子 class
 * 再嵌套成 `<span class="token"><span class="keyword">`，`.token.keyword`
 * 就命中不到内层元素，Prism 语法着色全部丢失。历史上曾这样做过，导致
 * 「高亮成功但原生代码高亮消失」的 bug。
 */
function applyLineHighlights(
	codeEl: HTMLElement,
	highlightLines: number[],
	startLineForNumbering: number | null,
): void {
	interface FlatToken { text: string; classes: string[]; }

	// 1. DFS 扁平化：收集所有叶子文本节点，每个携带从根到叶的 class 栈；
	//    栈的每一层是「一个 DOM 元素上的整段 className」，保留多 class 组合。
	const tokens: FlatToken[] = [];
	const walk = (node: Node, classStack: string[]): void => {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent;
			if (text) tokens.push({ text, classes: classStack });
			return;
		}
		if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as HTMLElement;
			const cls = typeof el.className === "string" ? el.className.trim() : "";
			const newStack = cls ? [...classStack, cls] : classStack;
			el.childNodes.forEach((child) => walk(child, newStack));
		}
	};
	walk(codeEl, []);

	// 2. 按文本中的 \n 切分为行（跨行 token 的各段继承同一 class 栈）
	const lines: FlatToken[][] = [];
	let currentLine: FlatToken[] = [];
	lines.push(currentLine);
	for (const tok of tokens) {
		const parts = tok.text.split("\n");
		parts.forEach((part, i) => {
			if (i > 0) {
				currentLine = [];
				lines.push(currentLine);
			}
			if (part) currentLine.push({ text: part, classes: tok.classes });
		});
	}

	// 3. 重建每行 DOM：每行一个 .code-line，高亮行加 .code-highlight-line。
	//    每层 span.className 直接用栈里保存的完整 class 串
	//    （可能含空格分隔的多个 class，例如 "token keyword"，
	//    这样 Prism 主题的组合选择器 `.token.keyword` 才能命中）。
	const highlightSet = new Set(highlightLines);
	const newNodes: Node[] = [];
	lines.forEach((lineTokens, lineIdx) => {
		const isHighlighted = highlightSet.has(lineIdx);

		const lineEl = document.createElement("span");
		lineEl.className = isHighlighted ? "code-line code-highlight-line" : "code-line";

		if (startLineForNumbering !== null) {
			const numEl = document.createElement("span");
			numEl.className = "code-line-no";
			numEl.textContent = String(startLineForNumbering + lineIdx);
			lineEl.appendChild(numEl);
		}

		if (lineTokens.length === 0) {
			if (isHighlighted) lineEl.textContent = "\u00a0";
		} else {
			for (const tok of lineTokens) {
				let parent: HTMLElement = lineEl;
				for (const cls of tok.classes) {
					const span = document.createElement("span");
					span.className = cls;
					parent.appendChild(span);
					parent = span;
				}
				parent.appendChild(document.createTextNode(tok.text));
			}
		}

		newNodes.push(lineEl);
		if (lineIdx < lines.length - 1) {
			newNodes.push(document.createTextNode("\n"));
		}
	});

	codeEl.replaceChildren(...newNodes);
}
