# 上传层：`src/upload/`

> 架构总览见 [`docs/architecture.md`](../architecture.md)。

镜像 fetchers 的 shape，但**类型独立**，因为不是所有远程来源都能上传，反之亦然：

- `UploadServiceType = "local" | "webdav" | "github-gist"`（**local vault、webdav、gist**——注意没有 github/gitlab/gitea/generic，因为 push 一个文件到 repo 得走 API + 提交流程，比 read 复杂得多）。
- `UploadService.upload(params) → UploadResult { success, reference?, created?, error? }`。`reference` 是最终写入的路径或 URL，会被回填到编辑器里当 wiki link；`created`（`a596108` 新增）标记是新建还是已存在，供 UI 提示区分。

> **读写非对称一览**（`RemoteServiceType` vs `UploadServiceType`）：
>
> | 服务 | Fetch (读) | Upload (写) | 备注 |
> |---|:---:|:---:|---|
> | `local` | ✅ 读 vault **外** (Node fs) | ✅ 写 vault **内** (Obsidian vault) | **同名不同义**，见 fetchers 命名陷阱 |
> | `webdav` | ✅ | ✅ | 唯一对称的远程服务 |
> | `github` | ✅ 读 repo contents | ⚠️ 只有 gist (`github-gist`) | 没有向 repo 提交的能力 |
> | `gitlab` | ✅ | ❌ | 只读 |
> | `gitea` | ✅ | ❌ | 只读 |
> | `generic` | ✅ | ❌ | 只读 |
>
> 这种不对称是有意的：读一个文件只需 GET，而向 repo 提交需要处理 tree / commit / SHA 冲突，工作量差一个数量级。当前策略是"能读的都支持，能写的挑几个高价值场景"。
- `index.ts`：
  - `createUploadServices(app)` 工厂——本地服务需要 `App` 做 `vault.createFolder / create`，所以是运行时装配的 map。
  - **`uploadToService(services, serviceType, config, ctx, skipSslVerify)` 是公开分发 API**（被 `ui/modal/modal.ts` 调用），按 serviceType 路由到对应实现。
  - `withUploadError(context, fn)` / `uploadErrorContext` 是模块内部私有（`uploadErrorContext` 用 switch/case 而非 Record 索引避开 `noUncheckedIndexedAccess` 的类型断言）。
- 三个实现：
  - `local.ts`：`normalizePath(folderPath/fileName)`，需要时 `vault.createFolder`，**文件存在时不覆盖**（幂等），返回 vault-relative path，并标记 `created`。
  - `webdav.ts`：`PUT` 到 `buildServiceUrl(config, fileName)`。
  - `github-gist.ts`：默认 base `https://api.github.com`，`POST /gists`、`public:false`，从响应里挑 `files[fileName].raw_url` 作为 reference；`raw_url` 缺失时返回失败 `"raw_url not found in response"`。

上传由 `ui/modal/modal.ts`（`FileModal`）触发；`commands/insert-code.ts` 拿到 `EmbedLinkInfo` 后 `editor.replaceSelection(![[linkPath|displayName]])` 并 `saveLastFileReference(...)`。上传结果提示在 `modal.ts` 的 `handleSubmit` 里：local 分支 `Notice(created ? 'File created…' : 'File already exists…')`，远程分支 `Notice('File uploaded to …')`。
