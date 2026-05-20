# Obsidian Import Code

将外部代码文件和远程 URL 嵌入到 Obsidian 笔记中，支持语法高亮、符号提取、自动刷新。

## 功能

- **代码嵌入** — 使用 `![[file.ext]]` 语法嵌入本地代码文件
- **符号提取** — 使用 `![[file.ext@函数名]]` 提取指定的函数/类/方法
- **行范围提取** — 使用 `![[file.ext@10-30]]` 提取指定行范围
- **行高亮** — 使用 `![[file.ext#L5-L10]]` 在渲染的代码块中高亮指定行
- **远程 URL 支持** — 支持嵌入 HTTP/HTTPS 远程代码文件
- **语法高亮** — 基于 Obsidian 内置的 `MarkdownRenderer`
- **双模式支持** — 同时支持 Live Preview（CodeMirror）和阅读模式
- **自动刷新** — 源文件修改后自动重新渲染（300ms 防抖）
- **新建代码文件** — 从剪贴板内容创建代码文件并插入嵌入链接
- **工具栏** — 打开源文件按钮 + 一键复制代码
- **自动语言检测** — 根据 shebang、关键字和内容特征自动检测编程语言

## 安装

### 手动安装

1. 从最新 Release 下载 `main.js`、`manifest.json`、`styles.css`
2. 在 `<vault>/.obsidian/plugins/` 下创建 `obsidian-import-code` 文件夹
3. 将下载的文件复制到该文件夹中
4. 重新加载 Obsidian
5. 在 **设置 → 第三方插件** 中启用插件

### 从源码构建

```bash
git clone https://github.com/yu4n2h1/obsidian-import-code.git
cd obsidian-import-code
yarn install
yarn build
```

## 使用方法

### 嵌入代码文件

使用 Obsidian 标准的 wiki 链接嵌入语法：

```markdown
![[src/utils.ts]]
![[config.json]]
![[scripts/deploy.sh]]
```

### 提取符号

使用 `@` 提取指定的函数、类或方法：

```markdown
![[src/utils.ts@parseConfig]]
![[models/user.py@UserClass]]
![[lib/helper.rs@process_data]]
```

对于花括号语言（JS、TS、Java、C、Go、Rust 等）使用大括号匹配策略，对于 Python、Ruby、YAML 使用缩进跟踪策略。

### 提取行范围

使用数字语法提取指定行范围：

```markdown
![[src/utils.ts@10-30]]
![[data/schema.sql@5]]         # 单行
```

### 高亮指定行

使用 `#L` 语法高亮代码块中的行：

```markdown
![[src/app.ts#L15-L25]]
![[src/main.ts@init#L5-L12]]   # 可与符号提取组合使用
```

### 嵌入远程 URL

```markdown
![[https://raw.githubusercontent.com/user/repo/main/src/example.py]]
```

需要在设置中启用远程代码嵌入，可选择性跳过 SSL 证书验证。

### 新建代码文件

使用 **插入嵌入代码** / **新建代码片段** 命令打开创建窗口，粘贴代码内容后，插件会：

1. 根据内容自动检测文件扩展名（shebang、关键词、内容模式）
2. 生成文件名（基于 MD5 哈希或内容）
3. 将文件保存到配置的位置（相对于 Vault 根目录或当前笔记）
4. 在光标位置插入 `![[...]]` 嵌入链接

## 支持的文件扩展名

在 **设置 → Obsidian Import Code** 中配置，默认：

`js, ts, py, java, c, cpp, go, rs, rb, php, sh, sql, html, css, json, yaml, xml`

完整语言映射：JavaScript、TypeScript、Python、Ruby、Java、C、C++、C#、Go、Rust、Swift、Kotlin、Scala、PHP、Bash、PowerShell、SQL、HTML、CSS、SCSS、Less、JSON、XML、YAML、TOML、Markdown、Lua、R、Perl、Elixir、Erlang、Clojure、Haskell、OCaml、F#、Vue、Svelte、JSX、TSX

## 设置

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| **启用代码嵌入** | 开关代码嵌入功能 | 启用 |
| **启用远程代码嵌入** | 允许嵌入 HTTP/HTTPS URL | 启用 |
| **跳过 SSL 证书验证** | 跳过 HTTPS 证书验证（仅桌面端） | 关闭 |
| **支持的文件扩展名** | 逗号分隔的扩展名列表 | `js,ts,py,...` |
| **存储路径类型** | 根目录绝对路径 或 相对当前文档路径 | 根目录 |
| **根目录存储路径** | 相对 Vault 根目录的路径（如 `assets/code`） | `assets` |
| **相对存储路径** | 相对当前文档的路径（如 `./` 或 `../shared`） | `./` |
| **文件名生成策略** | 基于 MD5 哈希 或 基于输入内容 | MD5 哈希 |

## 环境要求

- Obsidian v0.15.0 或更高版本

## 开发

```bash
yarn install   # 安装依赖
yarn dev       # 监听模式 — 源码变化时自动重新构建
yarn build     # 生产构建 — 类型检查 + 压缩打包
yarn lint      # 运行 eslint
```
