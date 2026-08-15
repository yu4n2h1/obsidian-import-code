# Utils

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

- `helpers.ts`：**embed 解析全套**（`parseEmbedSource` 用 `lastIndexOf("#")` 和 `lastIndexOf("@")` 切分；`classifyPath(filePath): PathMode` 集中分类 `"http" | "alias" | "local"`，被 `code-embed-processor.isProcessingAllowed` 守卫与 `content-resolver.resolve` 路由**共用**；`isRemoteUrl / isAliasPath / parseAliasPath`；IPv6 URL 还原 `isPartialIpv6Url / tryRestoreIpv6Url`——从 embed 下一个 sibling text node 里把被截断的 `]` 部分捞回来，因为 Obsidian 会把 IPv6 URL 里的 `[::1]` 当成 wiki link 语法切掉）；`LineRange` 与 `parseLineRange`；`debounce`；`getSupportedExtensions`。这是**领域工具集合**。
- `http-client.ts`：**HTTP 抽象**。核心 `dispatchHttpRequest(options)`——如果 `skipSslVerify && https://`，走 Node `https.request` 手写实现（含 5 次重定向支持、301/302 改 GET、307/308 保留方法、`User-Agent: Obsidian-Code-Embed-Plugin`）；否则走 Obsidian `requestUrl`。**skipSsl 开启但 https 模块不可用时回退 `requestUrl` + console.warn**。SSL 错误关键字检测（`isSslError`）会给用户加提示"你可以在设置里开 skip SSL"。`getRequire()` 有三级 fallback（`window.require` → `globalThis.require` → 间接 eval），并针对 Electron 环境做检查。共享工具：`buildFullPath / encodePathSegments / normalizeBaseUrl / decodeBase64Content / buildServiceUrl / enrichError`——被所有 fetchers 与 uploaders 复用。
- `language.ts`：只有 16 行，`getLanguageFromPath(path, settings)` 从 `codeFileExtensions` 里查扩展名对应的 dialect（返回 `[extension, language]` 元组）；re-export `extractFirstSymbolName` 与 `guessExtensionFromContent` 让上层统一从 utils 拿，不用直接依赖 `../language/`。
- `constants.ts`：**只剩 `SERVICE_LABELS`**——`EXTENSION_TO_LANGUAGE` 常量已按最近的 commit（`ab242f4`）删除，改用 settings 里的 `dialect` 字段。
