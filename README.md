# Obsidian Import Code

将本地代码文件或远程代码仓库中的文件嵌入到 Obsidian 笔记中，支持语法高亮、符号/行范围提取、行高亮，以及多平台远程源（GitHub、GitLab、Gitea、WebDAV、Generic URL）的免配置引用。

## 功能

### 嵌入与渲染

- **代码嵌入** - `![[file.ext]]` 嵌入本地代码文件，`![[alias:path/file.ext]]` 嵌入远程代码文件
- **符号提取** - `![[file.ext@函数名]]` 提取指定函数/类/方法（支持 JS/TS/Java/C/Go/Rust 等大括号语言，以及 Python/Ruby/YAML 缩进语言）
- **行范围提取** - `![[file.ext@10-30]]` 提取指定行范围，`@5` 提取单行
- **行高亮** - `![[file.ext#5-10]]` 高亮渲染结果中的指定行，可与 `@` 组合使用
- **HTML 元素提取** - `![[file.html@.container]]` 通过 CSS 选择器提取 HTML 元素
- **语法高亮** - 基于文件扩展名自动识别语言，通过 Obsidian 内置 MarkdownRenderer 渲染
- **行号显示** - 可选在代码块左侧显示源文件真实行号（考虑 `@` 提取的偏移）
- **代码折叠** - 超过阈值的代码块自动折叠，折叠态可滚动查看，预览行数可调
- **长行换行** - 可选让超长行换行显示（默认横向滚动）
- **加载骨架屏** - 远程/alias 拉取时显示脉动骨架占位

### 远程与上传

- **远程源别名** - 在设置中预配置远程服务（GitHub / GitLab / Gitea / WebDAV / Generic URL / Local Directory），通过别名引用，无需每次输入完整 URL
- **上传源** - 从剪贴板创建代码文件时，可上传到 Local vault / WebDAV / GitHub Gist，自动生成嵌入链接
- **SSL 跳过验证** - 支持自签名/过期证书的 HTTPS 服务器（桌面端），带启动诊断和优雅降级

### 交互

- **工具栏** - 每个嵌入块右上角提供"打开源文件"按钮和"一键复制代码"按钮（含编程语言标记），超阈值代码块另附"展开/收起"按钮
- **双模式支持** - 同时支持阅读模式（MarkdownPostProcessor）和实时预览（CodeMirror ViewPlugin）
- **自动刷新** - 本地文件修改后自动重新渲染（300ms 防抖）
- **插入代码文件** - 从剪贴板创建代码文件并插入嵌入链接，自动检测编程语言
- **再次引用** - 快速引用上一次插入的代码文件，可修改截取范围和高亮范围

## 安装

### 手动安装

1. 从最新 Release 下载 `main.js`、`manifest.json`、`styles.css`
2. 放入 `<vault>/.obsidian/plugins/obsidian-import-code/`
3. 重新加载 Obsidian，在 **设置 -> 第三方插件** 中启用

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

### HTML 元素提取（`@` CSS 选择器）

对于 `.html` 文件，`@` 后支持 CSS 选择器来提取特定元素：

```markdown
![[template.html@.container]]
![[page.html@[id="main"]]]
![[layout.html@div.content]]
![[index.html@section > p]]
```

| 选择器示例 | 提取内容 |
|-----------|----------|
| `.container` | 提取 `class="container"` 的元素 |
| `[id="main"]` | 提取 `id="main"` 的元素 |
| `div.content` | 提取 `<div class="content">` |
| `nav > a` | 提取 `<nav>` 下的 `<a>` |

> **注意**：由于 `#` 在 embed 语法中已用作高亮分隔符（如 `#5-10`），请使用属性选择器 `[id="xxx"]` 代替 ID 选择器 `#xxx`。

与行高亮组合使用：

```markdown
![[page.html@[id="main"]#5-10]]
```

### 远程 URL（直接链接）

```markdown
![[https://raw.githubusercontent.com/user/repo/main/src/example.py]]
```

### 远程源别名

先在 **设置 -> Remote Sources** 中配置远程源，例如：

| 配置项 | 示例值 |
|--------|--------|
| Alias | `Code` |
| Service type | `Gitea` (或 `GitHub` / `GitLab` / `WebDAV` / `Generic URL` / `Local Directory`) |
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

> 配置 `Path` 后，嵌入路径会自动拼接在基础路径之后。

### 命令

| 命令 | 说明 |
|------|------|
| **Insert embed code** | 从剪贴板读取代码，识别语言，上传到配置的 Upload Source 并插入 `![[...]]` |
| **再次引用代码文件** | 加载上次插入的代码，可修改截取/高亮范围后重新引用 |

## 设置

设置页分 4 个 Tab：

### Embed & Storage

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| Enable code embed | 开关代码嵌入功能 | 启用 |
| Enable remote code embed | 允许嵌入远程代码 | 启用 |
| Skip SSL certificate verification | 跳过 HTTPS 证书验证（仅桌面端） | 关闭 |
| Show line numbers | 代码块左侧显示行号（基于源文件真实行号） | 关闭 |
| Auto-fold threshold | 超过多少行自动折叠，0 = 不折叠 | 50 |
| Folded preview lines | 折叠态显示多少行，超出可滚动 | 10 |
| Wrap long lines | 超长行换行显示（否则横向滚动） | 关闭 |
| File name strategy | `hash`（SHA256 内容哈希）/ `custom`（自定义）/ `auto`（基于内容） | `hash` |

### File Extensions

表格化管理支持的文件扩展名，每条可配置后缀（suffix）、显示方言（dialect）、启用开关。默认覆盖 40+ 种编程语言。

### Remote Sources

配置化远程读源，每个别名对应一种服务（GitHub / GitLab / Gitea / WebDAV / Generic URL / Local Directory），含 URL、Token、Repo、Branch、Path 等字段，可单独配置 SSL 跳过。

### Upload Sources

配置化写源，"Insert embed code" 命令会把代码上传到选中的源：

| 类型 | 说明 | 返回引用 |
|------|------|----------|
| Local | 写入 vault 内指定目录（绝对/相对路径） | vault 相对路径 |
| WebDAV | PUT 到 WebDAV 服务器 | 上传 URL |
| GitHub Gist | 创建私有 Gist | raw URL |

每个上传源可配置是否生成带别名的 wiki 链接（`![[path|alias]]` vs `![[path]]`）。

## 支持的文件类型

在 **设置 -> File Extensions** 中管理，默认启用：

`js, ts, py, java, c, cpp, go, rs, rb, php, sh, sql, html, css, json, yaml, xml`

覆盖 40+ 种编程语言的语法高亮与符号提取。

## 环境要求

- Obsidian v0.15.0+
- 远程 SSL 跳过功能仅支持桌面端（Electron）

## 开发

```bash
yarn install   # 安装依赖
yarn dev       # 监听模式，改动 src/ 自动重建 main.js
yarn build     # 生产构建（类型检查 + 压缩）
yarn lint      # 运行 eslint
```

`yarn dev` 只跑 esbuild 不跑 tsc；类型错误只有 `yarn build` 才会暴露。
