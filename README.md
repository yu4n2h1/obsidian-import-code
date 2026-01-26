# Import Code

An Obsidian plugin that embeds and renders external code files and CSV tables directly in your notes.

## Features

- **Code Embedding**: Embed external code files using Obsidian's internal link syntax `![[file.ext]]`
- **CSV Rendering**: Automatically render CSV files as formatted tables
- **Syntax Highlighting**: Full syntax highlighting powered by Obsidian's built-in Prism.js
- **Live Preview Support**: Works in both Reading mode and Live Preview (Edit mode)
- **Auto Refresh**: Automatically updates rendered content when source files change
- **Copy to Clipboard**: One-click copy code content via the language label button
- **Open Source File**: Quick access button to open the original file

## Installation

### Manual Installation

1. Download the latest release (`main.js`, `manifest.json`, `styles.css`)
2. Create a folder named `obsidian-code-link` in your vault's `.obsidian/plugins/` directory
3. Copy the downloaded files into this folder
4. Reload Obsidian
5. Enable the plugin in **Settings → Community plugins**

### From Source

```bash
# Clone the repository
git clone https://github.com/yuanzhi/obsidian-code-link.git

# Install dependencies
npm install

# Build
npm run build
```

## Usage

### Embedding Code Files

Use Obsidian's standard embed syntax to include code files:

```markdown
![](example.js)
![](src/utils.ts)
![](config.json)
```

### Embedding CSV Files

CSV files are automatically rendered as tables:

```markdown
![](data.csv)
```

### Supported File Extensions

Configure supported extensions in **Settings → Code Link**:

- Default: `js, ts, py, java, c, cpp, go, rs, php, rb, swift, kt, sql, html, css, json, yaml, xml, sh, md`
- CSV files are handled separately

## Settings

| Setting | Description |
|---------|-------------|
| **Code Embed** | Enable/disable code file embedding |
| **CSV View** | Enable/disable CSV table rendering |
| **File Extensions** | Comma-separated list of supported code file extensions |

## UI Components

Each embedded code block includes:

- **Open Button** (↗): Opens the source file in a new tab
- **Language Label**: Displays file type; click to copy code content

## Requirements

- Obsidian v0.15.0 or higher
- Node.js v16+ (for building from source)

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

## License

MIT
