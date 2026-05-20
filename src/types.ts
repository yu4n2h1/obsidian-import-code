export interface CodeEmbedSettings {
	codeEmbedEnabled: "enabled" | "disabled";
	remoteCodeEmbedEnabled: "enabled" | "disabled";
	remoteSkipSslVerify: boolean;
	codeFileExtensions: string;
	remoteSources: Record<string, RemoteSourceEntry>;
}

export interface FileStorageSettings {
	storagePathType: "absolute" | "relative";
	absoluteStoragePath: string;
	relativeStoragePath: string;
	fileNameStrategy: "hash" | "custom" | "auto";
}

export type RemoteServiceType = "webdav" | "github" | "gitlab" | "gitea" | "generic";

export interface RemoteServiceConfig {
	url: string;
	token: string;
	username?: string;
	repo?: string;
	branch?: string;
	path?: string;
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
	codeFileExtensions:
		"js,ts,py,java,c,cpp,go,rs,rb,php,sh,sql,html,css,json,yaml,xml",
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
}
