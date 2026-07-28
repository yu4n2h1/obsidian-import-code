import type { CodeEmbedSettings } from "../../types";
import { getLanguageFromPath } from "../../utils/language";
import { readRemoteFile } from "../../fetchers";
import type { ResolvedContent } from "../types";

export class HttpResolver {
	constructor(private settings: CodeEmbedSettings) {}

	async resolve(url: string): Promise<ResolvedContent> {
		const content = await readRemoteFile(url, this.settings.remoteSkipSslVerify);
		if (content === null) throw new Error(`Failed to read remote file: ${url}`);
		const [, language] = getLanguageFromPath(url, this.settings);
		return { content, language, filePath: url, sourceMode: "http" };
	}
}
