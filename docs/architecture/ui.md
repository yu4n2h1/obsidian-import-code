# UI 层：`src/ui/`

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

三块子目录：

## `ui/render/code-embed.ts`

**当前使用的渲染层**，导出两个渲染函数：

- `renderSuccess(app, plugin, ctx: RenderContext): Promise<HTMLElement>`（**async**，内部 `await MarkdownRenderer.render`）——组装 `.code-embed-container`，含 toolbar（open 按钮 + 语言 chip/复制按钮）、`.code-embed-wrapper` 用 `MarkdownRenderer.render(app, \`\`\`\`\${lang}\n...\n\`\`\`)` 交给 Obsidian 生成 Prism 高亮。支持**行号**（`showLineNumbers` + `startLine` 显示源文件真实行号）、**折叠**（`foldMode/foldThreshold/foldPreviewLines/foldExpandedLines` + 折叠按钮）、**长行换行**（`wrapLongLines`）。
  - **`sourceMode` 分支**：`local` 走 `app.workspace.openLinkText`，`http/alias` 走 `window.open(url, "_blank")`。
  - **`applyLineHighlights(codeEl, highlightLines, startLineForNumbering, lineNumbers?)`**（模块私有）：这段有一大段注释解释为什么不能用 `innerHTML.split("\n")`——因为 PHP 这类 markup-templating 的 Prism token span 会跨行，切开 span 会让 DOMParser 重解析乱套。改为 DFS 扁平化叶子文本节点（每个节点带 class 栈），按 `\n` 切分成逻辑行重建，每行包一个 `.code-line`，命中的加 `.code-highlight-line`。行号：`lineNumbers` 存在时（HTML 多区间拼接）逐行取源文件真实行号，分隔空行为 `null` 不渲染行号；否则按 `startLineForNumbering + lineIdx` 递增。
- `renderError(message, onRetry?): HTMLElement`——`.code-link-error` 显示 `Error: xxx`，失败态带 Retry 按钮，点击回调重新走 `processFile`。

## `ui/renderer/code-embed.ts` — 已删除 ✅

历史上这里是一份旧版 `CodeEmbedProcessor` 的复本，import 了四个不再存在的 pipeline 文件（`file-reader / view-renderer / link-router / symbol-converter`），全项目零引用。已随死代码清理一并 `rm`，连同空目录 `ui/renderer/` 一起移除。`yarn build`（含 `tsc -noEmit`）与 `yarn lint` 均通过。

## `ui/modal/`

- `modal.ts`（693 行）：`FileModal`——用户在编辑器里触发"Insert embed code"命令时打开。做粘贴板自动填充、语言检测（`guessExtensionFromContent`）、文件名策略（hash / custom / auto）、选择 upload source（local vault / webdav / github-gist）、调用 `uploadToService(...)`、最后回调 `onSubmit(EmbedLinkInfo)`。
  - 内部有**两种 UI 分支**：
    - **别名模式**（默认）：`settings.uploadSources` 非空时，下拉选一个已配置的别名。
    - **回退模式**（L124–192）：`uploadSources` 为空时，UI 退化到手动选 local / github-gist / webdav-from-remoteSources。因为 `DEFAULT_SETTINGS.uploadSources` 内置 `Local` 别名，**正常路径下永远走别名模式**——回退模式只是给用户手动把 uploadSources 清空的兼容分支，不是重构残留。
- `edit-link-modal.ts`（199 行）：`EditLinkModal`——用户触发"再次引用代码文件"命令时打开，只允许编辑 `@symbolName` 与 `#highlightSpec` 字段，其它信息（存储方式、路径、文件名、扩展名）只读展示，带**实时代码预览**和**实时链接预览**。

## `ui/settings/`

`settings-tab.ts` 定义 `importCodeSettingsTab`，包含两种设置页入口：Obsidian 1.13+ 通过 `getSettingDefinitions()` 提供可搜索的子页面；较旧版本忽略该方法并使用 `display()` 构建原有的 4 个 tab。声明式子页面把复杂的旧表单 builder 放进自定义 `render` 回调的 `Setting.controlEl`。

自定义 renderer 外层的 `.code-import-definition-panel` 只是布局容器。对应 CSS 必须使用直接子选择器定位外层 `.setting-item-info` / `.setting-item-control`；后代选择器会误伤里面由旧 builder 创建的真实 `Setting` 行，隐藏它们的标题与说明并覆盖控件布局。

4 个 panel 分别由以下 builder 构建：

- `embed-storage-tab.ts` — 全局开关（codeEmbedEnabled / remoteCodeEmbedEnabled / remoteSkipSslVerify）与文件名策略
- `extensions-tab.ts` — `ExtensionEntry[]` 的增删改（suffix / dialect / active toggle）
- `remote-sources-tab.ts` — 配置化的读源（GitHub/GitLab/Gitea/WebDAV/Generic/Local），alias-key 型 map
- `upload-sources-tab.ts` — 配置化的写源（Local vault / WebDAV / GitHub Gist）
- `remote-config-fields.ts` — 前两个 tab 共享的 URL/Token/repo/branch/path 表单字段构造
- `rebuild.ts`（只有 17 行）— 抽出的 `rebuildSettingsSection` 公共函数，"消除重复代码"（来自最近的 commit message）

**`SettingsProvider` 接口**（`types.ts` 末尾）：暴露 `{ settings, saveSettings, resetMarkdownViews }`，让 settings tab 不直接依赖 `main.ts` 的 `importCode` 类，切断了 settings ↔ main 的循环依赖。所有 tab 的 build 函数都以 `SettingsProvider` 为参数。
