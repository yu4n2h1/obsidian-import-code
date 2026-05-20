# Obsidian Import Code

将本地代码文件或远程代码仓库中的文件嵌入到 Obsidian 笔记中，支持语法高亮、符号/行范围提取、行高亮，以及多平台远程源（GitHub、GitLab、Gitea、WebDAV、Generic URL）的免配置引用。

## 功能

- **代码嵌入** — `![[file.ext]]` 嵌入本地代码文件，`![[alias:path/file.ext]]` 嵌入远程代码文件
- **远程源别名** — 在设置中预配置远程服务（GitHub / GitLab / Gitea / WebDAV / Generic URL），通过别名引用，无需每次输入完整 URL
- **符号提取** — `![[file.ext@函数名]]` 提取指定函数/类/方法（支持 JS/TS/Java/C/Go/Rust 等大括号语言，以及 Python/Ruby/YAML 缩进语言）
- **行范围提取** — `![[file.ext@10-30]]` 提取指定行范围，`@5` 提取单行
- **行高亮** — `![[file.ext#5-10]]` 高亮渲染结果中的指定行，可与 `@` 组合使用
- **语法高亮** — 基于文件扩展名自动识别语言，通过 Obsidian 内置 MarkdownRenderer 渲染
- **SSL 跳过验证** — 支持自签名/过期证书的 HTTPS 服务器（桌面端），带启动诊断和优雅降级
- **工具栏** — 每个嵌入块右上角提供 "打开源文件"按钮和"一键复制代码"按钮（含编程语言标记）
- **双模式支持** — 同时支持阅读模式（MarkdownPostProcessor）和实时预览（CodeMirror ViewPlugin）
- **自动刷新** — 本地文件修改后自动重新渲染（300ms 防抖）
- **插入代码文件** — 从剪贴板创建代码文件并插入嵌入链接，自动检测编程语言
- **再次引用** — 快速引用上一次插入的代码文件，可修改截取范围和高亮范围

## 安装

### 手动安装

1. 从最新 Release 下载 `main.js`、`manifest.json`、`styles.css`
2. 放入 `<vault>/.obsidian/plugins/obsidian-import-code/`
3. 重新加载 Obsidian，在 **设置 → 第三方插件** 中启用

### 从源码构建

```bash
git clone https://github.com/yu4n2h1/obsidian-import-code.git
cd obsidian-import-code
yarn install
yarn build
```

## 使用方法

### 基本嵌入

```markdown
![[src/utils.ts]]
![[config.json]]
![[scripts/deploy.sh]]
```

### 符号提取（`@`）

```markdown
![[src/utils.ts@parseConfig]]
![[models/user.py@UserClass]]
![[lib/helper.rs@process_data]]
```

### 行范围（`@` 数字）

```markdown
![[src/utils.ts@10-30]]
![[data/schema.sql@5]]
```

### 行高亮（`#`）

```markdown
![[src/app.ts#5-10]]
![[src/main.ts@init#5-12]]
```

### 远程 URL（直接链接）

```markdown
![[https://raw.githubusercontent.com/user/repo/main/src/example.py]]
```

### 远程源别名

先在 **设置 → Remote source aliases** 中配置远程源，例如：

| 配置项 | 示例值 |
|--------|--------|
| Alias | `Code` |
| Service type | `Gitea` (或 `GitHub` / `GitLab` / `WebDAV` / `Generic URL`) |
| URL | `https://gitea.example.com` |
| Token | `your-access-token` (可选，访问私有仓库) |
| Repository | `owner/repo` (Gitea/GitHub/GitLab 必填) |
| Branch | `main` |
| Path | `PYTHON` (可选，基础路径前缀) |

然后通过别名引用：

```markdown
![[Code:PYTHON/cursor测试/federated/federated_learning.py]]
![[Code:src/lib/helper.py@MyClass#10-20]]
```

> 配置 `Path` 后，嵌入路径会自动拼接在基础路径之后。如上例文件被解析为 `PYTHON/cursor测试/federated/federated_learning.py`。

### 命令

| 命令 | 说明 |
|------|------|
| **Insert embed code** | 从剪贴板读取代码，识别语言，创建文件并插入 `![[...]]` |
| **再次引用代码文件** | 加载上次插入的代码，可修改截取/高亮范围后重新引用 |

## 支持的文件类型

在设置中通过逗号分隔的扩展名列表配置，默认：

`js, ts, py, java, c, cpp, go, rs, rb, php, sh, sql, html, css, json, yaml, xml`

覆盖 40+ 种编程语言的语法高亮。

## 设置

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| Enable code embed | 开关代码嵌入功能 | 启用 |
| Enable remote code embed | 允许嵌入远程代码 | 启用 |
| Skip SSL certificate verification | 跳过 HTTPS 证书验证（仅桌面端） | 关闭 |
| Supported file extensions | 逗号分隔的扩展名列表 | `js,ts,py,...` |
| Storage path type | 绝对路径（vault 根目录）或相对路径（当前笔记） | 根目录 |
| Absolute / Relative storage path | 存储路径 | `assets` / `./` |
| File name strategy | `hash`（SHA256 内容哈希）/ `custom`（自定义）/ `auto`（基于内容） | `hash` |
| Remote source aliases | 预配置远程服务别名（URL、Token、Repo、Branch、Path） | 无 |

## 环境要求

- Obsidian v0.15.0+
- 远程 SSL 跳过功能仅支持桌面端（Electron）

## 开发

```bash
yarn install   # 安装依赖
yarn dev       # 监听模式
yarn build     # 生产构建（类型检查 + 压缩）
yarn lint      # 运行 eslint
```
