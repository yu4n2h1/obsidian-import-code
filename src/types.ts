export interface CodeEmbedSettings {
	codeEmbedEnabled: "enabled" | "disabled";
	remoteCodeEmbedEnabled: "enabled" | "disabled";
	remoteSkipSslVerify: boolean;
	codeFileExtensions: string;
}

export interface FileStorageSettings {
	storagePathType: "absolute" | "relative" | "remote";
	absoluteStoragePath: string;
	relativeStoragePath: string;
	fileNameStrategy: "hash" | "content";
}

export type RemoteServiceType = "webdav" | "github" | "gitlab" | "gitea";

export interface RemoteServiceConfig {
	url: string;
	token: string;
	username?: string;
	repo?: string;
	branch?: string;
	uploadPath?: string;
}

export interface RemoteUploadSettings {
	remoteServices: Partial<Record<RemoteServiceType, RemoteServiceConfig>>;
}

export interface PluginSettings
	extends CodeEmbedSettings,
		FileStorageSettings,
		RemoteUploadSettings {}

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
	remoteServices: {},
};

export interface EmbedLinkInfo {
	linkPath: string;
	displayName: string;
	content: string;
	isRemote: boolean;
	extension: string;
	symbolName: string;
	highlightSpec: string;
	storagePathType: "absolute" | "relative" | "remote";
	storagePath: string;
}

export interface LastFileReference {
	linkPath: string;
	content: string;
	fileName: string;
	extension: string;
	symbolName: string;
	highlightSpec: string;
	storagePathType: "absolute" | "relative" | "remote";
	storagePath: string;
	isRemote: boolean;
	remoteServiceType?: RemoteServiceType;
	timestamp: number;
}

export interface SettingsProvider {
	settings: PluginSettings;
	saveSettings(): Promise<void>;
}
