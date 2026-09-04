import tseslint from 'typescript-eslint';
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
				// Obsidian 全局 DOM helper（createDiv/createSpan/createEl 等），
				// obsidianmd 插件的 globals 未覆盖，手动补齐避免 no-undef 误报
				createDiv: "readonly",
				createSpan: "readonly",
				createEl: "readonly",
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						'eslint.config.js',
						'manifest.json',
						'vitest.config.ts'
					]
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json']
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		plugins: { obsidianmd },
		rules: {
			"obsidianmd/ui/sentence-case": ["error", {
				// 这些是技术标识/产品名/代号，不适用 sentence-case 规则
				ignoreRegex: [
					"WebDAV",
					"GitHub Gist",
					"L\\d+-L\\d+",
					"ghp_",
				],
			}],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
		"tests",
		"e2e",
	]),
);
