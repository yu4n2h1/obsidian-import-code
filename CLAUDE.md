# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development

```bash
npm install          # Install dependencies
npm run dev          # Watch mode — rebuilds main.js on source changes
npm run build        # Production build — type-check + minified bundle
npm run lint         # Run eslint
```

The plugin's built artifact is `main.js` (CommonJS bundle from `src/main.ts` via esbuild). `main.js`, `manifest.json`, and `styles.css` are the release artifacts — all three live at the plugin root.

## Architecture

**Entry point**: `src/main.ts` → `importCode` class (extends `Plugin`). The plugin embeds external code files referenced via Obsidian's `![[file.ext]]` syntax, rendering them as syntax-highlighted code blocks.

**Core processing pipeline** (`src/file-processor.ts`):
`FileProcessor` is an abstract base class with a template method `processFile(src, el, sourcePath)`:
1. Read file content (`readFile` — handles local files via `getFirstLinkpathDest` + HTTP URLs via `requestUrl`)
2. Transform content (`processContent` — abstract)
3. Render into DOM (`render` — abstract)

`CodeEmbedProcessor` (`src/code-embed-processor.ts`) extends `FileProcessor`: renders code as a fenced code block using Obsidian's `MarkdownRenderer.render()`, wrapped in a container with a toolbar (open-file button + copy-to-clipboard button).

**Processor dispatch**: `main.ts` maintains a `fileProcessorMap` (currently one entry: `"code"` → `CodeEmbedProcessor`). The `getProcessor(filePath)` method checks if the file extension is in the user's supported-extensions list and returns the matching processor.

**Two render paths**:
- **Reading mode**: `registerMarkdownPostProcessor` — walks `.internal-embed` elements in rendered HTML
- **Live Preview / Edit mode**: CodeMirror `ViewPlugin` — walks `.internal-embed` elements in `editorView.dom`, re-processes on `docChanged` / `viewportChanged`

**Auto-refresh**: `vault.on("modify")` listener (300ms debounce) re-processes matching embedded code blocks in all open Markdown views.

**File creation**: `src/modal.ts` (`FileModal`) — opened via the "插入嵌入代码" command (`create-code-file`). Creates a new code file in a configurable storage path (absolute or relative to current note) and inserts a `![[...]]` embed link. Supports MD5-hash-based and content-based file naming.

**Settings** (`src/settings.ts`):
- `codeEmbedEnabled` — toggle on/off
- `codeFileExtensions` — comma-separated list of supported extensions
- `storagePathType` — `"absolute"` or `"relative"` for new file creation
- `fileNameStrategy` — `"md5"` or `"content"` for naming newly created files

**Utilities** (`src/utils.ts`): Extension-to-language mapping for syntax highlighting, extension support checks, and a `debounce` helper.

## Key Obsidian APIs Used

- `registerMarkdownPostProcessor` — reading-mode rendering
- `registerEditorExtension` (CodeMirror `ViewPlugin`) — live-preview rendering
- `MarkdownRenderer.render()` — renders markdown string into a DOM element
- `app.metadataCache.getFirstLinkpathDest()` — resolve wiki-link paths to `TFile`
- `app.vault.on("modify")` — file change detection
- `app.workspace.openLinkText()` — open a file from a link path
- `requestUrl` — fetch remote HTTP URLs (for URL-based embeds)
- `registerEvent`, `addCommand`, `addSettingTab` — standard plugin lifecycle

## Code Style Notes

- The codebase uses Chinese comments and some Chinese UI strings.
- The `data-code-link-handled` attribute and `.code-link-processed` CSS class mark elements already handled by the plugin to prevent double-processing.
- The plugin explicitly clears embed content and re-renders on `saveSettings()` to ensure setting changes take immediate effect.
