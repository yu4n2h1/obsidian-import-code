# 发现的问题与设计权衡

> 架构总览见 [`docs/architecture.md`](../architecture.md)。新发现的设计陷阱与权衡补在这里。

## ✅ 已清理：死代码 `src/ui/renderer/code-embed.ts`

- 这是**旧版 `CodeEmbedProcessor` 类的复本**，还在 import 4 个 pipeline 文件：`../../pipeline/file-reader`、`../../pipeline/view-renderer`、`../../pipeline/link-router`、`../../pipeline/symbol-converter`。
- 而这四个文件在 git status 里都是 `D`（已删除）。也就是说，**如果 TypeScript 走进这个文件，编译一定 fail**。它当时能存活，是因为**没有任何地方 `import` 它**（grep 过整个 src/，确认零引用）——`main.ts` import 的是 `./code-embed-processor`（根 src/ 下的新版）。
- **本次整理已 `rm` 掉此文件，并 `rmdir` 掉空目录 `ui/renderer/`**。`yarn build` 与 `yarn lint` 均通过。

## 🟡 目录命名与职责有一处轻微重叠

- `ui/render/code-embed.ts` 是**渲染层函数**（`renderSuccess` 为 async、`renderError` 带可选 Retry），OK。
- `code-embed-processor.ts` 放在 `src/` 根下，不在 `src/ui/` 也不在 `src/pipeline/`。这个位置其实合理——它是"协调器"，跨越 UI 层与 pipeline 层——但可以考虑挪到 `src/pipeline/processor.ts` 或 `src/embed/processor.ts` 让分层更明显。

## 🟡 声明式设置容器的 CSS 不能使用后代选择器

- Obsidian 1.13+ 在 `getSettingDefinitions()` 返回非空数组时跳过 `display()`。复杂设置页通过 `render` 回调把旧的表单 builder 放在外层 `Setting.controlEl` 中。
- `.code-import-definition-panel` 标记的是这个外层容器；若用 `.code-import-definition-panel .setting-item-info` 或 `.setting-item-control`，会连带匹配嵌套 builder 生成的每个真实设置行，导致字段名称/说明被隐藏或控件布局被覆盖。
- 对外层行的样式应限定为直接子元素（`.code-import-definition-panel > .setting-item-info` / `.setting-item-control`），让内部 `Setting` 保持 Obsidian 默认样式。

## ✅ 已解决：`isRemoteUrl / isAliasPath` 两处重复判断 → 抽 `classifyPath`

- 旧状：`code-embed-processor.isProcessingAllowed(filePath)` 作守卫、`ContentResolver.resolve()` 作路由，两处各写一遍 `isRemoteUrl / isAliasPath` if/else 链，形状重复。
- 现在：`utils/helpers.ts` 的 `classifyPath(filePath): PathMode` 把 `"http" | "alias" | "local"` 分类收拢为**一个谓词**，守卫与路由两处共用，重复已消除。

## 🟢 分层整体是干净的（没循环依赖）

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

## 🟢 fetchers 与 uploads 的"平行结构"是好设计

两个模块共享 `RemoteServiceConfig` 但**类型互相独立**（`RemoteServiceType` vs `UploadServiceType`）。这是正确的建模：读端有 6 种源，写端只有 3 种，不该强行合并。具体的读写非对称（github 只写 gist、gitlab/gitea/generic 只读）在 upload 文档的表格里列过；`webdav` 是唯一读写都对称的服务，两边共享 `buildAuthHeader` 模式但没提取到公共函数——**这是可以再抽的一个小重复**（Basic vs Bearer 二分派几乎逐字一样）。

另一个**隐藏踩坑点**：`serviceType: "local"` 在两边都存在但语义完全不同（Node fs 读 vault 外 vs Obsidian vault 内写），这个在 fetchers 文档里已标 ⚠️ 提醒。是命名冲突而非设计错误，但如果哪天想把 fetchers 和 uploads 合并到一个统一注册表，得先给这两个 `"local"` 重命名。

## 🟢 请求去重 + 竞态防护 + IPv6 还原 + IsAllowed 的收口点

`code-embed-processor.ts` 的注释里明确写了几处收口决策：

- `resolveEmbedSrc` 集中做 IPv6 还原（还原后重解析一次），因为历史上"某条路径漏做"过。
- `processEmbedElement` 是 new-embed 与 modify 事件的共同 seam。
- `inFlight` map 复用 Promise——key 为 `filePath\0symbol\0highlight`，避免同一 embed 被并发抓取多次，同时同文件不同符号各自独立。
- `renderTokens`（WeakMap）做异步竞态防护——旧渲染完成后读到 token 变化就丢弃结果，防止 modify 重入产生孤儿 DOM。

这些都是重构里做对的地方。

## 🟢 语言层的模板方法

`BaseExtractor` 的模板方法（`stripComments → findDefLine → extractBlock → prependDecorators`）+ registry 让加一门新语言只需要新增一个文件、在 `index.ts` 数组里塞一个实例，完全隔离。这个抽象层次拿捏得很稳。
