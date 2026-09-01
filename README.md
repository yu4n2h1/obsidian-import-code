# Import Code

[中文文档 (Chinese)](README.zh-CN.md)

Embed local code files or files from remote repositories directly into your Obsidian notes, with syntax highlighting, symbol and line-range extraction, line highlighting, and zero-config references to multi-platform remote sources (GitHub, GitLab, Gitea, WebDAV, Generic URL).

## Features

### Embedding & Rendering

- **Code embeds** - `![[file.ext]]` embeds a local code file; `![[alias:path/file.ext]]` embeds a remote one
- **Symbol extraction** - `![[file.ext@functionName]]` extracts a specific function/class/method (supports brace languages like JS/TS/Java/C/Go/Rust, and indentation languages like Python/Ruby/YAML)
- **Line range extraction** - `![[file.ext@10-30]]` extracts a line range; `@5` extracts a single line
- **Line highlighting** - `![[file.ext#5-10]]` highlights specific lines in the rendered result; combinable with `@`
- **HTML element extraction** - `![[file.html@.container]]` extracts an HTML element via a CSS selector
- **Syntax highlighting** - language auto-detected from file extension, rendered through Obsidian's built-in MarkdownRenderer
- **Line numbers** - optionally show real source-file line numbers beside the code block (offset-aware for `@` extraction)
- **Code folding** - blocks exceeding a threshold fold automatically, scrollable while collapsed, preview lines configurable
- **Long line wrapping** - optionally wrap overly long lines (default: horizontal scroll)
- **Loading skeleton** - pulsing placeholder while remote/alias content is fetched

### Remote & Upload

- **Remote source aliases** - pre-configure remote services in settings (GitHub / GitLab / Gitea / WebDAV / Generic URL / Local Directory) and reference them by alias instead of typing full URLs every time
- **Upload sources** - when creating a code file from the clipboard, upload it to Local vault / WebDAV / GitHub Gist with an embed link generated automatically
- **SSL skip verification** - supports HTTPS servers with self-signed/expired certificates (desktop only), with startup diagnostics and graceful degradation

### Interaction

- **Toolbar** - each embed block has "open source file" and "copy code" buttons (with language tag) in the top-right corner; oversized blocks also get an expand/collapse button
- **Dual mode support** - works in both Reading view (MarkdownPostProcessor) and Live Preview (CodeMirror ViewPlugin)
- **Auto refresh** - local file changes trigger re-render automatically (300ms debounce)
- **Insert code file** - create a code file from clipboard content and insert an embed link, with automatic language detection
- **Re-reference** - quickly re-reference the last inserted code file, with adjustable extraction and highlight ranges

## Installation

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest Release
2. Put them in `<vault>/.obsidian/plugins/import-code/`
3. Reload Obsidian and enable the plugin in **Settings -> Community plugins**

### Build from source

```bash
git clone https://github.com/yu4n2h1/obsidian-import-code.git
cd obsidian-import-code
yarn install
yarn build
```

## Usage

### Basic embeds

```markdown
![[src/utils.ts]]
![[config.json]]
![[scripts/deploy.sh]]
```

### Symbol extraction (`@`)

```markdown
![[src/utils.ts@parseConfig]]
![[models/user.py@UserClass]]
![[lib/helper.rs@process_data]]
```

### Line ranges (`@` with numbers)

```markdown
![[src/utils.ts@10-30]]
![[data/schema.sql@5]]
```

### Line highlighting (`#`)

```markdown
![[src/app.ts#5-10]]
![[src/main.ts@init#5-12]]
```

### HTML element extraction (`@` with a CSS selector)

For `.html` files, `@` accepts a CSS selector to extract a specific element:

```markdown
![[template.html@.container]]
![[page.html@[id="main"]]]
![[layout.html@div.content]]
![[index.html@section > p]]
```

| Selector example | Extracted content |
|------------------|-------------------|
| `.container` | the element with `class="container"` |
| `[id="main"]` | the element with `id="main"` |
| `div.content` | the `<div class="content">` |
| `nav > a` | `<a>` elements directly under `<nav>` |

> **Note**: since `#` is already used as the highlight separator in embed syntax (e.g. `#5-10`), use the attribute selector `[id="xxx"]` instead of the ID selector `#xxx`.

Combined with line highlighting:

```markdown
![[page.html@[id="main"]#5-10]]
```

### Remote URL (direct link)

```markdown
![[https://raw.githubusercontent.com/user/repo/main/src/example.py]]
```

### Remote source aliases

First configure a remote source in **Settings -> Remote Sources**, for example:

| Field | Example value |
|-------|---------------|
| Alias | `Code` |
| Service type | `Gitea` (or `GitHub` / `GitLab` / `WebDAV` / `Generic URL` / `Local Directory`) |
| URL | `https://gitea.example.com` |
| Token | `your-access-token` (optional, for private repos) |
| Repository | `owner/repo` (required for Gitea/GitHub/GitLab) |
| Branch | `main` |
| Path | `PYTHON` (optional, base path prefix) |

Then reference it by alias:

```markdown
![[Code:PYTHON/demos/crawler/federated_learning.py]]
![[Code:src/lib/helper.py@MyClass#10-20]]
```

> When `Path` is configured, embed paths are automatically appended to the base path.

### Commands

| Command | Description |
|---------|-------------|
| **Insert embed code** | Reads code from the clipboard, detects the language, uploads it to the configured Upload Source, and inserts `![[...]]` |
| **Re-reference code file** | Loads the last inserted code and re-references it with adjustable extraction/highlight ranges |

## Settings

The settings page has 4 tabs:

### Embed & Storage

| Setting | Description | Default |
|---------|-------------|---------|
| Enable code embed | Toggle the code embed feature | Enabled |
| Enable remote code embed | Allow embedding remote code | Enabled |
| Skip SSL certificate verification | Skip HTTPS certificate verification (desktop only) | Disabled |
| Show line numbers | Show line numbers beside the code block (real source-file line numbers) | Disabled |
| Auto-fold threshold | Fold blocks exceeding this many lines; 0 = never fold | 50 |
| Folded preview lines | Lines shown while folded; extra content is scrollable | 10 |
| Wrap long lines | Wrap overly long lines instead of horizontal scrolling | Disabled |
| File name strategy | `hash` (SHA256 content hash) / `custom` / `auto` (content-based) | `hash` |

### File Extensions

A table for managing supported file extensions. Each entry has a suffix, a display dialect, and an enable toggle. 40+ languages are covered by default.

### Remote Sources

Configured remote read sources. Each alias maps to one service (GitHub / GitLab / Gitea / WebDAV / Generic URL / Local Directory) with URL, Token, Repo, Branch, and Path fields; SSL skip can be configured per source.

### Upload Sources

Configured write sources. The "Insert embed code" command uploads code to the selected source:

| Type | Description | Returned reference |
|------|-------------|--------------------|
| Local | Writes to a directory inside the vault (absolute/relative path) | vault-relative path |
| WebDAV | PUTs to a WebDAV server | upload URL |
| GitHub Gist | Creates a private Gist | raw URL |

Each upload source can be configured to generate wiki links with or without an alias (`![[path|alias]]` vs `![[path]]`).

## Supported file types

Managed in **Settings -> File Extensions**, enabled by default:

`js, ts, py, java, c, cpp, go, rs, rb, php, sh, sql, html, css, json, yaml, xml`

Covering syntax highlighting and symbol extraction for 40+ programming languages.

## Requirements

- Obsidian v0.15.0+
- Remote SSL skip is desktop-only (Electron)

## Development

```bash
yarn install   # install dependencies
yarn dev       # watch mode; rebuilds main.js on src/ changes
yarn build     # production build (type check + minify)
yarn lint      # run eslint
```

`yarn dev` runs esbuild only; type errors only surface with `yarn build`.
