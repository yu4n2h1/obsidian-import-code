# obsidian-import-code

## Project overview

- **Target**: Obsidian Community Plugin (TypeScript → bundled JavaScript).
- **Purpose**: Embed and render code files in Obsidian notes via `![[file.ext]]` syntax with syntax highlighting, symbol extraction (`@`), and line highlighting (`#`).
- **Entry point**: `src/main.ts` compiled to `main.js` and loaded by Obsidian.
- **Required release artifacts**: `main.js`, `manifest.json`, `styles.css`.

## Environment & tooling

- Node.js: use current LTS (Node 18+ recommended).
- **Package manager: yarn** (required for this sample - `package.json` defines scripts and dependencies).
- **Bundler: esbuild** (required for this sample - `esbuild.config.mjs` and build scripts depend on it).
- Types: `obsidian` type definitions.

### Install

```bash
yarn install
```

### Dev (watch)

```bash
yarn dev
```

### Production build

```bash
yarn build
```

## Linting

```bash
yarn lint
```

## File & folder conventions

```
src/
  main.ts                    # Plugin entry, lifecycle, command registration
  types.ts                   # All TypeScript interfaces and DEFAULT_SETTINGS
  settings.ts                # Settings tab UI (three builder methods)
  commands/
    insert-code.ts           # Command callbacks for insert + re-reference
  ui/
    code-embed.ts            # Core: CodeEmbedProcessor (render + embed processing)
    modal.ts                 # FileModal: create code files (local or remote upload)
    edit-link-modal.ts       # EditLinkModal: re-reference last code file
    remote-config-fields.ts  # Shared remote config form rendering
  upload/
    types.ts                 # UploadOptions, UploadResult, RemoteUploader
    upload-manager.ts        # Dispatches to correct uploader by service type
    git-like-uploader.ts     # Shared GitHub/Gitea upload logic
    github-uploader.ts       # GitHub uploader
    gitlab-uploader.ts       # GitLab uploader (PRIVATE-TOKEN auth)
    gitea-uploader.ts        # Gitea uploader
    webdav-uploader.ts       # WebDAV uploader (PUT with Basic/Bearer auth)
  utils/
    code-extractor.ts        # Symbol extraction + line range finding
    language.ts              # Extension mapping + language guessing
    parse-embed-source.ts    # Parse ![[file@symbol#highlight]] syntax
    constants.ts             # EXTENSION_TO_LANGUAGE + SERVICE_LABELS
    https-module.ts          # dispatchHttpRequest (single HTTP entry point)
    debounce.ts              # Generic debounce utility
    settings-helpers.ts      # Extension support checks
styles.css                   # Plugin-scoped styles
```

- **Do not commit build artifacts**: Never commit `node_modules/`, `main.js`, or other generated files.
- Keep the plugin small. Avoid large dependencies.
- Generated output at plugin root: `main.js`, `manifest.json`, `styles.css`.

## Project conventions

### Code style
- Chinese comments and Chinese UI strings are acceptable and used throughout.
- `data-code-link-handled` attribute and `.code-link-processed` CSS class prevent double-processing of embeds.
- CSS selectors are plugin-scoped (e.g., `.code-embed-container button.copy-code-button`).
- All async operations that can fail use `.catch()` with error logging.

### Architecture rules
- **Single HTTP entry point**: All remote requests must go through `dispatchHttpRequest()` in `https-module.ts`. Never use `requestUrl` or `fetch` directly.
- **SettingsProvider interface**: Used to break circular dependency between `main.ts` and `settings.ts`.
- **No global SSL override**: SSL verification is skipped per-request via `rejectUnauthorized: false`, never by setting `NODE_TLS_REJECT_UNAUTHORIZED`.
- **`main.ts` stays minimal**: Only plugin lifecycle (`onload`/`onunload`), command registration, and processor initialization. All feature logic lives in sub-modules.

### Settings flow
- `loadData()` / `saveData()` are the persistence layer.
- `saveSettings()` recreates the `CodeEmbedProcessor` (to pick up settings changes) but does NOT force-reset Markdown views.
- Settings changes propagate to embeds naturally through the processor recreation and existing render paths.

## Embed syntax

```
![[file.ext|alias]]
![[file.ext@symbolName|alias]]
![[file.ext#symbolName|alias]]
![[file.ext@symbolName#symbolName|alias]]
```

- `@` extracts by function/class/method name or line range (e.g., `10-30`)
- `#` highlights by function/class/method name or line range (e.g., `5-10`)

## Manifest rules (`manifest.json`)

- Must include: `id`, `name`, `version`, `minAppVersion`, `description`, `isDesktopOnly`
- Never change `id` after release.
- Keep `minAppVersion` accurate when using newer APIs.
- Canonical requirements: https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml

## Testing

- Manual install for testing: copy `main.js`, `manifest.json`, `styles.css` to:
  ```
  <Vault>/.obsidian/plugins/<plugin-id>/
  ```
- Reload Obsidian and enable the plugin in **Settings → Community plugins**.

## Commands & settings

- Single insert command: `id: "create-code-file"` / "Insert embed code"
- Re-reference command: `id: "re-reference-last-code"` / "再次引用代码文件"
- Keep command IDs stable — do not rename once released.
- Persist settings using `this.loadData()` / `this.saveData()`.

## Security, privacy, and compliance

- Default to local/offline operation. Network requests only for explicitly configured remote embeds or uploads.
- No hidden telemetry. Remote services require explicit opt-in configuration.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code.
- Minimize scope: read/write only what's necessary inside the vault.
- Register and clean up all DOM, app, and interval listeners using `register*` helpers.

## UX & copy guidelines

- Sentence case for headings, buttons, and titles.
- Chinese UI strings for Chinese-named commands; English for standard Obsidian conventions.
- Keep in-app strings short, consistent, and free of jargon.

## Performance

- Keep startup light. Defer heavy work until needed.
- Debounce vault modify handler at 300ms.
- CodeMirror editor extension uses `setTimeout(50)` to avoid blocking initial render.

## Mobile

- `isDesktopOnly: false` — the plugin targets both desktop and mobile.
- SSL skip feature is desktop-only (requires Node.js `https` module).
- Avoid large in-memory structures.

## Adding features

### Adding a new remote uploader
1. Create `src/upload/<service>-uploader.ts` implementing `RemoteUploader`
2. Register it in `src/upload/upload-manager.ts` static routing table
3. Add the service type to `RemoteServiceType` in `src/types.ts`
4. Add a label in `SERVICE_LABELS` in `src/utils/constants.ts`

### Adding a new file extension
1. Add to `EXTENSION_TO_LANGUAGE` in `src/utils/constants.ts`
2. Add to the default `codeFileExtensions` string in `src/types.ts`
3. Optionally add auto-detection heuristics in `guessExtensionFromContent()` in `src/utils/language.ts`

### Adding a new language extraction strategy
1. Add the language to `STRATEGY_MAP` in `src/utils/code-extractor.ts` (`"indentation"` or `"braces"`)
2. If needed, add new `DEF_PATTERNS` entries for the language's function/method definition syntax

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
