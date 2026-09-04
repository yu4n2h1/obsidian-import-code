import { describe, it, expect, beforeAll } from "vitest";
import { seed } from "../fixtures/seed";
import { openFile } from "../harness/cli";
import { waitForSelector, queryDom } from "../harness/dom";
import { NOTE_LINE } from "../harness/paths";

describe("@start-end 行范围定位", () => {
	beforeAll(() => {
		seed();
	});

	it("@1-3 只渲染前 3 行，不含后续函数", async () => {
		openFile(NOTE_LINE);
		await waitForSelector(".code-embed-container");
		const text = queryDom(".code-embed-container", { text: true });
		expect(text).toContain("def hello");
		expect(text).toContain("return");
		expect(text).not.toContain("def add");
	});
});
