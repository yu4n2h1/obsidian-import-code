import type { RemoteServiceConfig, RemoteServiceType } from "../types";

export interface RemoteReadResult {
	success: boolean;
	content?: string;
	error?: string;
}

export interface RemoteReadParams {
	config: RemoteServiceConfig;
	filePath: string;
	skipSslVerify: boolean;
}

export interface RemoteService {
	readonly serviceType: RemoteServiceType;
	read(params: RemoteReadParams): Promise<RemoteReadResult>;
}
