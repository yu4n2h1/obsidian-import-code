import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// 默认只跑 tests/ 单测；e2e 用 `--config e2e/vitest.config.ts` 单独跑
		include: ["tests/**/*.test.ts"],
	},
});
