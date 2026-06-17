import { App, TFile } from "obsidian";
import type { CodeEmbedSettings } from "../types";
import { parseAliasPath } from "../utils/helpers";
import { getLanguageFromPath } from "../utils/language";
import { readRemoteFile, readFromService } from "../fetchers";
import type { ResolvedLink, FileContext } from "./types";

/**
 * 阶段 2：文件读取器。
 * 根据 ResolvedLink 的模式，统一读取文件内容。
 */
export class FileReader {
	private app: App;
	private settings: CodeEmbedSettings;

	constructor(app: App, settings: CodeEmbedSettings) {
		this.app = app;
		this.settings = settings;
	}

	/** 根据链路模式分发读取，返回完整的 FileContext */
	async read(link: ResolvedLink, sourcePath: string): Promise<FileContext> {
		const { filePath, mode } = link;
		const [, language] = getLanguageFromPath(filePath, this.settings);

		const content =
			mode === "http"  ? await this.readFromHttp(filePath)
			: mode === "alias" ? await this.readFromAlias(filePath)
			: await this.readFromLocal(filePath, sourcePath);

		return { content, filePath, language };
	}

	private async readFromHttp(url: string): Promise<string> {
		const content = await readRemoteFile(url, this.settings.remoteSkipSslVerify);
		if (content === null) throw new Error(`Failed to read remote file: ${url}`);
		return content;
	}

	private async readFromAlias(filePath: string): Promise<string> {
		const aliasParsed = parseAliasPath(filePath);
		if (!aliasParsed) throw new Error(`Invalid alias path: ${filePath}`);

		const sourceEntry = this.settings.remoteSources[aliasParsed.alias];
		if (!sourceEntry) throw new Error(`Remote source alias "${aliasParsed.alias}" is not configured.`);

		const result = await readFromService(
			sourceEntry.serviceType,
			sourceEntry.config,
			aliasParsed.relativePath,
			sourceEntry.config.skipSslVerify ?? false,
		);
		if (!result.success || result.content === undefined) {
			throw new Error(result.error || `Failed to read "${aliasParsed.relativePath}" from "${aliasParsed.alias}".`);
		}
		return result.content;
	}

	private async readFromLocal(filePath: string, sourcePath: string): Promise<string> {
		const file = this.app.metadataCache.getFirstLinkpathDest(filePath, sourcePath);
		if (file instanceof TFile) return await this.app.vault.read(file);
		throw new Error(`File not found: ${filePath}`);
	}
}
