# 项目架构梳理（refactor 分支当前状态）

> 本文档基于对 `src/` 下所有源文件的通读整理，不是从 CLAUDE.md 或 README 摘抄。
> 记录时点：`refactor` 分支，未提交状态。

这是一个 Obsidian 插件，扩展了 `![[file.ext]]` 语法：**把外部代码文件（本地 vault / HTTP / 配置化远程服务）作为语法高亮代码块嵌入到笔记中**，并支持 `@symbol` 提取符号段落、`#symbol` 高亮行。

分层从上到下大致是：**Obsidian 生命周期 → embed processor → pipeline → resolvers → fetchers → utils**，另有一条独立的"用户创建/上传代码文件"支线（commands → modal → upload）。

---

## 1. 入口 & 生命周期：`src/main.ts`

`importCode extends Plugin` 是唯一 default export，做四件事：

- **`loadSettings()`**：从磁盘读设置，并**内联两处向后兼容迁移**：
  - `codeFileExtensions` 从旧的逗号分隔字符串迁移为 `ExtensionEntry[]`（`{suffix, dialect, active}`）。
  - 旧顶层字段 `storagePathType / absoluteStoragePath / relativeStoragePath` 迁到新的 `uploadSources.Local.config`。
- **`initProcessors()`**：`new CodeEmbedProcessor(app, settings, this)`。任何 `saveSettings()` 之后都会重建 processor（这也是为什么 `supportedExtensions` 可以在构造时一次性缓存）。
- **注册 4 个 Obsidian 扩展点**：
  1. `addSettingTab(importCodeSettingsTab)`
  2. `addCommand("create-code-file" / "re-reference-last-code")`，回调由 `commands/insert-code.ts` 工厂函数产出
  3. `registerMarkdownPostProcessor` → 阅读模式渲染，调 `codeProcessor.processEmbeds(el, sourcePath)`
  4. `registerEditorExtension(ViewPlugin)` → 实时预览/编辑模式，`update` 里在 `docChanged || viewportChanged` 时用 `setTimeout(50ms)` 再触发一次 `processEmbeds(view.dom, ...)`
- **`vault.on("modify")`** 加了 300ms debounce（`utils/helpers.ts` 的 `debounce`），文件修改后重扫所有已打开 MarkdownView 里带 `.code-link-processed` 的 embed，走 `processEmbedElement(el, sourcePath, predicate)` —— predicate 过滤"是不是这个被改的文件"。
- **`runStartupDiagnostics()`**：如果任何 remote source 开了 `skipSslVerify` 或全局 `remoteSkipSslVerify`，就 eager-load 一次 Node.js `https` 模块，探测是否可用，不可用则 `new Notice(...)` 提示。
- **`onunload()`**：遍历所有 MarkdownView，清掉 `.code-link-processed` 标记和 `data-code-link-handled` 属性、把 embed 元素 `empty()`。

## 2. 核心处理器：`src/code-embed-processor.ts`

这是**从 embed DOM 元素到最终代码块 DOM** 的中央协调器。构造时缓存三件东西：

- `contentResolver: ContentResolver`（pipeline 依赖）
- `supportedExtensions: Set<string>`（来自 `getSupportedExtensions(settings)`）
- `inFlight: Map<filePath, Promise<PipelineResult>>` —— **同一 filePath 的并发请求去重**，Promise 复用；配合 modify 事件时特别有用。

三个公开方法一层套一层：

- `processEmbeds(container, sourcePath)`：`.internal-embed` 全扫，跳过 `.code-link-processed`，逐个交给 `processEmbedElement`。
- `processEmbedElement(el, sourcePath, shouldProcess?)`：**per-element 单一入口**。做 `resolveEmbedSrc()`（`parseEmbedSource` + IPv6 还原），可选谓词过滤（modify 用），`isProcessingAllowed()` 守卫，然后调 `processFile()`。注释里明确说 modify 与 new-embed 两条路径必须共用这个 seam，避免历史上"IPv6 还原只在某一路径生效"的 bug。
- `processFile(...)`：先在容器上加 `data-code-link-handled`、`code-link-block`、"Loading..." 占位，然后调 `executePipeline(...)`（带 in-flight 去重），拿到 `PipelineResult`：
  - 成功：`renderSuccess()` 生成 DOM，appendChild，并注册"点击代码块吞掉冒泡、但按钮里冒泡照放"的 handler。
  - 失败：`renderError(result.error)`。

`isProcessingAllowed(filePath)` 是所有守卫的统一入口：查 `codeEmbedEnabled`、扩展名是否在启用列表、是不是 remote/alias（如是则再查 `remoteCodeEmbedEnabled`）。

## 3. Pipeline：`src/pipeline/`

被明确重构成**"一个协调函数 + 一堆纯函数/纯类"**的架构。`execute.ts` 里的 `executePipeline` 就是 30 行代码，把整条流水线拧在一起：

```
contentResolver.resolve(filePath, sourcePath)   // 阶段 1：拿内容 + 语言
        ↓ ResolvedContent { content, language, filePath, sourceMode }
classifyTargets(symbolName, highlightSpec)      // 阶段 2：@ 与 # 分别 → Target
        ↓ TargetResult { display, highlight }
computeDisplayRange(display, content, language) // 阶段 3：display target → 1-based LineRange
        ↓ LineRange { start, end }
sliceContent(content, range, highlight, lang)   // 阶段 4：切内容 + 高亮索引
        ↓ SlicedContent { displayContent, highlightLines[] }
return { success:true, file, slice }            // 交给 renderSuccess()
```

拆解如下：

- **`types.ts`**：`SourceMode = "http" | "alias" | "local"`、`Target` 是 discriminated union（`symbol` 或 `line`）、`PipelineResult` 是 success/error 的 tagged union。
- **`content-resolver.ts`**：一个薄薄的分发器**类**（不是函数），构造时 new 出 3 个 resolver 实例并持有，`resolve()` 里按 `isRemoteUrl → HttpResolver`、`isAliasPath → AliasResolver`、否则 `LocalResolver` 三分支。三个 resolver 实例只创建一次、复用。**注意**：这里的 `isRemoteUrl / isAliasPath` 分类判断和 `code-embed-processor.isProcessingAllowed()` 的判断有轻微重叠——前者用来路由，后者用来守卫（决定是否允许处理），语义上并不重复但形状相似。
- **`resolvers/http-resolver.ts`**：直接 `readRemoteFile(url, skipSsl)`（fetchers/index），返回 `{content, language, filePath, sourceMode: "http"}`。
- **`resolvers/alias-resolver.ts`**：`parseAliasPath()` 拆 `alias:path`；`settings.remoteSources[alias]` 拿配置；`readFromService(serviceType, config, path, skipSsl)`（fetchers/index）。
- **`resolvers/local-resolver.ts`**：`app.metadataCache.getFirstLinkpathDest(filePath, sourcePath)` → `TFile` → `vault.read()`。
- **`target-resolver.ts`**：`resolveTarget(raw)` 只做一件事：`parseLineRange` 匹配到就是 `line`，非空字符串就是 `symbol`，空就是 `null`。`classifyTargets` 里注释解释得很清楚："# 不提升为 @"，两个独立解析，否则 `#symbol` 会退化成提取。
- **`range-converter.ts`**：`computeDisplayRange`、`computeHighlightLines`、`sliceContent`。`sliceContent` 会 `split("\n")` 出行，切出显示内容，再对显示内容里的 highlight 目标算 0-based 索引数组。**注意**：`computeDisplayRange` 的 symbol 分支在找不到时 throw `Symbol "..." not found`，被 `executePipeline` 的 try/catch 兜底成 `{success:false, error}`。

## 4. 数据源抓取层：`src/fetchers/`

设计得非常统一。`types.ts` 定义两个 shape：

```ts
interface RemoteService { serviceType; read(params) → RemoteReadResult }
interface RemoteReadParams { config, filePath, skipSslVerify }
interface RemoteReadResult { success, content?, error? }
```

`index.ts` 有一个 `services: Record<RemoteServiceType, RemoteService>` 注册表，暴露两个 API：

- `readRemoteFile(url, skipSsl)` —— **纯 HTTP GET，走 HttpResolver 用**（不查注册表）。
- `readFromService(serviceType, config, filePath, skipSsl)` —— **走注册表，供 AliasResolver 用**。

6 个具体实现都是纯函数式的 const service 对象：

| 文件 | serviceType | 认证 | URL 构造 | 特殊处理 |
|---|---|---|---|---|
| `github.ts` | `github` | `Authorization: Bearer` | `${api}/repos/${repo}/contents/${encoded}?ref=${branch}` | 响应可能是 base64，用 `decodeBase64Content` |
| `gitlab.ts` | `gitlab` | `PRIVATE-TOKEN` | `${api}/api/v4/projects/${encodeURIComponent(repo)}/repository/files/${encodedPath}?ref=...` | 同上，base64 |
| `gitea.ts` | `gitea` | `Authorization: token` | `${base}/${repo}/raw/branch/${branch}/${encoded}` | raw endpoint，直接 text |
| `webdav.ts` | `webdav` | `Basic user:token` 或 `Bearer token` | `buildServiceUrl(config, filePath)` | 直接 text |
| `generic.ts` | `generic` | `Bearer` if token | 同上 | 直接 text |
| `local-fs.ts` | `local` | — | `path.resolve(baseDir, buildFullPath(config.path, filePath))` | 走 Node `fs.readFileSync`（`getRequire()`） |

三个 URL/路径构造都是 `utils/http-client.ts` 里的 `buildFullPath`、`encodePathSegments`、`normalizeBaseUrl`、`buildServiceUrl` 共享。每个 service 用 `enrichError(err, "XX read failed")` 把 catch 到的异常统一封装成 `RemoteReadResult`。

> ⚠️ **命名陷阱**：这里的 `serviceType: "local"` 指的是 **Node fs 读 vault 之外的本地目录**（用 `config.url` 作为基路径 + `path.resolve` + `fs.readFileSync`）。它和后文 **`upload/local.ts` 的 `"local"`**（Obsidian `vault.create` 写 vault **之内**的文件）**是完全不同的两件事**——同名但语义相反。read 端穿透到宿主文件系统，write 端锁在 vault 内。踩到会很痛。

## 5. 上传层：`src/upload/`

镜像 fetchers 的 shape，但**类型独立**，因为不是所有远程来源都能上传，反之亦然：

- `UploadServiceType = "local" | "webdav" | "github-gist"`（**local vault、webdav、gist**——注意没有 github/gitlab/gitea/generic，因为 push 一个文件到 repo 得走 API + 提交流程，比 read 复杂得多）。
- `UploadService.upload(params) → UploadResult { success, reference?, error? }`。`reference` 是最终写入的路径或 URL，会被回填到编辑器里当 wiki link。

> **读写非对称一览**（`RemoteServiceType` vs `UploadServiceType`）：
>
> | 服务 | Fetch (读) | Upload (写) | 备注 |
> |---|:---:|:---:|---|
> | `local` | ✅ 读 vault **外** (Node fs) | ✅ 写 vault **内** (Obsidian vault) | **同名不同义**，见上一节 ⚠️ |
> | `webdav` | ✅ | ✅ | 唯一对称的远程服务 |
> | `github` | ✅ 读 repo contents | ⚠️ 只有 gist (`github-gist`) | 没有向 repo 提交的能力 |
> | `gitlab` | ✅ | ❌ | 只读 |
> | `gitea` | ✅ | ❌ | 只读 |
> | `generic` | ✅ | ❌ | 只读 |
>
> 这种不对称是有意的：读一个文件只需 GET，而向 repo 提交需要处理 tree / commit / SHA 冲突，工作量差一个数量级。当前策略是"能读的都支持，能写的挑几个高价值场景"。
- `index.ts`：
  - `createUploadServices(app)` 工厂——本地服务需要 `App` 做 `vault.createFolder / create`，所以是运行时装配的 map。
  - `withUploadError(context, fn)` 是统一异常包装（`enrichError`），用 switch/case 而非 Record 索引避开 `noUncheckedIndexedAccess` 的类型断言。
- 三个实现：
  - `local.ts`：`normalizePath(folderPath/fileName)`，需要时 `vault.createFolder`，**文件存在时不覆盖**（幂等），返回 vault-relative path。
  - `webdav.ts`：`PUT` 到 `buildServiceUrl(config, fileName)`。
  - `github-gist.ts`：`POST /gists`，`public:false`，从响应里挑 `files[fileName].raw_url` 作为 reference。

上传由 `ui/modal/modal.ts`（`FileModal`）触发；`commands/insert-code.ts` 拿到 `EmbedLinkInfo` 后 `editor.replaceSelection(![[linkPath|displayName]])` 并 `saveLastFileReference(...)`。

## 6. 语言处理层：`src/language/`

**模板方法模式 + registry**。看 `base-extractor.ts`：

- `BaseExtractor` 抽象类要求子类提供 `languages: string[]`、`defPatterns: DefPattern[]`、`stripComments(lines)`、`extractBlock(lines, startIdx, defIndent)`。
- 模板方法 `findSymbolLineRange(content, symbolName)`：
  1. `content.split("\n")` → `lines`
  2. `stripComments(lines)` → boolean 数组标注哪些行在注释中（跳过）
  3. `findDefLine(lines, symbolName, commentStripped)` 用 `defPatterns` 逐一 exec，match 的 `nameGroup` 等于 `symbolName` 就是定义行
  4. `extractBlock(lines, startIdx, defIndent)` 子类各显神通（花括号计数 / indent 追踪）
  5. 裁尾空行 + `prependDecorators`（默认 no-op，Python 会覆盖处理 `@decorator`）
  6. 返回 1-based `{start, end}`
- 另外 base 提供了 `extractFirstSymbolName(content)`（用于 modal 自动命名策略），带一个"排除关键字"的黑名单（`if / while / for / catch / return...`）——用来防止 `if (x)` 里的 `if` 被误认成函数名。
- 语言识别也内聚在 extractor 里：`detectByFirstLine`、`detectByContent`，`language.ts` 的 `guessExtensionFromContent` 分两阶段（首行 shebang/文档头 → 前 2000 字符启发）遍历所有 extractor。

具体子类 21 个：`python / ruby / yaml / typescript / javascript / java / c-family / go / rust / php / lua / html / bash / perl / xml / sql / json / kotlin / swift / csharp / scala`，另有 `default` 兜底。

`index.ts` 里：

- `allExtractors` 数组的**顺序即语言识别遍历顺序**——注释明确说"TypeScript 必须在 JavaScript 之前"（因为 TS 是 JS 的超集，先匹配到 TS 才能拿到 tsx/interface 等特征）。
- 用 for 循环把 `extractor.languages` 各个语言名注册到 `registry: Map<string, BaseExtractor>`。
- **`DefaultExtractor` 的 `languages = []`**：故意不进 registry，只作为 `registry.get(lang) ?? defaultExtractor` 的 `??` 兜底——用于任何没被显式注册的语言（比如用户在 settings 里自定义了 dialect）。这是有意的设计，不是遗漏。
- 对外暴露 `findSymbolLineRange` 与 `extractFirstSymbolName`，签名与老 `code-extractor.ts` 完全兼容——这是"重构外部签名不变"的策略。

> 🟡 **模块顶层初始化的隐性依赖**：`allExtractors` 是模块顶层 `const`（`new PythonExtractor()` 等 21 次 new），在 `language/index.ts` 被 import 的那一刻就跑完。不构成循环依赖，但对 import 顺序敏感——如果某个 extractor 子类文件在 import 时又引用了 `getAllExtractors`（`language.ts` 里的 `guessExtensionFromContent` 就是这么用的），需要确保子类文件不在自己的顶层调用 `getAllExtractors`。目前所有 extractor 子类都只做类定义、不做顶层调用，所以是安全的。

`language.ts` 只负责编排 `guessExtensionFromContent`。

## 7. UI 层：`src/ui/`

三块子目录：

### `ui/render/code-embed.ts`

**当前使用的渲染层**，导出两个纯函数：

- `renderSuccess(app, plugin, ctx: RenderContext): HTMLElement`——组装 `.code-embed-container`，含 toolbar（open 按钮 + 语言 chip/复制按钮）、`.code-embed-wrapper` 用 `MarkdownRenderer.render(app, \`\`\`\`\${lang}\n...\n\`\`\`)` 交给 Obsidian 生成 Prism 高亮。
  - **`sourceMode` 分支**：`local` 走 `app.workspace.openLinkText`，`http/alias` 走 `window.open(url, "_blank")`。
  - **`applyLineHighlights(codeEl, highlightLines)`**：这段有一大段注释解释为什么不能用 `innerHTML.split("\n")`——因为 PHP 这类 markup-templating 的 Prism token span 会跨行，切开 span 会让 DOMParser 重解析乱套。改为 DFS 扁平化叶子文本节点（每个节点带 class 栈），按 `\n` 切分成逻辑行重建，每行包一个 `.code-line`，命中的加 `.code-highlight-line`。
- `renderError(message): HTMLElement`——`.code-link-error` 显示 `Error: xxx`。

### `ui/renderer/code-embed.ts` — 已删除 ✅

历史上这里是一份旧版 `CodeEmbedProcessor` 的复本，import 了四个不再存在的 pipeline 文件（`file-reader / view-renderer / link-router / symbol-converter`），全项目零引用。已在本次整理时随死代码清理一并 `rm`，连同空目录 `ui/renderer/` 一起移除。`yarn build`（含 `tsc -noEmit`）与 `yarn lint` 均通过。

### `ui/modal/`

- `modal.ts`（687 行）：`FileModal`——用户在编辑器里触发"Insert embed code"命令时打开。做粘贴板自动填充、语言检测（`guessExtensionFromContent`）、文件名策略（hash / custom / auto）、选择 upload source（local vault / webdav / github-gist）、调用 `uploadToService(...)`、最后回调 `onSubmit(EmbedLinkInfo)`。
  - 内部有**两种 UI 分支**：
    - **别名模式**（默认）：`settings.uploadSources` 非空时，下拉选一个已配置的别名。
    - **回退模式**（L124–192）：`uploadSources` 为空时，UI 退化到手动选 local / github-gist / webdav-from-remoteSources。因为 `DEFAULT_SETTINGS.uploadSources` 内置 `Local` 别名，**正常路径下永远走别名模式**——回退模式只是给用户手动把 uploadSources 清空的兼容分支，不是重构残留。
- `edit-link-modal.ts`（199 行）：`EditLinkModal`——用户触发"再次引用代码文件"命令时打开，只允许编辑 `@symbolName` 与 `#highlightSpec` 字段，其它信息（存储方式、路径、文件名、扩展名）只读展示，带**实时代码预览**和**实时链接预览**。

### `ui/settings/`

`settings.ts` 是 tab bar 容器（4 个 tab 按钮），把 panel 分别交给四个 build 函数：

- `embed-storage-tab.ts` — 全局开关（codeEmbedEnabled / remoteCodeEmbedEnabled / remoteSkipSslVerify）与文件名策略
- `extensions-tab.ts` — `ExtensionEntry[]` 的增删改（suffix / dialect / active toggle）
- `remote-sources-tab.ts` — 配置化的读源（GitHub/GitLab/Gitea/WebDAV/Generic/Local），alias-key 型 map
- `upload-sources-tab.ts` — 配置化的写源（Local vault / WebDAV / GitHub Gist）
- `remote-config-fields.ts` — 前两个 tab 共享的 URL/Token/repo/branch/path 表单字段构造
- `rebuild.ts`（只有 17 行）— 抽出的 `rebuildSettingsSection` 公共函数，"消除重复代码"（来自最近的 commit message）

**`SettingsProvider` 接口**（`types.ts` 末尾）：暴露 `{ settings, saveSettings, resetMarkdownViews }`，让 settings tab 不直接依赖 `main.ts` 的 `importCode` 类，切断了 settings ↔ main 的循环依赖。所有 tab 的 build 函数都以 `SettingsProvider` 为参数。

## 8. Utils

- `helpers.ts`：**embed 解析全套**（`parseEmbedSource` 用 `lastIndexOf("#")` 和 `lastIndexOf("@")` 切分；`isRemoteUrl / isAliasPath / parseAliasPath`；IPv6 URL 还原 `isPartialIpv6Url / tryRestoreIpv6Url`——从 embed 下一个 sibling text node 里把被截断的 `]` 部分捞回来，因为 Obsidian 会把 IPv6 URL 里的 `[::1]` 当成 wiki link 语法切掉）；`LineRange` 与 `parseLineRange`；`debounce`；`getSupportedExtensions`。这是**领域工具集合**。
- `http-client.ts`：**HTTP 抽象**。核心 `dispatchHttpRequest(options)`——如果 `skipSslVerify && https://`，走 Node `https.request` 手写实现（含 5 次重定向支持、301/302 改 GET、307/308 保留方法、`User-Agent: Obsidian-Code-Embed-Plugin`）；否则走 Obsidian `requestUrl`。SSL 错误关键字检测（`isSslError`）会给用户加提示"你可以在设置里开 skip SSL"。`getRequire()` 有三级 fallback（`window.require` → `globalThis.require` → 间接 eval），并针对 Electron 环境做检查。共享工具：`buildFullPath / encodePathSegments / normalizeBaseUrl / decodeBase64Content / buildServiceUrl / enrichError`——被所有 fetchers 与 uploaders 复用。
- `language.ts`：只有 12 行，`getLanguageFromPath(path, settings)` 从 `codeFileExtensions` 里查扩展名对应的 dialect；re-export `extractFirstSymbolName` 与 `guessExtensionFromContent` 让上层统一从 utils 拿，不用直接依赖 `../language/`。
- `constants.ts`：**只剩 `SERVICE_LABELS`**——`EXTENSION_TO_LANGUAGE` 常量已按最近的 commit（`ab242f4`）删除，改用 settings 里的 `dialect` 字段。

## 9. Commands

`commands/insert-code.ts` 是两个薄 factory：

- `createInsertCodeCallback(app, settings, refStore)` → `(editor) => new FileModal(...)`，`onSubmit` 里替换选区为 wiki link 并 `saveLastFileReference`。
- `createEditLastCodeCallback(app, settings, refStore)` → 读上次 ref，`new EditLinkModal(...)`，`onSubmit` 里替换选区 + 更新 ref 的 `symbolName / highlightSpec / timestamp`。

`refStore` 参数只要求 `{loadLastFileReference, saveLastFileReference}` —— 又是一个刻意收窄依赖的例子。

---

## 数据流图：从 `![[file.ext@symbol|alias]]` 到最终 DOM

```
用户在笔记里写 ![[file.py@my_func#10-20|示例]]
        │
        ├──【阅读模式】obsidian post-processor
        │          → importCode.registerMarkdownPostProcessor
        │                              │
        └──【编辑/预览】obsidian CodeMirror
                   → importCode.registerEditorExtension (ViewPlugin.update)
                                             │
                                             ▼
                       codeProcessor.processEmbeds(container, sourcePath)
                                             │
                                             ▼
                       processEmbedElement(el, sourcePath)
                          │
                          │ 1. resolveEmbedSrc(el)
                          │      ├─ parseEmbedSource(src)
                          │      │    → { filePath, symbolName:"my_func", highlightSpec:"10-20" }
                          │      └─ isPartialIpv6Url? tryRestoreIpv6Url(...)   (edge case)
                          │
                          │ 2. isProcessingAllowed(filePath)
                          │      查 codeEmbedEnabled / supportedExtensions
                          │      查 remoteCodeEmbedEnabled (if remote/alias)
                          │
                          │ 3. el.addClass("code-link-processed") + empty()
                          │
                          ▼
                       processFile(...)  ── in-flight Map 去重
                          │
                          ▼
                       executePipeline(contentResolver, filePath, sourcePath, symbol, hl)
                          │
                          │ ┌─────────────────────────────────────────────────────┐
                          │ │ 阶段 1: ContentResolver.resolve(filePath, sourcePath)│
                          │ │   isRemoteUrl → HttpResolver → readRemoteFile        │
                          │ │                                    └─ dispatchHttpRequest
                          │ │   isAliasPath  → AliasResolver → readFromService     │
                          │ │                                    └─ fetchers/{gh,gl,gitea,webdav,generic,local}
                          │ │   else         → LocalResolver → vault.read(TFile)   │
                          │ │ ⇒ { content, language, filePath, sourceMode }        │
                          │ ├─────────────────────────────────────────────────────┤
                          │ │ 阶段 2: classifyTargets("my_func", "10-20")          │
                          │ │   display  = { type:"symbol", name:"my_func" }       │
                          │ │   highlight= { type:"line", lineRange:{start:10,end:20}}
                          │ ├─────────────────────────────────────────────────────┤
                          │ │ 阶段 3: computeDisplayRange(display, content, lang)  │
                          │ │   → findSymbolLineRange(content,"my_func","python")  │
                          │ │       → registry.get("python").findSymbolLineRange   │
                          │ │           → BaseExtractor 模板方法：                  │
                          │ │              stripComments → findDefLine →           │
                          │ │              extractBlock → prependDecorators        │
                          │ │   ⇒ LineRange { start:42, end:78 }                   │
                          │ ├─────────────────────────────────────────────────────┤
                          │ │ 阶段 4: sliceContent(content, range, hl, lang)       │
                          │ │   displayContent = content.split("\n").slice(41,78)  │
                          │ │   highlightLines = computeHighlightLines(...)        │
                          │ │   ⇒ SlicedContent { displayContent, highlightLines } │
                          │ └─────────────────────────────────────────────────────┘
                          │
                          ▼ PipelineResult (success)
                       renderSuccess(app, plugin, ctx)  ← ui/render/code-embed.ts
                          │
                          │ ├─ buildToolbar (open btn + lang/copy btn)
                          │ ├─ MarkdownRenderer.render(```lang\n${content}\n```)
                          │ └─ applyLineHighlights(codeEl, [9..19])
                          │      → DFS flatten → 按 \n 切行 → 每行 .code-line
                          │        高亮行加 .code-highlight-line
                          ▼
                       targetElement.appendChild(el)
                       + click handler（吞冒泡，按钮除外）

                       最终 DOM：.code-embed-container > toolbar + wrapper > code.language-python
                       其中高亮行套 .code-highlight-line span
```

---

## 发现的问题（refactor 未清理干净的地方）

### ✅ 已清理：死代码 `src/ui/renderer/code-embed.ts`

- 这是**旧版 `CodeEmbedProcessor` 类的复本**，还在 import 4 个 pipeline 文件：`../../pipeline/file-reader`、`../../pipeline/view-renderer`、`../../pipeline/link-router`、`../../pipeline/symbol-converter`。
- 而这四个文件在 git status 里都是 `D`（已删除）。也就是说，**如果 TypeScript 走进这个文件，编译一定 fail**。它当时能存活，是因为**没有任何地方 `import` 它**（grep 过整个 src/，确认零引用）——`main.ts` import 的是 `./code-embed-processor`（根 src/ 下的新版）。
- **本次整理已 `rm` 掉此文件，并 `rmdir` 掉空目录 `ui/renderer/`**。`yarn build` 与 `yarn lint` 均通过。

### 🟡 目录命名与职责有一处轻微重叠

- `ui/render/code-embed.ts` 是**纯渲染函数**（`renderSuccess / renderError`），OK。
- `code-embed-processor.ts` 放在 `src/` 根下，不在 `src/ui/` 也不在 `src/pipeline/`。这个位置其实合理——它是"协调器"，跨越 UI 层与 pipeline 层——但可以考虑挪到 `src/pipeline/processor.ts` 或 `src/embed/processor.ts` 让分层更明显。

### 🟡 `isRemoteUrl / isAliasPath` 在两处各判一次

- `code-embed-processor.isProcessingAllowed(filePath)`：用作**守卫**——若是 remote/alias，再查 `remoteCodeEmbedEnabled` 是否为 `"enabled"`；不允许就直接不处理。
- `ContentResolver.resolve(filePath, sourcePath)`：用作**路由**——按同样的谓词把 filePath 分派到 http / alias / local 三个 resolver。

同一个谓词做两件事：守门 vs 分派。语义不完全重复（一个决定"该不该做"、一个决定"怎么做"），但形状上是同一个 if/else if 链。抽一个 `classifyPath(filePath): "http" | "alias" | "local"` 让两处都调用，可以消掉这份视觉重复。不做也没错，是个可选清理。

### 🟢 分层整体是干净的（没循环依赖）

```
main.ts
  ├── code-embed-processor.ts
  │       ├── pipeline/content-resolver.ts
  │       │       └── pipeline/resolvers/{http,alias,local}-resolver.ts
  │       │                     └── fetchers/index.ts → fetchers/{github,gitlab,gitea,webdav,generic,local-fs}
  │       │                                                    └── utils/http-client.ts
  │       ├── pipeline/execute.ts
  │       │       ├── target-resolver.ts
  │       │       └── range-converter.ts → language/index.ts → language/*.ts (BaseExtractor 子类)
  │       └── ui/render/code-embed.ts
  ├── settings.ts → ui/settings/*
  ├── commands/insert-code.ts → ui/modal/{modal, edit-link-modal}.ts
  │                                        └── upload/index.ts → upload/{local,webdav,github-gist}.ts
  │                                                    └── utils/http-client.ts
  └── utils/{helpers, http-client, language}.ts + language/index.ts
```

`utils/language.ts` re-export `language/index.ts` 的两个函数是**为了让 UI 层统一从 `utils/language` 拿"路径→语言"与"内容→扩展名"两组能力**——这是有意为之的 facade，不算重叠。

### 🟢 fetchers 与 uploads 的"平行结构"是好设计

两个模块共享 `RemoteServiceConfig` 但**类型互相独立**（`RemoteServiceType` vs `UploadServiceType`）。这是正确的建模：读端有 6 种源，写端只有 3 种，不该强行合并。具体的读写非对称（github 只写 gist、gitlab/gitea/generic 只读）在第 5 节表格里列过；`webdav` 是唯一读写都对称的服务，两边共享 `buildAuthHeader` 模式但没提取到公共函数——**这是可以再抽的一个小重复**（Basic vs Bearer 二分派几乎逐字一样）。

另一个**隐藏踩坑点**：`serviceType: "local"` 在两边都存在但语义完全不同（Node fs 读 vault 外 vs Obsidian vault 内写），这个在第 4 节尾部已经标 ⚠️ 提醒。是命名冲突而非设计错误，但如果哪天想把 fetchers 和 uploads 合并到一个统一注册表，得先给这两个 `"local"` 重命名。

### 🟢 请求去重 + IPv6 还原 + IsAllowed 的收口点

`code-embed-processor.ts` 的注释里明确写了几处收口决策：

- `resolveEmbedSrc` 集中做 IPv6 还原，因为历史上"某条路径漏做"过。
- `processEmbedElement` 是 new-embed 与 modify 事件的共同 seam。
- `inFlight` map 复用 Promise，避免同一 URL 被并发抓取多次。

这些都是重构里做对的地方。

### 🟢 语言层的模板方法

`BaseExtractor` 的模板方法（`stripComments → findDefLine → extractBlock → prependDecorators`）+ registry 让加一门新语言只需要新增一个文件、在 `index.ts` 数组里塞一个实例，完全隔离。这个抽象层次拿捏得很稳。

---

## 一句话总结

**当前架构是 "薄 processor + 纯函数 pipeline + 双注册表（fetchers/upload）+ 模板方法 language 层"**，主流水线（`main.ts → CodeEmbedProcessor → executePipeline → ContentResolver → fetchers`）非常清晰。原本唯一的死代码 `src/ui/renderer/code-embed.ts` 已随本次整理删除，`yarn build`/`yarn lint` 均干净通过。
