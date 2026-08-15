# Commands

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

`commands/insert-code.ts` 是两个薄 factory：

- `createInsertCodeCallback(app, settings, refStore)` → `(editor) => new FileModal(...)`，`onSubmit` 里替换选区为 wiki link 并 `saveLastFileReference`。
- `createEditLastCodeCallback(app, settings, refStore)` → 读上次 ref（无上次引用时 `Notice("No code file created yet…")`），`new EditLinkModal(...)`，`onSubmit` 里替换选区 + 更新 ref 的 `symbolName / highlightSpec / timestamp`。

`refStore` 参数只要求 `{loadLastFileReference, saveLastFileReference}` —— 又是一个刻意收窄依赖的例子。
