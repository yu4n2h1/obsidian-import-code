import { PluginSettings } from "../types";
import { CodeEmbedProcessor } from "./code-embed";
import { getLanguageFromPath } from "../utils/language";
import { isExtensionSupported } from "../utils/settings-helpers";
import { isRemoteUrl, isPartialIpv6Url, tryRestoreIpv6Url, parseEmbedSource } from "../utils/parse-embed-source";

function processEmbedElement(
	embed: HTMLElement,
	filePath: string,
	symbolName: string,
	highlightSpec: string,
	processor: CodeEmbedProcessor,
	sourcePath: string
): void {
	embed.classList.add("code-link-processed");
	embed.empty();
	processor.processFile(filePath, symbolName, embed, sourcePath, highlightSpec).catch((err) => {
		console.error("processEmbedElement failed:", err);
		embed.setText(`Error: ${err instanceof Error ? err.message : String(err)}`);
	});
}

export function processEmbeds(
	container: HTMLElement,
	codeProcessor: CodeEmbedProcessor,
	settings: PluginSettings,
	sourcePath: string
): void {
	const embeds = container.querySelectorAll(".internal-embed");
	for (let i = 0; i < embeds.length; i++) {
		const embed = embeds[i] as HTMLElement;
		if (embed.classList.contains("code-link-processed")) continue;

		const src = embed.getAttribute("src");
		if (!src) continue;

		let { filePath, symbolName, highlightSpec } = parseEmbedSource(src);

		if (isPartialIpv6Url(filePath)) {
			const restored = tryRestoreIpv6Url(filePath, embed);
			if (restored) {
				filePath = restored;
				const reparsed = parseEmbedSource(filePath);
				symbolName = reparsed.symbolName;
				highlightSpec = reparsed.highlightSpec;
			}
		}

		if (settings.codeEmbedEnabled !== "enabled") continue;

		if (isRemoteUrl(filePath)) {
			if (settings.remoteCodeEmbedEnabled !== "enabled") continue;
		} else {
			const [extension] = getLanguageFromPath(filePath);
			if (!isExtensionSupported(settings, extension)) continue;
		}

		processEmbedElement(
			embed, filePath, symbolName, highlightSpec,
			codeProcessor, sourcePath
		);
	}
}
