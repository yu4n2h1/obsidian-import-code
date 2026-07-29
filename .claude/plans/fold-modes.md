# 折叠模式三选一（full / partial / none）

## 需求

设置页加一个下拉选折叠模式，三种互斥：

1. **完整展开（full）**：展开后显示全部内容；可调折叠后显示行数
2. **部分展开（partial）**：展开后不是全部，而是显示 expandedLines 行（可滚动看更多）；可调折叠后行数 + 展开后行数
3. **不折叠（none）**：不折叠，总是全部显示

当前实现只有 full 一种行为（展开 = 无限制），需改造为三选一。

## 设计

### 设置结构（`src/types.ts`）

新增两个字段，保留现有两个：

```ts
foldMode: "full" | "partial" | "none";  // 新增，默认 "full"
foldThreshold: number;                   // 保留，触发折叠的行数阈值，默认 50
foldPreviewLines: number;                // 保留，折叠后显示行数，默认 10
foldExpandedLines: number;               // 新增，展开后显示行数（仅 partial），默认 30
```

DEFAULT_SETTINGS 加 `foldMode: "full"` + `foldExpandedLines: 30`。
无需显式迁移--新字段有默认值，旧 data.json 没有这些字段时 Object.assign 用 DEFAULT 填充。

### RenderOptions（`src/pipeline/types.ts`）

加 `foldMode?: "full" | "partial" | "none"` + `foldExpandedLines?: number`。

### processor（`src/code-embed-processor.ts`）

传参处加 `foldMode` + `foldExpandedLines`。

### 渲染逻辑（`src/ui/render/code-embed.ts`）

`renderSuccess` 折叠判断改为：
```ts
const foldMode = options?.foldMode ?? "full";
const foldThreshold = options?.foldThreshold ?? 0;
if (foldMode !== "none" && foldThreshold > 0) {
    const totalLines = displayContent.split("\n").length;
    if (totalLines > foldThreshold) {
        applyFoldable(container, totalLines, {
            mode: foldMode,
            collapsedLines: options?.foldPreviewLines ?? 10,
            expandedLines: options?.foldExpandedLines ?? 30,
        });
    }
}
```

`applyFoldable` 改造签名 `(container, totalLines, opts)`：
- 加 class `code-embed-fold-{mode}`（full / partial）
- 设 CSS 变量 `--fold-collapsed-h`（两种模式）+ `--fold-expanded-h`（仅 partial）
- 按钮 toggle（full 和 partial 都有按钮；none 不进这个函数）

按钮文本：
- full 折叠态：`展开 ${totalLines}`（展开 = 看全部 N 行）
- full 展开态：`收起`
- partial 折叠态：`展开`（不显示行数，避免误导"全部"）
- partial 展开态：`收起`

### CSS（`styles.css`）

```css
/* 折叠态（full + partial 共用） */
.code-embed-foldable.code-embed-folded .code-embed-wrapper pre {
    max-height: var(--fold-collapsed-h, 10em);
    overflow: auto;
}
/* 折叠态渐变遮罩（保留现有） */

/* 展开态 - full（无限制） */
.code-embed-foldable.code-embed-fold-full:not(.code-embed-folded) .code-embed-wrapper pre {
    max-height: none;
}

/* 展开态 - partial（仍有限制，可滚动） */
.code-embed-foldable.code-embed-fold-partial:not(.code-embed-folded) .code-embed-wrapper pre {
    max-height: var(--fold-expanded-h, 20em);
    overflow: auto;
}
```

partial 展开态也加渐变遮罩（内容超出 expandedLines 时暗示可滚动）。

### 设置 UI（`src/ui/settings/embed-storage-tab.ts`）

调整顺序，Fold mode 下拉放在折叠相关设置最前：

1. Fold mode（下拉：完整展开 / 部分展开 / 不折叠）
2. Auto-fold threshold（mode != none 时显示）
3. Folded lines（mode != none 时显示，原 "Folded preview lines" 改名）
4. Expanded lines（仅 mode == partial 时显示）
5. Wrap long lines（不受影响）

动态显示用 `Setting.settingEl.style.display`：
```ts
const updateFoldVisibility = (mode: string) => {
    thresholdSetting.settingEl.style.display = mode === "none" ? "none" : "";
    collapsedSetting.settingEl.style.display = mode === "none" ? "none" : "";
    expandedSetting.settingEl.style.display = mode === "partial" ? "" : "none";
};
```

foldMode onChange 时调 `updateFoldVisibility` + saveSettings + resetMarkdownViews。

## 改动文件

1. `src/types.ts` - 加 foldMode + foldExpandedLines
2. `src/pipeline/types.ts` - RenderOptions 加两字段
3. `src/code-embed-processor.ts` - 传参
4. `src/ui/render/code-embed.ts` - renderSuccess 判断 + applyFoldable 改造
5. `src/ui/settings/embed-storage-tab.ts` - 下拉 + 动态显示
6. `styles.css` - full/partial 展开态样式 + 遮罩

## 验证

- `yarn build` + `yarn lint` + `yarn test` 通过
- Obsidian 手测：切换三种模式，参数动态显示/隐藏；full 展开=全部、partial 展开=expandedLines 可滚动、none 不折叠
