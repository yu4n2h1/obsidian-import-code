import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { seed } from "../fixtures/seed";
import { openFile, runCommand, obsidian } from "../harness/cli";
import { waitForActiveSelector, queryActiveDom } from "../harness/dom";
import { NOTE_FULL } from "../harness/paths";

describe("create-code-file 命令", () => {
	beforeAll(() => {
		seed();
		openFile(NOTE_FULL, "source");
	});

	afterAll(() => {
		// 通过 Cancel 关闭活动窗口中的弹窗，确保 Obsidian 正常清理 modal 状态。
		obsidian([
			"eval",
			"code=(function(){var modal=activeDocument.querySelector('.code-import-file-modal');if(!modal)return false;var button=Array.from(modal.querySelectorAll('button')).find(function(el){return el.textContent.trim()==='Cancel';});if(button)button.click();return !!button;})()",
		]);
	});

	it("执行命令打开上传对话框", async () => {
		runCommand("import-code:create-code-file");
		await waitForActiveSelector(".code-import-file-modal");
		const text = queryActiveDom(".code-import-file-modal", { text: true });
		expect(text).toContain("Create code file");
	});
});
