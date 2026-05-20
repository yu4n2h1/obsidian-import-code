import { CodeEmbedSettings } from "../types";

// ---- embed source parsing ----

export interface ParsedEmbedSource {
	filePath: string;
	symbolName: string;
	highlightSpec: string;
}

export function parseEmbedSource(src: string): ParsedEmbedSource {
	const hashIndex = src.lastIndexOf("#");
	let filePathAndSymbol: string;
	let highlightSpec = "";
	if (hashIndex !== -1 && hashIndex !== src.length - 1) {
		highlightSpec = src.substring(hashIndex + 1);
		filePathAndSymbol = src.substring(0, hashIndex);
	} else {
		filePathAndSymbol = src;
	}

	const atIndex = filePathAndSymbol.lastIndexOf("@");
	if (atIndex === -1 || atIndex === filePathAndSymbol.length - 1) {
		return { filePath: filePathAndSymbol, symbolName: "", highlightSpec };
	}
	return {
		filePath: filePathAndSymbol.substring(0, atIndex),
		symbolName: filePathAndSymbol.substring(atIndex + 1),
		highlightSpec,
	};
}

export function isRemoteUrl(path: string): boolean {
	return path.startsWith("https://") || path.startsWith("http://");
}

export function isAliasPath(path: string): boolean {
	return /^[a-zA-Z0-9_-]+:(?!\/\/)/.test(path);
}

export function parseAliasPath(path: string): { alias: string; relativePath: string } | null {
	const match = /^([a-zA-Z0-9_-]+):(?!\/\/)(.+)$/.exec(path);
	if (!match || !match[1] || !match[2]) return null;
	return { alias: match[1], relativePath: match[2] };
}

export function isPartialIpv6Url(path: string): boolean {
	return isRemoteUrl(path) && path.includes("[") && !path.includes("]");
}

export function tryRestoreIpv6Url(partial: string, embed: HTMLElement): string | null {
	const node = embed.nextSibling;
	if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent) return null;

	const after = node.textContent;
	const bracketEnd = after.indexOf("]");
	if (bracketEnd === -1) return null;

	const restored = partial + after.substring(0, bracketEnd + 1);

	node.textContent = after.substring(bracketEnd + 1);

	return restored;
}

export interface LineRange {
	start: number;
	end?: number;
}

export function parseLineRange(raw: string): LineRange | null {
	const match = /^(\d+)(?:-(\d+))?$/.exec(raw);
	if (!match || !match[1]) return null;
	const start = parseInt(match[1], 10);
	const end = match[2] ? parseInt(match[2], 10) : undefined;
	return { start, end };
}

// ---- debounce ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
	fn: T,
	delay: number
): T {
	let timeoutId: number | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return ((...args: any[]) => {
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
		}
		timeoutId = window.setTimeout(() => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			fn(...args);
			timeoutId = null;
		}, delay);
	}) as T;
}

// ---- extension support ----

export function getSupportedExtensions(settings: CodeEmbedSettings): string[] {
	return settings.codeFileExtensions.split(",").map((ext) => ext.trim());
}

export function isExtensionSupported(
	settings: CodeEmbedSettings,
	extension: string
): boolean {
	return getSupportedExtensions(settings).includes(extension);
}
