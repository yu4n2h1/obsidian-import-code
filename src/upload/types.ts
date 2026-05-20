import { RemoteServiceConfig, RemoteServiceType } from "../types";

export interface UploadResult {
	success: boolean;
	url?: string;
	error?: string;
}

export interface UploadOptions {
	content: string;
	fileName: string;
	config: RemoteServiceConfig;
	skipSslVerify: boolean;
}

export interface RemoteUploader {
	readonly serviceType: RemoteServiceType;
	upload(options: UploadOptions): Promise<UploadResult>;
}
