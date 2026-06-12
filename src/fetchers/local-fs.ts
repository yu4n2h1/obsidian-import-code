import type { RemoteServiceConfig } from "../types";
import type { RemoteReadResult, RemoteService } from "./types";
import { buildFullPath, enrichError, getRequire } from "../utils/http-client";
import * as path from "path";

function resolveFullPath(config: RemoteServiceConfig, filePath: string): string {
	const baseDir = config.url || "";
	const relativePath = buildFullPath(config.path, filePath);
	return path.resolve(baseDir, relativePath);
}

export const localService: RemoteService = {
	serviceType: "local" as const,

	async read(config: RemoteServiceConfig, filePath: string, _skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const fullPath = resolveFullPath(config, filePath);
			const requireFn = getRequire();
			const fs = requireFn("fs") as { readFileSync(path: string, encoding: string): string };
			const content = fs.readFileSync(fullPath, "utf-8");
			return { success: true, content };
		} catch (err) {
			return { success: false, error: enrichError(err, "Local read failed") };
		}
	},
};
