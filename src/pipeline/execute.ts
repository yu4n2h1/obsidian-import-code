import type { ContentResolver } from "./content-resolver";
import { classifyTargets } from "./target-resolver";
import { computeDisplayRange, sliceContent } from "./range-converter";
import type { PipelineResult } from "./types";

export async function executePipeline(
	contentResolver: ContentResolver,
	filePath: string,
	sourcePath: string,
	symbolName: string,
	highlightSpec: string,
): Promise<PipelineResult> {
	try {
		const resolved = await contentResolver.resolve(filePath, sourcePath);
		const targets = classifyTargets(symbolName, highlightSpec);

		const displayRange = computeDisplayRange(
			targets.display,
			resolved.content,
			resolved.language,
		);

		const sliced = sliceContent(
			resolved.content,
			displayRange,
			targets.highlight,
			resolved.language,
		);

		return { success: true, file: resolved, slice: sliced };
	} catch (err) {
		return {
			success: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
