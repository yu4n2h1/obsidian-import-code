# CLAUDE.md

本文件为 Claude Code 在本仓库中工作提供指导，遵循项目模板结构。

## 项目概览

**Obsidian Import Code** —— Obsidian 插件，用内部链接语法 `![[file.ext]]` 在笔记中嵌入并渲染外部代码文件。目标用户：需要在笔记中展示、维护外部代码文件的 Obsidian 用户。

核心能力：
- 语法高亮（Prism）、文件变更自动刷新（`vault.on("modify")` 监听）、复制到剪贴板按钮。
- 定位语法：`![[file.ts@symbol]]` 定位符号、`![[file.ts@10-20]]` 定位行范围，支持高亮标记。
- 远程读源：`local`（Node `fs` 读 vault **外**目录）、`webdav`、`github`、`gitlab`、`gitea`、`generic`。
- 远程写源：`local`（Obsidian vault 写 vault **内**）、`webdav`、`github-gist`。

技术栈：TypeScript + esbuild + Obsidian API + CodeMirror。核心入口 `src/main.ts`，打包产物 `main.js`。启动方式见下文「Build & Development」。

## 语言与文档

（固定）对话与文档用中文，文档用 markdown。代码注释与 UI 字符串同样保持中文，代码内已有的中文注释和 UI 字符串保持中文风格。

## 工作协议

（固定）
- 动手前先通读本文件与项目结构。
- 不影响全局的事（分支命名、常规 commit）自主执行，不逐件询问。
- 硬闸门（发布 / 上线 / 删数据 / 改共享配置）必须经用户确认。
- 改动与既有规范冲突时，先指出冲突点再动手。

## Git 工作流

（固定）分支模型：`main ← develop ← {bug-fix/xxx, feature/xxx, refactor/xxx, ...}`

1. **签出 develop**：从 main 签出，落后则先 rebase/pull。
2. **签出任务分支**：从 develop 签出，命名 `<type>/<slug>`（bug-fix / feature / refactor / docs）。
3. **开发 + 本地验证**：构建、lint、全部单测、类型检查（有 E2E 也跑）。
4. **合回 develop**：默认快速合并（--ff）。门禁：有全套自动化测试（单测 + 类型检查 + E2E）跑通即合；否则等人工测试通过再合。任务分支可并行，不用等其它就绪。
5. **develop 集成测试**：冲突与联调问题都在此解决，不回任务分支反复改。
6. **合入 main**：保留 merge 节点（--no-ff，除非另有指示），同样过测试门禁，且必须经用户确认。main 不做直接开发。

**自主 / 需确认**：
- 自主：分支命名（按改动性质选 `bug-fix` / `feature` / `refactor` / `docs` 前缀，slug 用简洁英文 kebab-case，不需要每次问用户）、任务分支 commit、全套自动化测试下任务分支 → develop 的合并。
- 停下问用户：无全套自动化测试时的合并前人工测试、develop → main 的一切合并、大改版本号。
- 用户说"改一下 X"时若在 main / develop 上，先按流程签出任务分支，不要在 main / develop 上直接改代码。
- 用户可随时打断或暂停。

> **本项目的门禁实况**：有 vitest 单测（见「Build & Development」），但无 E2E、渲染结果靠真实 Obsidian vault 手测，因此任务分支 → develop 的合并属于"等人工测试通过"一类——至少 build + lint + test 全过，关键功能需在实际 vault 里手测通过。

**已知陷阱：`git rm --cached` 后切分支会丢文件**
`git rm --cached <file>` 只删 index，但切分支会把工作区同步到目标分支状态，若目标分支已无此文件则工作区文件被一并删除（本项目已两次踩坑：CHANGELOG.md、paseo.json）。规避：先不切分支、同分支 commit + merge 完再切；或切前备份、合并后恢复。

## 版本号规范

版本号 `xx.xx.xx.xx`，由低到高：第4段 bug 修复 +1、第3段新功能 +1、第2段重构 +1、第1段大改 +1。
- **仅第1段（大改）** +1 前必须经用户确认，且其余三段清零（如 `1.2.3.4` → `2.0.0.0`）。
- **第2/3段 +1 时低阶位不动**（如 `1.5.3.2` 新增功能 → `1.5.4.2`）。
- 发布时 `git tag` 打标签，格式 `v` + 版本号（如 `v1.2.3.4`）。

> **迁移备注**：当前 `manifest.json` / `versions.json` 仍为三段式 `1.3.1`。下次发布起视为 `1.3.1.0` 按四段式递增——例：bug 修复 → `1.3.1.1`、新功能 → `1.3.2.0`。

## Build & Development

```bash
yarn install    # 安装依赖
yarn dev        # esbuild watch 模式，改动 src/ 自动重建 main.js
yarn build      # 生产构建 = tsc -noEmit + esbuild 压缩，release 前必跑
yarn lint       # eslint（含 obsidianmd 规则）
yarn test       # vitest 单测（tests/）
```

- 产物路径：固定三个——`main.js`（CommonJS bundle，从 `src/main.ts` 打包）、`manifest.json`、`styles.css`，都在插件根目录。
- 验证方式：`yarn test` 跑 vitest 单测（`tests/helpers.test.ts`、`tests/pipeline.test.ts`，覆盖纯函数）+ 在真实 Obsidian vault 里手测渲染效果。
- 通用注意：`yarn dev` 只跑 esbuild 不跑 tsc；类型错误只有 `yarn build` 才会暴露——release 前必跑 build。

## 代码约定

- **`data-code-link-handled` 属性 + `.code-link-processed` CSS class** 标记已被本插件处理过的 embed，防止重复渲染。`onunload` 时会全部清掉。
- **CSS 用插件作用域选择器**：`.code-embed-container button.copy-code-button` 而非裸 `button.copy-code-button`，避免影响其他插件。
- **异步操作用 `.catch()` 记录错误**——不要静默 `void promise` 或吞异常。
- **SSL 跳过是**每请求**的 `rejectUnauthorized: false`**，不改全局 `NODE_TLS_REJECT_UNAUTHORIZED`。
- **`main.ts` 保持极简**：只放生命周期、命令注册、processor 初始化。业务不放这里。
- **`saveSettings()` 后重建 processor**（`initProcessors()`），因此 `supportedExtensions` 可以在 processor 构造时一次性缓存。
- **`applyLineHighlights` 不用 `innerHTML.split("\n")`**：PHP 等 markup-templating 语言的 Prism token span 会跨行，切开会让 DOMParser 重解析乱套。用 DFS 扁平化叶子文本 + class 栈，按 `\n` 切行重建。改行高亮时必须遵守这个约束。
- 测试框架为 **vitest**（跑法 `yarn test`）；单测覆盖 pipeline 与 helpers 的纯函数，渲染层无自动化测试、靠手测。

## 架构说明

**`docs/architecture.md` 是本项目的架构真实来源**——它是通读所有 `src/` 源文件后整理的分层、数据流、已知设计权衡、命名陷阱。改代码前建议先读一遍，尤其是数据流图和"发现的问题"一节。总览在 `architecture.md`，各层细节拆在 `docs/architecture/` 子目录（映射如下）。以下是极简概要，细节以架构文档为准。

**架构文档是活文档，不是一次性快照**。任何改动以下分层结构的 commit，**必须同步更新 `docs/architecture/` 下对应文件**，否则视为不完整：

| 分层 | 对应架构文档 | 触发更新条件 |
|---|---|---|
| `src/main.ts` | `architecture/main.md` | 注册扩展点变化（post-processor / ViewPlugin / `vault.on`） |
| `src/code-embed-processor.ts` | `architecture/processor.md` | 渲染触发路径 / 去重逻辑变化 |
| `src/pipeline/`（`execute.ts`、`range-converter.ts`、`content-resolver.ts`、`resolvers/`、`types.ts`） | `architecture/pipeline.md` | 阶段编排或数据结构变化 |
| `src/fetchers/`（`index.ts` 注册表与各 service 实现） | `architecture/fetchers.md` | 新增/删除/改动远程读源 |
| `src/upload/`（`index.ts` 工厂与各 service 实现） | `architecture/upload.md` | 新增/删除/改动写源 |
| `src/language/`（`base-extractor.ts`、`index.ts` 注册表与各 extractor 子类） | `architecture/language.md` | 新增语言、改模板方法、调整遍历顺序 |
| `src/ui/`（`render/`、`modal/`、`settings/`） | `architecture/ui.md` | 渲染层或交互层结构变化 |
| `src/utils/` | `architecture/utils.md` | 共享工具变化 |
| 设计权衡 / 陷阱 | `architecture/decisions.md` | 新发现的设计陷阱与权衡 |

更新要求：改了哪层就更新该层文档；新增/删除文件要同步更新总览 `architecture.md` 里的"分层依赖图"；发现的新设计陷阱补到 `architecture/decisions.md`。架构文档头部不再绑定具体分支与时点——它们描述的是当前代码库的架构状态。

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

## 已知陷阱与经验教训

按「症状 → 原因 → 规避」记录，新踩的坑持续补充：

- **`git rm --cached` 后切分支丢文件**：症状——`git rm --cached <file>` 后切分支，工作区文件被一并删除。原因——`git rm --cached` 只删 index，切分支会把工作区同步到目标分支状态，目标分支已无此文件时工作区文件被删。规避——`git rm --cached` 后先不切分支，同分支 commit + merge 完再切；或切前 `cp <file> /tmp/<file>.bak`，合并后从备份恢复。（已踩两次：CHANGELOG.md、paseo.json）
- **`local` 服务两边语义相反**：症状——fetchers 与 upload 同用 `serviceType: "local"`，混淆读/写方向报错。原因——`fetchers/local` 用 Node `fs` 读 vault 外目录，`upload/local` 用 Obsidian `vault.create` 写 vault 内。规避——始终明确"读走 fetchers、写走 upload"再选目录。
- **`yarn dev` 不暴露类型错误**：症状——dev 模式一切正常，release 构建 `tsc` 报错。原因——`yarn dev` 只跑 esbuild 不跑 tsc。规避——release 前必跑 `yarn build`。
- **行高亮跨行被切开**：症状——PHP 等 markup-templating 语言高亮错乱。原因——Prism token span 跨行，`innerHTML.split("\n")` 切开让 DOMParser 重解析乱套。规避——`applyLineHighlights` 用 DFS 扁平化叶子文本 + class 栈按 `\n` 切行重建。
- **渲染路径漏做 IPv6 URL 还原**：症状——远程 embed 在部分触发路径下失效。原因——三条渲染路径中某条未走 `processEmbedElement` 公共 seam。规避——任何新渲染入口都必须汇到 `processEmbedElement`，还原逻辑不另起炉灶。
