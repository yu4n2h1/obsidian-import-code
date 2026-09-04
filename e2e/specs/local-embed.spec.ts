import { describe, it, expect, beforeAll } from "vitest";
import { seed } from "../fixtures/seed";
import { openFile } from "../harness/cli";
import { waitForSelector, queryDom } from "../harness/dom";
import { NOTE_FULL, NOTE_TS } from "../harness/paths";

describe("本地 embed 渲染", () => {
	beforeAll(() => {
		seed();
	});

	it("全文件 embed 渲染出完整代码", async () => {
		openFile(NOTE_FULL);
		await waitForSelector(".code-embed-container");
		const text = queryDom(".code-embed-container", { text: true });
		expect(text).toContain("def hello");
		expect(text).toContain("class Greeter");
	});

	it("TypeScript 文件按 typescript 高亮", async () => {
		openFile(NOTE_TS);
		await waitForSelector(".code-embed-container");
		const text = queryDom(".code-embed-container", { text: true });
		expect(text).toContain("greetTs");
		// Prism 生成的 code 元素带 language-typescript class
		const codeClass = queryDom(".code-embed-container code", { attr: "class" });
		expect(codeClass).toContain("language-typescript");
	});
});
