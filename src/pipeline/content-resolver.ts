import { App } from "obsidian";
import type { CodeEmbedSettings } from "../types";
import { classifyPath } from "../utils/helpers";
import { HttpResolver } from "./resolvers/http-resolver";
import { AliasResolver } from "./resolvers/alias-resolver";
import { LocalResolver } from "./resolvers/local-resolver";
import type { ResolvedContent } from "./types";

export class ContentResolver {
	private aliasResolver: AliasResolver;
	private httpResolver: HttpResolver;
	private localResolver: LocalResolver;

	constructor(app: App, settings: CodeEmbedSettings) {
		this.aliasResolver = new AliasResolver(settings);
		this.httpResolver = new HttpResolver(settings);
		this.localResolver = new LocalResolver(app, settings);
	}

	async resolve(filePath: string, sourcePath: string): Promise<ResolvedContent> {
		const mode = classifyPath(filePath);
		switch (mode) {
			case "http":
				return await this.httpResolver.resolve(filePath);
			case "alias":
				return await this.aliasResolver.resolve(filePath);
			case "local":
				return await this.localResolver.resolve(filePath, sourcePath);
			default:
				throw new Error(`Unsupported path mode: ${JSON.stringify(mode)}`);
		}
	}
}
