# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言规范

本项目所有对话、代码注释、文档均使用中文。代码内已有的中文注释和 UI 字符串保持中文风格。

## Git 工作流

**分支模型（Git flow 变体）**：

```
main ← develop ← {bug-fix/xxx, feature/xxx, refactor/xxx, ...}
```

改代码时必须严格遵守以下流程，不能省略中间层：

1. **从 main 签出 develop**（若本地 develop 落后于 main，先 rebase/pull 到最新 main）。
2. **从 develop 签出任务分支**，命名遵守 `<type>/<slug>`：
   - `bug-fix/xxx` — bug 修复
   - `feature/xxx` — 新功能
   - `refactor/xxx` — 重构
   - `docs/xxx` — 仅文档改动
3. **在任务分支上完成改动 + 本地验证**（`yarn build` + `yarn lint` 都要过）。
4. **把任务分支合回 develop**。可以并行签多条任务分支；合回 develop 无需等其它分支就绪。合完后如果还有下一件事，可以立刻再从最新的 develop 签新分支——不用等 main。
5. **在 develop 上统一集成测试**——多条分支合到一起后可能有冲突或语义冲突（编译过但行为不对），**冲突和联调问题都在 develop 上解决**，不要回到任务分支反复来回改。
6. **develop 合并到 main —— 必须由用户单独确认后才能执行**。这是整个流程的唯一硬闸门。main 上不做任何直接开发。

**给 Claude Code 的约束**：

- 用户说"改一下 X" / "修个 bug" 时，**先检查当前分支**：若在 main / develop 上，主动提示需要按上述流程签出任务分支后再动手，不要在 main / develop 上直接改代码。
- 分支名让用户拍板；如果用户没指定，按改动性质给出建议（bug-fix / feature / refactor / docs）供选择。
- 任务分支上的 commit、以及**任务分支 → develop 的合并**可以在改动完成 + 本地验证通过后自主执行，不需要每次都问；用户可随时打断或要求先暂停。
- **develop → main 的合并必须停下来问用户**——即便任务已经"看起来做完"、build/lint 都过了，也不主动动手。要用户明确说"合到 main" / "发布" / "上线" 之类才做。
- 合并策略默认 `--no-ff`（保留分支拓扑），除非用户另有指示。

## Build & Development

```bash
yarn install    # 安装依赖
yarn dev        # esbuild watch 模式，改动 src/ 自动重建 main.js
yarn build      # 生产构建 = tsc -noEmit + esbuild 压缩，release 前必跑
yarn lint       # eslint（含 obsidianmd 规则）
```

发布产物固定三个：`main.js`（CommonJS bundle，从 `src/main.ts` 打包）、`manifest.json`、`styles.css`，都在插件根目录。`yarn dev` 只跑 esbuild 不跑 tsc；类型错误只有 `yarn build` 才会暴露。

无单元测试框架，验证靠 build + lint + 在真实 Obsidian vault 里手测。

## 深入的架构说明

**`docs/architecture.md` 是本项目的架构真实来源**——它是通读所有 `src/` 源文件后整理的分层、数据流、已知设计权衡、命名陷阱。改代码前建议先读一遍，尤其是数据流图和"发现的问题"一节。以下是极简概要，细节以 architecture.md 为准。

### 三条渲染触发路径都汇聚到 `CodeEmbedProcessor`

`src/main.ts` 注册了三个渲染入口，全部调 `codeProcessor.processEmbeds(container, sourcePath)`：

1. **阅读模式**：`registerMarkdownPostProcessor`
2. **实时预览**：`registerEditorExtension(ViewPlugin)`，`update` 里在 `docChanged / viewportChanged` 时 `setTimeout(50ms)` 再触发一次
3. **文件修改**：`vault.on("modify")` 带 300ms debounce，只对已 `.code-link-processed` 的 embed 走 `processEmbedElement(el, sp, predicate)`，predicate 用来判断"是不是被改的这个文件"

`processEmbedElement` 是三条路径的**公共 seam**——`parseEmbedSource` + IPv6 URL 还原都集中在这里，历史上"某条路径漏做还原"是 bug 来源。

### Pipeline 是「一个协调函数 + 一堆纯函数」，不是 5 阶段类链

`src/pipeline/execute.ts` 的 `executePipeline()` 30 行编排整条流水线：

```
ContentResolver.resolve(filePath, sourcePath)   → ResolvedContent
classifyTargets(symbolName, highlightSpec)      → { display, highlight }
computeDisplayRange(display, content, language) → LineRange
sliceContent(content, range, highlight, lang)   → { displayContent, highlightLines }
                                                → PipelineResult (success | error)
```

- **`ContentResolver`** 是分派器**类**（不是函数），构造时 new 三个 resolver 实例并复用：`isRemoteUrl → HttpResolver`、`isAliasPath → AliasResolver`、否则 `LocalResolver`。
- 找不到符号时 `computeDisplayRange` 直接 `throw new Error(...)`，被 `executePipeline` 的 try/catch 兜底成 `{ success: false, error }`。
- `CodeEmbedProcessor` 有 `inFlight: Map<filePath, Promise<PipelineResult>>` 做请求去重——同一 filePath 的并发请求复用 Promise。

### 双注册表：fetchers 6 种 vs upload 3 种，非对称

`src/fetchers/`（读）和 `src/upload/`（写）用同构 shape 但**类型独立**：

| 服务 | Fetch | Upload |
|---|:---:|:---:|
| `local` | ✅ 读 vault **外** (Node fs) | ✅ 写 vault **内** (Obsidian vault) |
| `webdav` | ✅ | ✅ |
| `github` | ✅ 读 repo contents | ⚠️ 只有 `github-gist` |
| `gitlab / gitea / generic` | ✅ | ❌ |

⚠️ **命名陷阱**：`serviceType: "local"` 两边同名但**语义相反**——`fetchers/local` 用 Node `fs` 读 vault 外目录，`upload/local` 用 Obsidian `vault.create` 写 vault 内。搞混会踩坑。

### 语言层：模板方法 + registry

`src/language/base-extractor.ts` 定义 `BaseExtractor` 抽象类，模板方法 `findSymbolLineRange()` 编排 `stripComments → findDefLine → extractBlock → prependDecorators`。21 个具体 extractor（Python / Ruby / YAML / TS / JS / Java / C-family / Go / Rust / PHP / Lua / HTML / Bash / Perl / XML / SQL / JSON / Kotlin / Swift / C# / Scala）+ 一个 `DefaultExtractor` 兜底。

`src/language/index.ts` 的 `allExtractors` 数组**顺序即语言识别遍历顺序**——TypeScript 必须早于 JavaScript（因为 TS 是 JS 超集）。加新语言：新增 `language/xxx.ts` + 在 `index.ts` 的 `allExtractors` 塞入实例，一处。

### HTTP 客户端

`src/utils/http-client.ts` 的 `dispatchHttpRequest()` 是**所有远程请求的唯一入口**：

- `skipSslVerify && https://` → 走 Node `https.request`（手写重定向支持，5 次上限，301/302 改 GET、307/308 保留方法/body）
- 否则 → 走 Obsidian `requestUrl`
- Node HTTPS 不可用时自动回退到 `requestUrl` 并 console.warn

`getRequire()` 有三级 fallback：`window.require` → `globalThis.require` → 间接 eval。仅 Electron 桌面端可用。

`buildFullPath / encodePathSegments / normalizeBaseUrl / decodeBase64Content / buildServiceUrl / enrichError` 是 fetchers 和 uploaders 都共享的 URL/编码/错误工具。

### 设置：`SettingsProvider` 接口打破循环依赖

`src/types.ts` 定义 `SettingsProvider = { settings, saveSettings, resetMarkdownViews }`。所有 settings tab 的 build 函数以 `SettingsProvider` 为参数而非直接依赖 `Plugin` 具体类，切断 settings ↔ main 循环。

Settings 迁移逻辑在 `main.ts` 的 `loadSettings()` 里：`codeFileExtensions` 从旧逗号分隔字符串迁到 `ExtensionEntry[]`；旧顶层 `storagePathType / absoluteStoragePath / relativeStoragePath` 迁到 `uploadSources.Local.config`。

## 关键约定

- **`data-code-link-handled` 属性 + `.code-link-processed` CSS class** 标记已被本插件处理过的 embed，防止重复渲染。`onunload` 时会全部清掉。
- **CSS 用插件作用域选择器**：`.code-embed-container button.copy-code-button` 而非裸 `button.copy-code-button`，避免影响其他插件。
- **异步操作用 `.catch()` 记录错误**——不要静默 `void promise` 或吞异常。
- **SSL 跳过是**每请求**的 `rejectUnauthorized: false`**，不改全局 `NODE_TLS_REJECT_UNAUTHORIZED`。
- **`main.ts` 保持极简**：只放生命周期、命令注册、processor 初始化。业务不放这里。
- **`saveSettings()` 后重建 processor**（`initProcessors()`），因此 `supportedExtensions` 可以在 processor 构造时一次性缓存。
- **`applyLineHighlights` 不用 `innerHTML.split("\n")`**：PHP 等 markup-templating 语言的 Prism token span 会跨行，切开会让 DOMParser 重解析乱套。用 DFS 扁平化叶子文本 + class 栈，按 `\n` 切行重建。改行高亮时必须遵守这个约束。
