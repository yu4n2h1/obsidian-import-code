import { CodeEmbedSettings } from "../types";

export function getSupportedExtensions(settings: CodeEmbedSettings): string[] {
	return settings.codeFileExtensions.split(",").map((ext) => ext.trim());
}

export function isExtensionSupported(
	settings: CodeEmbedSettings,
	extension: string
): boolean {
	return getSupportedExtensions(settings).includes(extension);
}
