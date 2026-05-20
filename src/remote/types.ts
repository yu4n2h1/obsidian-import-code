import { RemoteServiceConfig, RemoteServiceType } from "../types";

export interface RemoteReadResult {
	success: boolean;
	content?: string;
	error?: string;
}

export interface RemoteUploadResult {
	success: boolean;
	url?: string;
	error?: string;
}

export interface RemoteUploadOptions {
	content: string;
	fileName: string;
	config: RemoteServiceConfig;
	skipSslVerify: boolean;
}

export interface RemoteService {
	readonly serviceType: RemoteServiceType;
	read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult>;
	upload(options: RemoteUploadOptions): Promise<RemoteUploadResult>;
}
