import type { RemoteServiceConfig } from "../types";
import type { RemoteReadResult, RemoteService, RemoteReadParams } from "./types";
import { buildFullPath, enrichError, getRequire } from "../utils/http-client";
function resolveFullPath(config: RemoteServiceConfig, filePath: string): string {
	const baseDir = config.url || "";
	const relativePath = buildFullPath(config.path, filePath);
	const pathModule = getRequire()("path") as { resolve(...args: string[]): string };
	return pathModule.resolve(baseDir, relativePath);
}

export const localService: RemoteService = {
	serviceType: "local" as const,

	async read(params: RemoteReadParams): Promise<RemoteReadResult> {
		const { config, filePath } = params;
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
