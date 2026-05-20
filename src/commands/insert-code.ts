import { App, Editor, Notice } from "obsidian";
import { PluginSettings, EmbedLinkInfo, LastFileReference } from "../types";
import { FileModal } from "../ui/modal";
import { EditLinkModal } from "../ui/edit-link-modal";

export function createInsertCodeCallback(
	app: App,
	settings: PluginSettings,
	refStore: {
		loadLastFileReference(): Promise<LastFileReference | null>;
		saveLastFileReference(ref: LastFileReference): Promise<void>;
	}
): (editor: Editor) => void {
	return (editor: Editor) => {
		new FileModal(app, settings, (info: EmbedLinkInfo) => {
			const { linkPath, displayName } = info;
			const link = `![[${linkPath}|${displayName}]]`;
			editor.replaceSelection(link);

			// Persist last file reference
			const lastRef: LastFileReference = {
				linkPath: info.linkPath,
				content: info.content,
				fileName: displayName,
				extension: info.extension,
				symbolName: info.symbolName,
				highlightSpec: info.highlightSpec,
				storagePathType: info.storagePathType,
				storagePath: info.storagePath,
				timestamp: Date.now(),
			};
			void refStore.saveLastFileReference(lastRef);
		}).open();
	};
}

export function createEditLastCodeCallback(
	app: App,
	refStore: {
		loadLastFileReference(): Promise<LastFileReference | null>;
		saveLastFileReference(ref: LastFileReference): Promise<void>;
	}
): (editor: Editor) => void {
	return async (editor: Editor) => {
		const lastRef = await refStore.loadLastFileReference();
		if (!lastRef) {
			new Notice(
				'No code file created yet. Use "Insert embed code" first.'
			);
			return;
		}

		new EditLinkModal(
			app,
			lastRef,
			(linkText: string, symbolName: string, highlightSpec: string) => {
				editor.replaceSelection(linkText);

				// Update persisted reference with new symbol/highlight
				lastRef.symbolName = symbolName;
				lastRef.highlightSpec = highlightSpec;
				lastRef.timestamp = Date.now();
				void refStore.saveLastFileReference(lastRef);
			}
		).open();
	};
}
