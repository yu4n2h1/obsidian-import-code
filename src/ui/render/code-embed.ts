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
	const { displayContent, highlightLines, startLine, lineNumbers } = slice;
	const showLineNumbers = options?.showLineNumbers === true;
	const wrapLongLines = options?.wrapLongLines === true;

	const container = createDiv({ cls: "code-embed-container" });
	if (showLineNumbers) container.classList.add("code-embed-with-line-numbers");
	if (wrapLongLines) container.classList.add("code-embed-wrap-lines");

	buildToolbar(container, file, displayContent, sourcePath, app);

	const wrapper = container.createDiv({ cls: "code-embed-wrapper" });
	// mermaid 等图表需要更大的展示高度（用类标记替代 CSS :has，兼容旧 iOS）
	if (file.language === "mermaid") {
		wrapper.classList.add("code-embed-has-mermaid");
	}
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
			applyLineHighlights(
				codeEl,
				highlightLines,
				showLineNumbers ? startLine : null,
				lineNumbers,
			);
		}
	}

	// 渲染完成后兜底检测 mermaid 产物（language 判断可能漏掉自定义 dialect）
	if (wrapper.querySelector(".mermaid")) {
		wrapper.classList.add("code-embed-has-mermaid");
	}

	// 折叠：none 模式不折叠；其余模式超阈值才折叠。
	const foldMode = options?.foldMode ?? "full";
	const foldThreshold = options?.foldThreshold ?? 0;
	if (foldMode !== "none" && foldThreshold > 0) {
		const totalLines = displayContent.split("\n").length;
		if (totalLines > foldThreshold) {
			applyFoldable(container, totalLines, {
				mode: foldMode,
				collapsedLines: options?.foldPreviewLines ?? 10,
				expandedLines: options?.foldExpandedLines ?? 30,
			});
		}
	}

	// 缩放交互只在聚焦模式挂载（code-embed-processor.ts 聚焦 overlay 里调用 attachZoom），
	// 非聚焦态不注入缩放按钮，保持阅读视图干净。

	return container;
}

export function renderError(message: string, onRetry?: () => void): HTMLElement {
	const container = createDiv({ cls: "code-embed-container" });
	const errorDiv = container.createDiv({ cls: "code-link-error" });
	errorDiv.textContent = `Error: ${message}`;

	if (onRetry) {
		const retryBtn = createEl("button", {
			cls: "code-link-retry-btn",
			text: "Retry",
			attr: { "aria-label": "Reload" },
		});
		retryBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			onRetry();
		});
		errorDiv.appendChild(retryBtn);
	}

	return container;
}

// ── 内部工具函数 ──

/**
 * 给容器挂折叠状态与展开/收起按钮。
 *
 * 三种模式由 mode 决定：
 * - full：折叠态显示 collapsedLines 行，展开态无限制（看全部）
 * - partial：折叠态 collapsedLines 行，展开态 expandedLines 行（仍可滚动）
 * - none：不应进入此函数（renderSuccess 已过滤）
 *
 * 通过 CSS 变量 --fold-collapsed-h / --fold-expanded-h 传行高，
 * class code-embed-fold-{mode} 让 CSS 区分展开态行为。
 */
interface FoldOptions {
	mode: "full" | "partial";
	collapsedLines: number;
	expandedLines: number;
}

function applyFoldable(
	container: HTMLElement,
	totalLines: number,
	opts: FoldOptions,
): void {
	const { mode, collapsedLines, expandedLines } = opts;
	container.classList.add(
		"code-embed-foldable",
		"code-embed-folded",
		`code-embed-fold-${mode}`,
	);
	container.style.setProperty(
		"--fold-collapsed-h",
		`calc(${collapsedLines} * 1.5em + 1em)`,
	);
	if (mode === "partial") {
		container.style.setProperty(
			"--fold-expanded-h",
			`calc(${expandedLines} * 1.5em + 1em)`,
		);
	}

	const toolbar = container.querySelector(".code-embed-toolbar");
	if (!toolbar) return;

	const btn = createEl("button", { cls: "code-embed-fold-btn" });
	const setLabel = (folded: boolean) => {
		// full 模式展开=全部，显示总行数；partial 模式展开非全部，不显示行数避免误导
		btn.textContent = folded
			? (mode === "full" ? `Expand ${totalLines}` : "Expand")
			: "Collapse";
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
		attr: { "aria-label": "Copy" },
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
				btn.textContent = "Copied";
				window.setTimeout(() => { btn.textContent = file.language; }, 1500);
			} catch (err) {
				console.error("Copy failed:", err);
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
	lineNumbers?: (number | null)[],
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

		const lineEl = createSpan({
			cls: isHighlighted ? "code-line code-highlight-line" : "code-line",
		});

		let contentEl: HTMLElement | null = null;
		// 行号：多区间拼接时 lineNumbers 提供每行的真实源文件行号
		//（分隔空行为 null，不渲染行号）；否则按 startLine 递增推算。
		const rawLineNo = lineNumbers ? lineNumbers[lineIdx] : lineIdx;

		if (startLineForNumbering !== null && rawLineNo !== null) {
			const numEl = createSpan({
				cls: "code-line-no",
				text: String(
					lineNumbers ? rawLineNo : startLineForNumbering + lineIdx,
				),
			});
			lineEl.appendChild(numEl);

			contentEl = createSpan({ cls: "code-line-content" });
			lineEl.appendChild(contentEl);
		}

		const tokenParent = contentEl ?? lineEl;
		if (lineTokens.length === 0) {
			if (isHighlighted) tokenParent.textContent = "\u00a0";
		} else {
			for (const tok of lineTokens) {
				let parent: HTMLElement = tokenParent;
				for (const cls of tok.classes) {
					const span = createSpan({ cls });
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

/**
 * 缩放控制：对 wrapper 内的图形渲染产物（mermaid SVG 等）支持缩放。
 *
 * - 只作用于图形元素（.mermaid svg, svg, img, canvas），不干预 pre/code 的文本滚动。
 * - 缩放比例 0.3x–5x。
 * - macOS trackpad pinch: ctrlKey=true + deltaY 小且连续 -> 指数比例缩放（丝滑）
 * - 鼠标 Ctrl+滚轮: deltaY 大（~100） -> 步进缩放
 * - 双击图形元素重置缩放到 1x。
 * - 按钮：在 container 内的 .code-embed-toolbar 注入 [＋] [－] [↺]；没有 toolbar 则创建。
 */
export function attachZoom(container: HTMLElement, wrapper: HTMLElement): void {
	let zoom = 1;
	const MIN = 0.3;
	const MAX = 5;

	// 缩放目标：只匹配 .mermaid 内的 SVG（Obsidian 图形渲染产物）。
	// 不用通用 svg 选择器 -- Obsidian 的 copy 按钮也含 SVG 图标，
	// 会导致常规代码块被误判为可缩放目标。
	function getZoomTargets(): HTMLElement[] {
		return Array.from(wrapper.querySelectorAll<HTMLElement>(
			".mermaid svg",
		));
	}

	// 没有图形元素 -> 不是 mermaid 等图形渲染产物 -> 直接退出，
	// 不创建缩放 toolbar，不挂 wheel 监听，常规代码保持原状。
	if (getZoomTargets().length === 0) return;

	// 记录每个图形元素的原始尺寸（首次访问时缓存），缩放基于原始值计算，
	// 避免连续缩放误差累积。
	const baseSizes = new WeakMap<HTMLElement, { w: number; h: number }>();

	function getBaseSize(el: HTMLElement): { w: number; h: number } {
		let base = baseSizes.get(el);
		if (!base) {
			const rect = el.getBoundingClientRect();
			// transform 不影响 getBoundingClientRect 之前的 offsetWidth/offsetHeight
			base = { w: el.offsetWidth || rect.width, h: el.offsetHeight || rect.height };
			baseSizes.set(el, base);
		}
		return base;
	}

	function applyZoom(): void {
		const targets = getZoomTargets();
		targets.forEach((el) => {
			// 用真实 width/height 缩放（非 transform）：布局尺寸真实变化，
			// 滚动容器的 scrollWidth/scrollHeight 自动重算，放大后仍可滚动查看全貌。
			const base = getBaseSize(el);
			el.style.width = `${Math.round(base.w * zoom)}px`;
			el.style.height = `${Math.round(base.h * zoom)}px`;
		});
	}

	function resetZoom(): void {
		zoom = 1;
		const targets = getZoomTargets();
		targets.forEach((el) => {
			el.style.removeProperty("width");
			el.style.removeProperty("height");
		});
	}

	// --- 独立缩放工具栏（不克隆原 toolbar，只含缩放按钮）---
	if (container.querySelector(".code-embed-zoom-controls")) return;
	const zoomToolbar = container.createDiv({ cls: "code-embed-toolbar code-embed-zoom-toolbar" });
	const controls = zoomToolbar.createDiv({ cls: "code-embed-zoom-controls" });

	const btnIn = controls.createEl("button", { cls: "code-embed-zoom-btn" });
	btnIn.setAttribute("aria-label", "Zoom in");
	setZoomButtonIcon(btnIn, "plus");
	btnIn.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		zoom = Math.min(MAX, zoom + 0.2);
		applyZoom();
	});

	const btnOut = controls.createEl("button", { cls: "code-embed-zoom-btn" });
	btnOut.setAttribute("aria-label", "Zoom out");
	setZoomButtonIcon(btnOut, "minus");
	btnOut.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		zoom = Math.max(MIN, zoom - 0.2);
		applyZoom();
	});

	const btnReset = controls.createEl("button", { cls: "code-embed-zoom-btn" });
	btnReset.setAttribute("aria-label", "Reset zoom");
	setZoomButtonIcon(btnReset, "rotate-ccw");
	btnReset.addEventListener("click", (e) => {
		e.preventDefault();
		e.stopPropagation();
		resetZoom();
	});

	// --- wheel ---
	wrapper.addEventListener("wheel", (e: WheelEvent) => {
		if (!e.ctrlKey) return;
		e.preventDefault();
		e.stopPropagation();

		if (Math.abs(e.deltaY) < 50) {
			const factor = Math.exp(-e.deltaY * 0.01);
			zoom = Math.max(MIN, Math.min(MAX, zoom * factor));
		} else {
			const step = 0.15;
			const delta = e.deltaY < 0 ? step : -step;
			zoom = Math.max(MIN, Math.min(MAX, zoom + delta));
		}

		applyZoom();
	}, { passive: false });

	// --- 双击重置 ---
	wrapper.addEventListener("dblclick", (e: MouseEvent) => {
		const target = e.target as HTMLElement;
		if (!target.closest("svg, img, canvas, .mermaid")) return;
		e.preventDefault();
		e.stopPropagation();
		resetZoom();
	});
}

/**
 * 安全地设置按钮图标 -- Obsidian setIcon 依赖 lucide 名称。
 */
function setZoomButtonIcon(btn: HTMLElement, iconId: string): void {
	try {
		setIcon(btn, iconId);
	} catch {
		// setIcon 在某些 Obsidian 版本可能找不到图标名，退化为文字
		btn.textContent = iconId === "plus" ? "＋" : iconId === "minus" ? "－" : "↺";
	}
}
