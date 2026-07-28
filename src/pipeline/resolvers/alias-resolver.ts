import type { CodeEmbedSettings } from "../../types";
import { parseAliasPath } from "../../utils/helpers";
import { getLanguageFromPath } from "../../utils/language";
import { readFromService } from "../../fetchers";
import type { ResolvedContent } from "../types";

export class AliasResolver {
	constructor(private settings: CodeEmbedSettings) {}

	async resolve(aliasPath: string): Promise<ResolvedContent> {
		const parsed = parseAliasPath(aliasPath);
		if (!parsed) throw new Error(`Invalid alias path: ${aliasPath}`);

		const sourceEntry = this.settings.remoteSources[parsed.alias];
		if (!sourceEntry) {
			throw new Error(`Remote source alias "${parsed.alias}" is not configured.`);
		}

		const result = await readFromService(
			sourceEntry.serviceType,
			sourceEntry.config,
			parsed.relativePath,
			sourceEntry.config.skipSslVerify ?? false,
		);

		if (!result.success || result.content === undefined) {
			throw new Error(result.error || `Failed to read "${parsed.relativePath}" from "${parsed.alias}".`);
		}

		const [, language] = getLanguageFromPath(parsed.relativePath, this.settings);
		return { content: result.content, language, filePath: parsed.relativePath, sourceMode: "alias" };
	}
}
