import { describe, it, expect, beforeAll } from "vitest";
import { seed } from "../fixtures/seed";
import { openFile } from "../harness/cli";
import { waitForSelector, queryDom } from "../harness/dom";
import { NOTE_ERROR } from "../harness/paths";

describe("错误处理", () => {
	beforeAll(() => {
		seed();
	});

	it("文件不存在时显示 .code-link-error 与错误信息", async () => {
		openFile(NOTE_ERROR);
		await waitForSelector(".code-link-error");
		const text = queryDom(".code-link-error", { text: true });
		expect(text).toContain("File not found");
	});
});
