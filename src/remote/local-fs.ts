import { RemoteServiceConfig } from "../types";
import { RemoteReadResult } from "./types";
import { buildFullPath, enrichError, getRequire } from "./http-client";

function resolveFullPath(config: RemoteServiceConfig, filePath: string): string {
	const baseDir = config.url || "";
	if (!baseDir) {
		throw new Error("Base directory is not configured for this local source.");
	}
	const relativePath = buildFullPath(config.path, filePath);
	const requireFn = getRequire();
	const nodePath = requireFn("path") as { resolve(...segments: string[]): string; normalize(p: string): string; relative(from: string, to: string): string };
	const resolvedBase = nodePath.resolve(baseDir);
	const fullPath = nodePath.resolve(resolvedBase, relativePath);
	// Prevent path traversal: ensure the resolved path stays within the base directory
	const rel = nodePath.relative(resolvedBase, fullPath);
	if (rel.startsWith("..") || nodePath.resolve(fullPath) !== fullPath) {
		throw new Error(`Path traversal detected: "${filePath}" resolves outside the configured base directory.`);
	}
	return fullPath;
}

export const localService = {
	serviceType: "local" as const,

	async read(config: RemoteServiceConfig, filePath: string, _skipSslVerify: boolean): Promise<RemoteReadResult> {
		try {
			const fullPath = resolveFullPath(config, filePath);
			const requireFn = getRequire();
			const fs = requireFn("fs") as { promises: { readFile(path: string, encoding: string): Promise<string> } };
			const content = await fs.promises.readFile(fullPath, "utf-8");
			return { success: true, content };
		} catch (err) {
			return { success: false, error: enrichError(err, "Local read failed") };
		}
	},
};
