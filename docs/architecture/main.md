# 入口 & 生命周期：`src/main.ts`

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

`importCode extends Plugin` 是唯一 default export，做六件事：

- **`loadSettings()`**：从磁盘读设置，并**内联四处向后兼容迁移**：
  - `codeFileExtensions` 从旧的逗号分隔字符串迁移为 `ExtensionEntry[]`（`{suffix, dialect, active}`），去重、`dialect = suffix`。
  - 旧布尔开关 `"enabled" / "disabled"` 字符串迁移为 boolean（`codeEmbedEnabled`、`remoteCodeEmbedEnabled`）。
  - 旧顶层字段 `storagePathType / absoluteStoragePath / relativeStoragePath` 迁到新的 `uploadSources.Local.config`（仅当 `uploadSources` 为空才迁，并删除旧字段）。
  - `apiUrl → url`、`pathPrefix → path` 字段重命名（commit `8f2a42c`）。
- **`initProcessors()`**：`new CodeEmbedProcessor(app, settings, this)`。任何 `saveSettings()` 之后都会重建 processor（这也是为什么 `supportedExtensions` 可以在构造时一次性缓存）。
- **注册 5 个 Obsidian 扩展点 + 1 个 vault 事件**：
  1. `addSettingTab(importCodeSettingsTab)`
  2. `addCommand("create-code-file")`，回调由 `commands/insert-code.ts` 工厂函数产出
  3. `addCommand("re-reference-last-code")`，同上
  4. `registerMarkdownPostProcessor` → 阅读模式渲染，调 `codeProcessor.processEmbeds(el, sourcePath)`
  5. `registerEditorExtension(ViewPlugin)` → 实时预览/编辑模式。`ViewPlugin.define` 工厂创建时**立即** `setTimeout(50)` 触发一次；`update` 里在 `docChanged || viewportChanged` 时再 `setTimeout(50ms)` 触发一次 `processEmbeds(view.dom, ...)`。`sourcePath` 通过遍历 `getLeavesOfType('markdown')` 找含 `view.dom` 的 MarkdownView 推导（分屏下非活动 pane 也能拿到正确路径，`d9b4972` 修复）
- **`vault.on("modify")`** 加了 300ms debounce（`utils/helpers.ts` 的 `debounce`），文件修改后重扫所有已打开 MarkdownView 里带 `.code-link-processed` 的 embed，走 `processEmbedElement(el, sourcePath, predicate)` —— predicate 过滤"是不是这个被改的文件"。
- **`runStartupDiagnostics()`**：如果 `remoteCodeEmbedEnabled` 且任何 remote source 开了 `skipSslVerify` 或全局 `remoteSkipSslVerify`，就 eager-load 一次 Node.js `https` 模块探测。仅当 `getHttps()` **throw** 时 `new Notice(...)` 提示；若模块加载成功但 `request` 不是函数，只 `console.warn`。
- **`onunload()`**：遍历所有 MarkdownView，清掉 `.code-link-processed` 标记和 `data-code-link-handled` 属性、把 embed 元素 `empty()`。
