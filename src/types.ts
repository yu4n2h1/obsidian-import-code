import { EXTENSION_TO_LANGUAGE } from "./utils/constants";

export interface ExtensionEntry {
	suffix: string;   // file extension without dot, e.g. "js"
	dialect: string;  // display name, e.g. "javascript"
	active: boolean;  // enable/disable toggle
}

export interface CodeEmbedSettings {
	codeEmbedEnabled: "enabled" | "disabled";
	remoteCodeEmbedEnabled: "enabled" | "disabled";
	remoteSkipSslVerify: boolean;
	codeFileExtensions: ExtensionEntry[];
	remoteSources: Record<string, RemoteSourceEntry>;
}

function buildDefaultExtensions(): ExtensionEntry[] {
	const activeByDefault = new Set([
		"js", "ts", "py", "java", "c", "cpp", "go", "rs", "rb",
		"php", "sh", "sql", "html", "css", "json", "yaml", "xml",
	]);
	const entries: ExtensionEntry[] = [];
	for (const [suffix, dialect] of Object.entries(EXTENSION_TO_LANGUAGE)) {
		entries.push({ suffix, dialect, active: activeByDefault.has(suffix) });
	}
	return entries;
}

export interface FileStorageSettings {
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
	skipSslVerify?: boolean;
}

export interface RemoteSourceEntry {
	serviceType: RemoteServiceType;
	config: RemoteServiceConfig;
}

// ---- Upload Sources ----

export interface UploadSourceConfig {
	/** WebDAV 服务 URL */
	url?: string;
	/** 认证令牌 (WebDAV / GitHub Gist) */
	token?: string;
	/** WebDAV 用户名（Basic 认证） */
	username?: string;
	/** 远程路径前缀 */
	pathPrefix?: string;
	/** GitHub Gist API URL（默认 https://api.github.com） */
	apiUrl?: string;
	/** 跳过 SSL 证书验证 */
	skipSslVerify?: boolean;
	/** 本地存储路径类型 */
	storagePathType?: "absolute" | "relative";
	/** 本地绝对路径（relative to vault root） */
	absolutePath?: string;
	/** 本地相对路径（relative to current note） */
	relativePath?: string;
}

export interface UploadSourceEntry {
	uploadType: "local" | "webdav" | "github-gist";
	/** 生成 wiki 链接时是否带别名（![[path|alias]] vs ![[path]]），默认 true */
	useAlias?: boolean;
	config: UploadSourceConfig;
}

export interface PluginSettings
	extends CodeEmbedSettings,
		FileStorageSettings {
	uploadSources: Record<string, UploadSourceEntry>;
}

export const DEFAULT_SETTINGS: PluginSettings = {
	codeEmbedEnabled: "enabled",
	remoteCodeEmbedEnabled: "enabled",
	remoteSkipSslVerify: false,
	codeFileExtensions: buildDefaultExtensions(),
	fileNameStrategy: "hash",
	remoteSources: {},
	uploadSources: {
		Local: {
			uploadType: "local",
			useAlias: true,
			config: { storagePathType: "absolute", absolutePath: "assets" },
		},
	},
};

export interface EmbedLinkInfo {
	linkPath: string;
	displayName: string;
	/** 生成 wiki 链接时是否带别名 */
	useAlias: boolean;
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
	/** 生成 wiki 链接时是否带别名 */
	useAlias: boolean;
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
	resetMarkdownViews(): void;
}
