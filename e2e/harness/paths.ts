/**
 * E2E 测试的路径与常量。
 * example vault 通过软链接 `.obsidian/plugins/obsidian-import-code` 指向项目根目录，
 * `yarn build` 后插件产物自动同步到 vault。
 */

/** example vault 在文件系统上的绝对路径 */
export const EXAMPLE_VAULT = "/Users/yuanzhi/workspace/example";

/** Obsidian CLI 中 example vault 的名字（`obsidian vault=<name>`） */
export const VAULT_NAME = "example";

/** example vault 内长期固定的测试 fixture 目录（相对 vault 根） */
export const FIXTURE_DIR = "e2e-fixtures";

/** 代码 fixture（相对 vault 根，供 embed 引用） */
export const SAMPLE_PY = `${FIXTURE_DIR}/sample.py`;
export const SAMPLE_TS = `${FIXTURE_DIR}/sample.ts`;

/** 每个 embed 场景的独立笔记（相对 vault 根，供 CLI open path= 使用） */
export const NOTE_FULL = `${FIXTURE_DIR}/embed-full.md`;
export const NOTE_SYMBOL = `${FIXTURE_DIR}/embed-symbol.md`;
export const NOTE_LINE = `${FIXTURE_DIR}/embed-line.md`;
export const NOTE_HIGHLIGHT = `${FIXTURE_DIR}/embed-highlight.md`;
export const NOTE_ERROR = `${FIXTURE_DIR}/embed-error.md`;
export const NOTE_TS = `${FIXTURE_DIR}/embed-ts.md`;
