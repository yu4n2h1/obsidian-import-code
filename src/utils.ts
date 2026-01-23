import { CodeEmbedSettings } from "./settings";
// Map file extensions to language identifiers for syntax highlighting

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
	js: "javascript",
	ts: "typescript",
	py: "python",
	rb: "ruby",
	java: "java",
	c: "c",
	cpp: "cpp",
	h: "c",
	hpp: "cpp",
	cs: "csharp",
	go: "go",
	rs: "rust",
	swift: "swift",
	kt: "kotlin",
	scala: "scala",
	php: "php",
	sh: "bash",
	bash: "bash",
	zsh: "bash",
	ps1: "powershell",
	sql: "sql",
	html: "html",
	css: "css",
	scss: "scss",
	less: "less",
	json: "json",
	xml: "xml",
	yaml: "yaml",
	yml: "yaml",
	toml: "toml",
	md: "markdown",
	lua: "lua",
	r: "r",
	pl: "perl",
	ex: "elixir",
	exs: "elixir",
	erl: "erlang",
	clj: "clojure",
	hs: "haskell",
	ml: "ocaml",
	fs: "fsharp",
	vue: "vue",
	svelte: "svelte",
	jsx: "jsx",
	tsx: "tsx",
	csv: "csv",
};

// Get the language identifier for a file path
export function getLanguageFromPath(path: string): [string, string] {
	const parts = path.split(".");
	const extension = parts[parts.length - 1]?.toLowerCase() ?? "";
	const language = EXTENSION_TO_LANGUAGE[extension] || "";
	return [extension, language];
}

export function getSupportedExtensions(settings: CodeEmbedSettings): string[] {
	return settings.codeFileExtensions.split(",").map((ext) => ext.trim());
}


export function isExtensionSupported(settings: CodeEmbedSettings, extension: string): boolean {
	return getSupportedExtensions(settings).includes(extension);
}
