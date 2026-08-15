import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { seed } from "../fixtures/seed";
import { openFile, runCommand, obsidian } from "../harness/cli";
import { waitForSelector, queryDom } from "../harness/dom";
import { NOTE_FULL } from "../harness/paths";

describe("create-code-file 命令", () => {
	beforeAll(() => {
		seed();
		openFile(NOTE_FULL);
	});

	afterAll(() => {
		// 清理可能残留的上传 modal，避免遮挡后续查询
		obsidian(["eval", "code=document.querySelectorAll('.modal').forEach(m => m.remove())"]);
	});

	it("执行命令打开上传对话框", async () => {
		await waitForSelector(".code-embed-container");
		runCommand("obsidian-import-code:create-code-file");
		await waitForSelector(".modal");
		const text = queryDom(".modal", { text: true });
		expect(text).toContain("Create code file");
	});
});
