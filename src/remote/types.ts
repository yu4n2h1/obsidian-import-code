import { RemoteServiceConfig, RemoteServiceType } from "../types";

export interface RemoteReadResult {
	success: boolean;
	content?: string;
	error?: string;
}

export interface RemoteService {
	readonly serviceType: RemoteServiceType;
	read(config: RemoteServiceConfig, filePath: string, skipSslVerify: boolean): Promise<RemoteReadResult>;
}
