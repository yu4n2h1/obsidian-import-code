# 核心处理器：`src/code-embed-processor.ts`

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

这是**从 embed DOM 元素到最终代码块 DOM** 的中央协调器。构造时缓存四件东西：

- `contentResolver: ContentResolver`（pipeline 依赖）
- `supportedExtensions: Set<string>`（来自 `getSupportedExtensions(settings)`）
- `inFlight: Map<`${filePath}\0${symbolName}\0${highlightSpec}`, Promise<PipelineResult>>` —— **去重 key 是 filePath+symbol+highlight 拼接**（`d9b4972` 修复了"仅 filePath 导致 funcB 容器渲染 funcA 内容"的 bug），同文件不同符号各自独立、不共享 Promise；配合 modify 事件时特别有用。
- `renderTokens: WeakMap<HTMLElement, symbol>` —— **异步竞态防护**：每次 `processFile` 更新 token，旧渲染完成后读到 token 变化就丢弃结果，防止 modify 在旧渲染未完成时重入导致孤儿 DOM/错乱追加。

三个公开方法一层套一层：

- `processEmbeds(container, sourcePath)`：`.internal-embed` 全扫，跳过 `.code-link-processed`，逐个交给 `processEmbedElement`。
- `processEmbedElement(el, sourcePath, shouldProcess?)`：**per-element 单一入口**。做 `resolveEmbedSrc()`（`parseEmbedSource` + IPv6 还原；还原成功后**用还原路径重新 `parseEmbedSource` 一次**，刷新 `symbolName`/`highlightSpec`），可选谓词过滤（modify 用），`isProcessingAllowed()` 守卫，然后调 `processFile()`。注释里明确说 modify 与 new-embed 两条路径必须共用这个 seam，避免历史上"IPv6 还原只在某一路径生效"的 bug。
- `processFile(...)`：先在容器上加 `data-code-link-handled`、`code-link-block` 占位，然后调 `executePipeline(...)`（带 in-flight 去重），拿到 `PipelineResult`：
  - 占位分两种：remote/alias 走骨架屏 `.code-link-skeleton`（3 条 `.code-link-skeleton-line`），仅 local 才是 "Loading..." 文本。
  - 成功：`renderSuccess()`（**async**，内部 `await MarkdownRenderer.render`）生成 DOM，返回后**再查一次 `renderTokens` token** 才 `empty() + appendChild`，并注册点击 handler——"点击代码块吞掉冒泡、按钮里冒泡照放"，另实现**全屏聚焦 overlay**（复制行号/换行 class、限制到 `.view-content` 区域、ESC 或点遮罩关闭）。
  - 失败：`renderError(result.error, onRetry?)`——失败态带 Retry 按钮，点击重新走 `processFile`。

`isProcessingAllowed(filePath)` 是所有守卫的统一入口：查 `codeEmbedEnabled`、扩展名是否在启用列表、`classifyPath(filePath) !== "local"`（remote/alias 则再查 `remoteCodeEmbedEnabled`）。
