# 数据源抓取层：`src/fetchers/`

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

设计得非常统一。`types.ts` 定义两个 shape：

```ts
interface RemoteService { serviceType; read(params) → RemoteReadResult }
interface RemoteReadParams { config, filePath, skipSslVerify }
interface RemoteReadResult { success, content?, error? }
```

`index.ts` 有一个 `services: Record<RemoteServiceType, RemoteService>` 注册表，暴露两个 API：

- `readRemoteFile(url, skipSsl)` —— **纯 HTTP GET，走 HttpResolver 用**（不查注册表）。
- `readFromService(serviceType, config, filePath, skipSsl)` —— **走注册表，供 AliasResolver 用**。

6 个具体实现都是纯函数式的 const service 对象：

| 文件 | serviceType | 认证 | URL 构造 | 特殊处理 |
|---|---|---|---|---|
| `github.ts` | `github` | `if(config.token)` 才加 `Authorization: Bearer` | `${base}/repos/${repo}/contents/${encoded}?ref=${branch}`，默认 base `https://api.github.com` | `!config.repo` 守卫（`Repository is required (format: owner/repo)`）；响应可能是 base64，用 `decodeBase64Content`；额外头 `Accept: application/vnd.github.object` + `X-GitHub-Api-Version` |
| `gitlab.ts` | `gitlab` | `if(config.token)` 才设 `PRIVATE-TOKEN` | `${base}/api/v4/projects/${encodeURIComponent(repo)}/repository/files/${encodedPath}?ref=...`，默认 base `https://gitlab.com` | `!config.repo` 守卫；同上，base64 |
| `gitea.ts` | `gitea` | `if(config.token)` 才设 `Authorization: token` | `${base}/${repo}/raw/branch/${branch}/${encoded}`（`config.url` 必填、无默认） | `!config.repo` 守卫；raw endpoint，直接 text |
| `webdav.ts` | `webdav` | `Basic user:token` 或 `Bearer token` | `buildServiceUrl(config, filePath)` | 直接 text |
| `generic.ts` | `generic` | `Bearer` if token | 同上 | 直接 text |
| `local-fs.ts` | `local` | — | `path.resolve(baseDir, buildFullPath(config.path, filePath))`（`baseDir = config.url \|\| ""`） | 走 Node `fs.readFileSync`（`getRequire()`） |

三个 URL/路径构造都是 `utils/http-client.ts` 里的 `buildFullPath`、`encodePathSegments`、`normalizeBaseUrl`、`buildServiceUrl` 共享。每个 service 用 `enrichError(err, "XX read failed")` 把 catch 到的异常统一封装成 `RemoteReadResult`。

> ⚠️ **命名陷阱**：这里的 `serviceType: "local"` 指的是 **Node fs 读 vault 之外的本地目录**（用 `config.url` 作为基路径 + `path.resolve` + `fs.readFileSync`）。它和 `upload/local.ts` 的 `"local"`（Obsidian `vault.create` 写 vault **之内**的文件）**是完全不同的两件事**——同名但语义相反。read 端穿透到宿主文件系统，write 端锁在 vault 内。踩到会很痛。
