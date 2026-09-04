# 项目架构梳理

> 本文档是本项目的**架构真实来源**（single source of truth），基于对 `src/` 下所有源文件的通读整理，不是从 CLAUDE.md 或 README 摘抄。
>
> **活文档约定**：本文档不绑定具体分支与时点，描述的是当前代码库的架构状态。任何改动 `pipeline/`、`fetchers/`、`upload/`、`language/`、`ui/` 等分层结构的 commit，**必须同步更新对应分层文档**——具体规则见 `CLAUDE.md` 的"架构说明"一节。

这是一个 Obsidian 插件，扩展了 `![[file.ext]]` 语法：**把外部代码文件（本地 vault / HTTP / 配置化远程服务）作为语法高亮代码块嵌入到笔记中**，并支持 `@symbol` 提取符号段落、`#symbol` 高亮行。

分层从上到下大致是：**Obsidian 生命周期 → embed processor → pipeline → resolvers → fetchers → utils**，另有一条独立的"用户创建/上传代码文件"支线（commands → modal → upload）。

## 分层索引

各层细节在 `architecture/` 子目录，按层/主题一个文件：

| 分层 | 文档 | 触发更新条件 |
|---|---|---|
| `src/main.ts` | [`architecture/main.md`](architecture/main.md) | 注册扩展点、生命周期、设置迁移变化 |
| `src/code-embed-processor.ts` | [`architecture/processor.md`](architecture/processor.md) | 渲染触发路径、去重/竞态逻辑变化 |
| `src/pipeline/` | [`architecture/pipeline.md`](architecture/pipeline.md) | 阶段编排或数据结构变化 |
| `src/fetchers/` | [`architecture/fetchers.md`](architecture/fetchers.md) | 新增/删除/改动远程读源 |
| `src/upload/` | [`architecture/upload.md`](architecture/upload.md) | 新增/删除/改动写源 |
| `src/language/` | [`architecture/language.md`](architecture/language.md) | 新增语言、改模板方法、调整遍历顺序 |
| `src/ui/` | [`architecture/ui.md`](architecture/ui.md) | 渲染层或交互层结构变化 |
| `src/utils/` | [`architecture/utils.md`](architecture/utils.md) | 共享工具变化 |
| 设计权衡 / 陷阱 | [`architecture/decisions.md`](architecture/decisions.md) | 新发现的设计陷阱与权衡 |

更新要求：改了哪层就更新该层文档；新增/删除文件要同步更新下方"分层依赖图"；新陷阱补到 `decisions.md`。

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
                       processFile(...)  ── in-flight Map 去重（key=filePath\0symbol\0highlight）
                          │
                          ▼
                       executePipeline(contentResolver, filePath, sourcePath, symbol, hl)
                          │
                          │ ┌─────────────────────────────────────────────────────┐
                          │ │ 阶段 1: ContentResolver.resolve(filePath, sourcePath)│
                          │ │   classifyPath(filePath) → switch 分发              │
                          │ │   "http"  → HttpResolver → readRemoteFile           │
                          │ │                                    └─ dispatchHttpRequest
                          │ │   "alias" → AliasResolver → readFromService         │
                          │ │                                    └─ fetchers/{gh,gl,gitea,webdav,generic,local}
                          │ │   "local" → LocalResolver → vault.read(TFile)       │
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
                          │ │              extractBlock（C 系委托                  │
                          │ │              extractBraceBlockAware）→ 裁尾空行 →    │
                          │ │              prependDecorators                       │
                          │ │   ⇒ LineRange { start:42, end:78 }                   │
                          │ ├─────────────────────────────────────────────────────┤
                          │ │ 阶段 4: sliceContent(content, range, hl, lang)       │
                          │ │   displayContent = content.split("\n").slice(41,78)  │
                          │ │   highlightLines = computeHighlightLines(...)        │
                          │ │   ⇒ SlicedContent { displayContent, highlightLines,  │
                          │ │                     startLine }                      │
                          │ └─────────────────────────────────────────────────────┘
                          │
                          ▼ PipelineResult (success)
                       renderSuccess(app, plugin, ctx)  ← ui/render/code-embed.ts（async）
                          │
                          │ ├─ buildToolbar (open btn + lang/copy btn)
                          │ ├─ MarkdownRenderer.render(```lang\n${content}\n```)
                          │ └─ applyLineHighlights(codeEl, [9..19], startLine)
                          │      → DFS flatten → 按 \n 切行 → 每行 .code-line
                          │        高亮行加 .code-highlight-line
                          ▼
                       targetElement.appendChild(el)
                       + click handler（吞冒泡，按钮除外；全屏聚焦 overlay）

                       最终 DOM：.code-embed-container > toolbar + wrapper > code.language-python
                       其中高亮行套 .code-highlight-line span
```

---

## 分层依赖图

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

---

## 一句话总结

**当前架构是 "薄 processor + 纯函数 pipeline + 双注册表（fetchers/upload）+ 模板方法 language 层"**，主流水线（`main.ts → CodeEmbedProcessor → executePipeline → ContentResolver → fetchers`）非常清晰。去重（inFlight key 含 symbol）、竞态防护（renderTokens）、路径分类（classifyPath）、字符串/注释感知提取（extractBraceBlockAware）等修复都已收口在对应层。
