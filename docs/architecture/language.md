# 语言处理层：`src/language/`

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

**模板方法模式 + registry**。看 `base-extractor.ts`：

- `BaseExtractor` 抽象类要求子类提供 `languages: string[]`、`defPatterns: DefPattern[]`、`stripComments(lines)`、`extractBlock(lines, startIdx, defIndent)`。
- 模板方法 `findSymbolLineRange(content, symbolName)`：
  1. `content.split("\n")` → `lines`
  2. `stripComments(lines)` → boolean 数组标注哪些行在注释中（行级 `/* */` 标记，跳过）
  3. `findDefLine(lines, symbolName, commentStripped)` 用 `defPatterns` 逐一 exec，match 的 `nameGroup` 等于 `symbolName` 就是定义行
  4. `extractBlock(lines, startIdx, defIndent)`——**C 风格子类（12 个）委托 base 的 `extractBraceBlockAware`**（见下），Python 走 indent 追踪
  5. 裁尾空行 + `prependDecorators`（默认 no-op，Python 会覆盖处理 `@decorator`）
  6. 返回 1-based `{start, end}`（找不到符号时返回 `null`）
- `extractBraceBlockAware(lines, startIdx)`（`fdf2bb6` 新增）：逐字符数 `{}` 深度时**感知字符串字面量（`"` `'` `` ` ``）与行注释（`//`）**，避免 `console.log("{")` 里的括号误计。边界：无 `{` 的定义返回单行、单行闭合返回单行、`{` 在后续行则收集到闭合行。委托它的 12 个 C 风格子类：`typescript / javascript / c-family / go / rust / java / php / kotlin / swift / csharp / scala / default`（`fdf2bb6` 改 13 文件、-520 行）。`stripComments` 是行级标记，与它的字符级感知互补。
- 另外 base 提供了 `extractFirstSymbolName(content)`（用于 modal 自动命名策略），带一个"排除关键字"的黑名单（`if / while / for / catch / return...`）——用来防止 `if (x)` 里的 `if` 被误认成函数名。
- 语言识别也内聚在 extractor 里：`detectByFirstLine`、`detectByContent`（及 protected `matchShebang`，python/js/bash 等子类复用），`language.ts` 的 `guessExtensionFromContent` 分两阶段（首行 shebang/文档头 → 前 2000 字符启发）遍历所有 extractor。

具体子类 21 个：`python / ruby / yaml / typescript / javascript / java / c-family / go / rust / php / lua / html / bash / perl / xml / sql / json / kotlin / swift / csharp / scala`，另有 `default` 兜底。

`index.ts` 里：

- `allExtractors` 数组的**顺序即语言识别遍历顺序**——注释明确说"TypeScript 必须在 JavaScript 之前"（因为 TS 是 JS 的超集，先匹配到 TS 才能拿到 tsx/interface 等特征）。
- 用 for 循环把 `extractor.languages` 各个语言名注册到 `registry: Map<string, BaseExtractor>`。
- **`DefaultExtractor` 的 `languages = []`**：故意不进 registry，只作为 `registry.get(lang) ?? defaultExtractor` 的 `??` 兜底——用于任何没被显式注册的语言（比如用户在 settings 里自定义了 dialect）。这是有意的设计，不是遗漏。
- 对外暴露 `findSymbolLineRange` 与 `extractFirstSymbolName`，签名与老 `code-extractor.ts` 完全兼容——这是"重构外部签名不变"的策略。

> 🟡 **模块顶层初始化的隐性依赖**：`allExtractors` 是模块顶层 `const`（`new PythonExtractor()` 等 21 次 new），在 `language/index.ts` 被 import 的那一刻就跑完。不构成循环依赖，但对 import 顺序敏感——如果某个 extractor 子类文件在 import 时又引用了 `getAllExtractors`（`language.ts` 里的 `guessExtensionFromContent` 就是这么用的），需要确保子类文件不在自己的顶层调用 `getAllExtractors`。目前所有 extractor 子类都只做类定义、不做顶层调用，所以是安全的。

`language.ts` 只负责编排 `guessExtensionFromContent`。
