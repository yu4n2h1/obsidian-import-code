import { describe, it, expect, beforeAll } from "vitest";
import { seed } from "../fixtures/seed";
import { openFile } from "../harness/cli";
import { waitForSelector, countDom } from "../harness/dom";
import { NOTE_HIGHLIGHT } from "../harness/paths";

describe("#start-end 高亮标记", () => {
	beforeAll(() => {
		seed();
	});

	it("#2-4 高亮 3 行", async () => {
		openFile(NOTE_HIGHLIGHT);
		await waitForSelector(".code-highlight-line");
		expect(countDom(".code-highlight-line")).toBe(3);
	});
});
