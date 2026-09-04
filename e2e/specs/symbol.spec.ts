import { describe, it, expect, beforeAll } from "vitest";
import { seed } from "../fixtures/seed";
import { openFile } from "../harness/cli";
import { waitForSelector, queryDom } from "../harness/dom";
import { NOTE_SYMBOL } from "../harness/paths";

describe("@symbol 符号定位", () => {
	beforeAll(() => {
		seed();
	});

	it("@hello 只渲染 hello 函数，不含类与其他函数", async () => {
		openFile(NOTE_SYMBOL);
		await waitForSelector(".code-embed-container");
		const text = queryDom(".code-embed-container", { text: true });
		expect(text).toContain("def hello");
		expect(text).not.toContain("def add");
		expect(text).not.toContain("class Greeter");
	});
});
