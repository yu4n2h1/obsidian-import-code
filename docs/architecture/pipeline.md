# Pipeline：`src/pipeline/`

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

被明确重构成**"一个协调函数 + 一堆纯函数/纯类"**的架构。`execute.ts` 里的 `executePipeline` 就是 30 行代码，把整条流水线拧在一起：

```
contentResolver.resolve(filePath, sourcePath)   // 阶段 1：拿内容 + 语言
        ↓ ResolvedContent { content, language, filePath, sourceMode }
classifyTargets(symbolName, highlightSpec)      // 阶段 2：@ 与 # 分别 → Target
        ↓ TargetResult { display, highlight }
computeDisplayRanges(display, content, language) // 阶段 3：display target → LineRange[]（多匹配语义）
        ↓ LineRange[]（单匹配时为单元素数组）
sliceContent(content, ranges, highlight, lang)  // 阶段 4：逐区间切内容 + 空行分隔 + 高亮索引
        ↓ SlicedContent { displayContent, highlightLines[], startLine, lineNumbers? }
return { success:true, file, slice }            // 交给 renderSuccess()
```

拆解如下：

- **`types.ts`**：`SourceMode = "http" | "alias" | "local"`、`Target` 是 discriminated union（`symbol` 或 `line`）、`PipelineResult` 是 success/error 的 tagged union；另含渲染输入类型 `RenderOptions`（`showLineNumbers / foldMode / foldThreshold / foldPreviewLines / foldExpandedLines / wrapLongLines`）与 `RenderContext`（`file / slice / sourcePath / options`）。
- **`content-resolver.ts`**：一个薄薄的分发器**类**（不是函数），构造时 new 出 3 个 resolver 实例并持有，`resolve()` 里用 `classifyPath(filePath)` + switch 三分支（`"http" → HttpResolver`、`"alias" → AliasResolver`、`"local" → LocalResolver`）。三个 resolver 实例只创建一次、复用。`classifyPath` 同时被 `code-embed-processor.isProcessingAllowed()` 用作守卫——**同一谓词路由 + 守卫共用**，不再有重复判断。
- **`resolvers/http-resolver.ts`**：直接 `readRemoteFile(url, skipSsl)`（fetchers/index），返回 `{content, language, filePath, sourceMode: "http"}`。
- **`resolvers/alias-resolver.ts`**：`parseAliasPath()` 拆 `alias:path`；`settings.remoteSources[alias]` 拿配置；`readFromService(serviceType, config, path, skipSsl)`（fetchers/index）。
- **`resolvers/local-resolver.ts`**：`app.metadataCache.getFirstLinkpathDest(filePath, sourcePath)` → `TFile` → `vault.read()`。
- **`target-resolver.ts`**：`resolveTarget(raw)` 只做一件事：`parseLineRange` 匹配到就是 `line`，非空字符串就是 `symbol`，空就是 `null`。`classifyTargets` 里注释解释得很清楚："# 不提升为 @"，两个独立解析，否则 `#symbol` 会退化成提取。
- **`range-converter.ts`**：`computeDisplayRanges`、`computeHighlightLines`、`sliceContent`。`computeDisplayRanges` 返回 `LineRange[]`——symbol 目标调 `findSymbolLineRanges`（多匹配语义，HTML CSS 选择器命中多个元素时返回多区间，其余语言默认单元素数组）；**找不到 symbol 时 throw** `Symbol "..." not found`，被 `executePipeline` 的 try/catch 兜底成 `{success:false, error}`。`sliceContent` 会 `split("\n")` 出行，逐区间切出显示内容后拼接——**区间之间插入一个空行分隔**，同时产出 `lineNumbers: (number|null)[]` 记录每条展示行的源文件真实行号（分隔空行为 `null`）；单区间时省略 `lineNumbers`（与 `startLine + i` 等价，保持旧 shape），多区间时行号跳跃保留（如 `3, 12, 40`）。再对显示内容里的 highlight 目标算 0-based 索引数组——`#` 行号语义**相对于拼接后的展示内容**；symbol 高亮会把 symbol 的所有匹配区间全部高亮。
