import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["e2e/specs/**/*.spec.ts"],
		// 共享一个 Obsidian 实例，串行执行避免并发打开笔记互相干扰
		fileParallelism: false,
		testTimeout: 20000,
		hookTimeout: 20000,
	},
});
