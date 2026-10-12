/**
 * Obsidian CLI 调用的薄封装。
 * 所有命令都带上 `vault=<name>` 定位到 example vault。
 */
import { execFileSync } from "node:child_process";
import { VAULT_NAME } from "./paths";

const OBSIDIAN_BIN = "/usr/local/bin/obsidian";

/**
 * 调用 obsidian CLI，返回 stdout（去尾换行）。
 * 命令失败时抛错（携带 stderr）。
 */
export function obsidian(args: string[]): string {
	const out = execFileSync(OBSIDIAN_BIN, [`vault=${VAULT_NAME}`, ...args], {
		encoding: "utf8",
		// CLI 某些查询命令在无结果时可能以非零退出码返回，这里不让它直接抛，
		// 由上层根据 stdout 判断。
	}).trimEnd();
	return out;
}

/** 打开一个笔记并切换到指定视图（path 按 vault 内精确路径）。 */
export function openFile(path: string, mode: "source" | "preview" = "preview"): void {
	obsidian(["open", `path=${path}`]);
	const currentMode = obsidian([
		"eval",
		"code=app.workspace.activeLeaf.view.getMode()",
	]);
	if (!currentMode.endsWith(mode)) {
		obsidian(["command", "id=markdown:toggle-preview"]);
	}
}

/** 执行一个 Obsidian 命令（含插件命令），返回命令的 stdout。 */
export function runCommand(commandId: string): string {
	return obsidian(["command", `id=${commandId}`]);
}

/** 重载插件（开发者工作流，yarn build 后刷新插件）。 */
export function reloadPlugin(pluginId: string): string {
	return obsidian(["plugin:reload", pluginId]);
}
