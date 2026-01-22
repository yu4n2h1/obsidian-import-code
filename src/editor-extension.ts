import { EditorView, WidgetType, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { App, MarkdownRenderer, TFile, Component, setIcon } from 'obsidian';
import { CodeEmbedSettings } from './code-embed-processor';

// Map file extensions to language identifiers
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
	'js': 'javascript',
	'ts': 'typescript',
	'py': 'python',
	'rb': 'ruby',
	'java': 'java',
	'c': 'c',
	'cpp': 'cpp',
	'h': 'c',
	'hpp': 'cpp',
	'cs': 'csharp',
	'go': 'go',
	'rs': 'rust',
	'swift': 'swift',
	'kt': 'kotlin',
	'scala': 'scala',
	'php': 'php',
	'sh': 'bash',
	'bash': 'bash',
	'zsh': 'bash',
	'ps1': 'powershell',
	'sql': 'sql',
	'html': 'html',
	'css': 'css',
	'scss': 'scss',
	'less': 'less',
	'json': 'json',
	'xml': 'xml',
	'yaml': 'yaml',
	'yml': 'yaml',
	'toml': 'toml',
	'md': 'markdown',
	'lua': 'lua',
	'r': 'r',
	'pl': 'perl',
	'ex': 'elixir',
	'exs': 'elixir',
	'erl': 'erlang',
	'clj': 'clojure',
	'hs': 'haskell',
	'ml': 'ocaml',
	'fs': 'fsharp',
	'vue': 'vue',
	'svelte': 'svelte',
	'jsx': 'jsx',
	'tsx': 'tsx',
};

function getLanguageFromPath(filePath: string): string {
	const ext = filePath.split('.').pop()?.toLowerCase() || '';
	return EXTENSION_TO_LANGUAGE[ext] || ext;
}

/**
 * Widget to display code file content with syntax highlighting
 */
class CodeBlockWidget extends WidgetType {
	private app: App;
	private filePath: string;
	private sourcePath: string;
	private component: Component;

	constructor(app: App, filePath: string, sourcePath: string, component: Component) {
		super();
		this.app = app;
		this.filePath = filePath;
		this.sourcePath = sourcePath;
		this.component = component;
	}

	toDOM(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'code-embed-widget code-embed-container';
		container.setAttribute('contenteditable', 'false');
		
		// Prevent click from opening the file
		container.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
		});
		
		// Show loading state initially
		const loading = document.createElement('div');
		loading.className = 'code-embed-loading';
		loading.textContent = 'Loading...';
		container.appendChild(loading);

		// Load and render the code file asynchronously
		this.loadAndRender(container);

		return container;
	}

	private async loadAndRender(container: HTMLElement): Promise<void> {
		try {
			const file = this.app.metadataCache.getFirstLinkpathDest(this.filePath, this.sourcePath);
			
			if (file instanceof TFile) {
				const content = await this.app.vault.read(file);
				const language = getLanguageFromPath(this.filePath);
				
				// Clear loading state
				container.empty();
				
				// Create inner container with label
				const innerContainer = container.createDiv({ cls: 'code-embed-container' });
				innerContainer.createDiv({ cls: 'code-embed-label', text: language });
				
				// Create "Open File" button
				const openButton = innerContainer.createDiv({ cls: 'code-embed-open-btn' });
				setIcon(openButton, 'external-link');
				openButton.setAttribute('aria-label', 'Open file');
				openButton.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
					this.app.workspace.openLinkText(this.filePath, this.sourcePath);
				});
				
				const wrapper = innerContainer.createDiv({ cls: 'code-embed-wrapper' });
				
				// Render code block using Obsidian's MarkdownRenderer
				const markdownCodeBlock = '```' + language + '\n' + content + '\n```';
				await MarkdownRenderer.render(
					this.app,
					markdownCodeBlock,
					wrapper,
					this.sourcePath,
					this.component
				);
			} else {
				container.empty();
				container.createDiv({ 
					cls: 'code-embed-error',
					text: `File not found: ${this.filePath}`
				});
			}
		} catch (error) {
			console.error('Failed to load code file:', this.filePath, error);
			container.empty();
			container.createDiv({ 
				cls: 'code-embed-error',
				text: `Error loading: ${this.filePath}`
			});
		}
	}

	eq(other: WidgetType): boolean {
		return other instanceof CodeBlockWidget && 
			other.filePath === this.filePath &&
			other.sourcePath === this.sourcePath;
	}
}

/**
 * Create the CodeMirror extension for code file embeds
 */
export function createCodeEmbedExtension(
	app: App, 
	settings: CodeEmbedSettings,
	component: Component,
	getSourcePath: () => string
) {
	return ViewPlugin.fromClass(
		class {
			decorations: DecorationSet;

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
			}

			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged) {
					this.decorations = this.buildDecorations(update.view);
				}
			}

			buildDecorations(view: EditorView): DecorationSet {
				const decorations: any[] = [];
				
				if (settings.codeEmbedEnabled !== 'enabled') {
					return Decoration.none;
				}

				const extensions = settings.codeFileExtensions
					.split(',')
					.map(ext => ext.trim().toLowerCase())
					.filter(ext => ext.length > 0);

				if (extensions.length === 0) {
					return Decoration.none;
				}

				const sourcePath = getSourcePath();

				// Iterate through the syntax tree to find embed syntax
				syntaxTree(view.state).iterate({
					enter: (node) => {
						// Look for internal embeds: ![[filename.ext]]
						if (node.name === 'formatting-embed' || 
							node.name === 'hmd-internal-link' ||
							node.name.includes('embed')) {
							
							const text = view.state.doc.sliceString(node.from, node.to);
							
							// Match ![[filename.ext]] pattern
							const match = text.match(/!\[\[([^\]]+)\]\]/);
							if (match && match[1]) {
								const filePath: string = match[1];
								const ext = filePath.split('.').pop()?.toLowerCase() || '';
								
								if (extensions.includes(ext)) {
									const widget = new CodeBlockWidget(app, filePath, sourcePath, component);
									decorations.push(
										Decoration.replace({
											widget,
											block: true,
										}).range(node.from, node.to)
									);
								}
							}
						}
					}
				});

				return Decoration.set(decorations, true);
			}
		},
		{
			decorations: v => v.decorations,
		}
	);
}
