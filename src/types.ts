<<<<<<< HEAD
=======
export interface ExtensionEntry {
	suffix: string;   // file extension without dot, e.g. "js"
	dialect: string;  // display name, e.g. "javascript"
	active: boolean;  // enable/disable toggle
}

>>>>>>> develop
export interface CodeEmbedSettings {
	codeEmbedEnabled: "enabled" | "disabled";
	remoteCodeEmbedEnabled: "enabled" | "disabled";
	remoteSkipSslVerify: boolean;
<<<<<<< HEAD
	codeFileExtensions: string;
	remoteSources: Record<string, RemoteSourceEntry>;
}

=======
	codeFileExtensions: ExtensionEntry[];
	remoteSources: Record<string, RemoteSourceEntry>;
}

// Keep in sync with EXTENSION_TO_LANGUAGE in src/utils/constants.ts
function buildDefaultExtensions(): ExtensionEntry[] {
	const map: Record<string, string> = {
		js: "javascript", ts: "typescript", py: "python", rb: "ruby",
		java: "java", c: "c", cpp: "cpp", h: "c", hpp: "cpp",
		cs: "csharp", go: "go", rs: "rust", swift: "swift", kt: "kotlin",
		scala: "scala", php: "php", sh: "bash", bash: "bash", zsh: "bash",
		ps1: "powershell", sql: "sql", html: "html", css: "css",
		scss: "scss", less: "less", json: "json", xml: "xml",
		yaml: "yaml", yml: "yaml", toml: "toml", md: "markdown",
		lua: "lua", r: "r", pl: "perl", ex: "elixir", exs: "elixir",
		erl: "erlang", clj: "clojure", hs: "haskell", ml: "ocaml",
		fs: "fsharp", vue: "vue", svelte: "svelte", jsx: "jsx", tsx: "tsx",
	};
	const activeByDefault = new Set([
		"js", "ts", "py", "java", "c", "cpp", "go", "rs", "rb",
		"php", "sh", "sql", "html", "css", "json", "yaml", "xml",
	]);
	const entries: ExtensionEntry[] = [];
	for (const [suffix, dialect] of Object.entries(map)) {
		entries.push({ suffix, dialect, active: activeByDefault.has(suffix) });
	}
	return entries;
}

>>>>>>> develop
export interface FileStorageSettings {
	storagePathType: "absolute" | "relative";
	absoluteStoragePath: string;
	relativeStoragePath: string;
	fileNameStrategy: "hash" | "custom" | "auto";
}

export type RemoteServiceType = "webdav" | "github" | "gitlab" | "gitea" | "generic" | "local";

export interface RemoteServiceConfig {
	url: string;
	token: string;
	username?: string;
	repo?: string;
	branch?: string;
	path?: string;
<<<<<<< HEAD
=======
	skipSslVerify?: boolean;
>>>>>>> develop
}

export interface RemoteSourceEntry {
	serviceType: RemoteServiceType;
	config: RemoteServiceConfig;
}

export interface PluginSettings
	extends CodeEmbedSettings,
		FileStorageSettings {}

export const DEFAULT_SETTINGS: PluginSettings = {
	codeEmbedEnabled: "enabled",
	remoteCodeEmbedEnabled: "enabled",
	remoteSkipSslVerify: false,
<<<<<<< HEAD
	codeFileExtensions:
		"js,ts,py,java,c,cpp,go,rs,rb,php,sh,sql,html,css,json,yaml,xml",
=======
	codeFileExtensions: buildDefaultExtensions(),
>>>>>>> develop
	storagePathType: "absolute",
	absoluteStoragePath: "assets",
	relativeStoragePath: "./",
	fileNameStrategy: "hash",
	remoteSources: {},
};

export interface EmbedLinkInfo {
	linkPath: string;
	displayName: string;
	content: string;
	extension: string;
	symbolName: string;
	highlightSpec: string;
	storagePathType: "absolute" | "relative";
	storagePath: string;
}

export interface LastFileReference {
	linkPath: string;
	content: string;
	fileName: string;
	extension: string;
	symbolName: string;
	highlightSpec: string;
	storagePathType: "absolute" | "relative";
	storagePath: string;
	timestamp: number;
}

export interface SettingsProvider {
	settings: PluginSettings;
	saveSettings(): Promise<void>;
<<<<<<< HEAD
=======
	resetMarkdownViews(): void;
>>>>>>> develop
}
