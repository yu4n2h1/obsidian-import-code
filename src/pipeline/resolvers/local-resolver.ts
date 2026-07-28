import { App, TFile } from "obsidian";
import type { CodeEmbedSettings } from "../../types";
import { getLanguageFromPath } from "../../utils/language";
import type { ResolvedContent } from "../types";

export class LocalResolver {
	constructor(private app: App, private settings: CodeEmbedSettings) {}

	async resolve(filePath: string, sourcePath: string): Promise<ResolvedContent> {
		const file = this.app.metadataCache.getFirstLinkpathDest(filePath, sourcePath);
		if (!(file instanceof TFile)) throw new Error(`File not found: ${filePath}`);
		const content = await this.app.vault.read(file);
		const [, language] = getLanguageFromPath(filePath, this.settings);
		return { content, language, filePath, sourceMode: "local" };
	}
}
