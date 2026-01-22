import {TFile, App, MarkdownRenderer, Component, setIcon} from 'obsidian';

export interface CodeEmbedSettings {
	codeEmbedEnabled: string;
	codeFileExtensions: string;
}

// Map file extensions to language identifiers for syntax highlighting
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

export class CodeEmbedProcessor {
	settings: CodeEmbedSettings;
	app: App;
	plugin: Component;  // Use plugin as Component for proper lifecycle

	constructor(app: App, settings: CodeEmbedSettings, plugin: Component) {
		this.app = app;
		this.settings = settings;
		this.plugin = plugin;
	}

	/**
	 * Get the list of supported file extensions from settings
	 */
	getSupportedExtensions(): string[] {
		const extensions = this.settings.codeFileExtensions
			.split(',')
			.map(ext => ext.trim().toLowerCase())
			.filter(ext => ext.length > 0);
		return extensions;
	}

	/**
	 * Check if a file extension is supported
	 */
	isExtensionSupported(filePath: string): boolean {
		const extensions = this.getSupportedExtensions();
		const lowerPath = filePath.toLowerCase();
		return extensions.some(ext => lowerPath.endsWith('.' + ext));
	}

	/**
	 * Get language identifier from file extension for syntax highlighting
	 */
	getLanguageFromPath(filePath: string): string {
		const ext = filePath.split('.').pop()?.toLowerCase() || '';
		return EXTENSION_TO_LANGUAGE[ext] || ext;
	}

	/**
	 * Build CSS selector for all supported extensions
	 */
	buildSelector(): string {
		const extensions = this.getSupportedExtensions();
		if (extensions.length === 0) {
			return '';
		}
		
		const selectors = extensions.flatMap(ext => [
			`.internal-embed[src$=".${ext}"]:not(.code-embed-processed)`,
			`.internal-embed[src$=".${ext.toUpperCase()}"]:not(.code-embed-processed)`
		]);
		
		return selectors.join(', ');
	}

	/**
	 * Render code content with syntax highlighting using Obsidian's native renderer
	 */
	async renderCode(content: string, language: string, el: HTMLElement, sourcePath: string, filePath: string): Promise<void> {
		// Create code container
		const container = el.createDiv({ cls: 'code-embed-container' });
		
		// Add language label
		const label = container.createDiv({ cls: 'code-embed-label', text: language });
		
		// Add "Open File" button
		const openButton = container.createDiv({ cls: 'code-embed-open-btn' });
		setIcon(openButton, 'external-link');
		openButton.setAttribute('aria-label', 'Open file');
		openButton.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.app.workspace.openLinkText(filePath, sourcePath);
		});
		
		// Create a wrapper for the code block
		const codeWrapper = container.createDiv({ cls: 'code-embed-wrapper' });
		
		// Create markdown code block syntax for rendering
		const markdownCodeBlock = '```' + language + '\n' + content + '\n```';
		
		// Use Obsidian's native MarkdownRenderer with plugin as Component
		await MarkdownRenderer.render(
			this.app,
			markdownCodeBlock,
			codeWrapper,
			sourcePath,
			this.plugin
		);
		
		// Trigger syntax highlighting multiple times with increasing delays
		// This ensures highlighting works in both Reading mode and Live Preview mode
		this.triggerHighlighting(codeWrapper);
	}
	
	/**
	 * Trigger Prism.js syntax highlighting with retries
	 */
	private triggerHighlighting(container: HTMLElement): void {
		const highlightBlocks = () => {
			const codeBlocks = container.querySelectorAll('pre code:not(.is-loaded)');
			codeBlocks.forEach((block) => {
				// Add 'is-loaded' class like Obsidian does
				block.addClass('is-loaded');
				
				// Try Prism.js first (used in Reading mode)
				// @ts-ignore - Prism is globally available in Obsidian
				if (typeof Prism !== 'undefined' && Prism.highlightElement) {
					try {
						// @ts-ignore
						Prism.highlightElement(block);
					} catch (e) {
						console.warn('Prism highlight failed:', e);
					}
				}
			});
		};
		
		// Try multiple times with increasing delays to handle async rendering
		setTimeout(highlightBlocks, 0);
		setTimeout(highlightBlocks, 50);
		setTimeout(highlightBlocks, 150);
		requestAnimationFrame(highlightBlocks);
	}

	/**
	 * Render code file and replace target element
	 */
	async renderCodeFile(filePath: string, targetElement: HTMLElement, sourcePath: string): Promise<boolean> {
		try {
			// Get the code file
			const file = this.app.metadataCache.getFirstLinkpathDest(filePath, sourcePath);
			
			if (file instanceof TFile) {
				console.log('Reading code file:', file.path);
				const content = await this.app.vault.read(file);
				const language = this.getLanguageFromPath(filePath);
				
				// Clear the element and render code
				targetElement.empty();
				targetElement.addClass('code-embed-container');
				
				// Prevent click from opening file
				targetElement.addEventListener('click', (e) => {
					e.preventDefault();
					e.stopPropagation();
				});
				
				await this.renderCode(content, language, targetElement, sourcePath, filePath);
				
				console.log('Successfully rendered code file:', filePath);
				return true;
			} else {
				console.warn('Code file not found:', filePath);
				targetElement.empty();
				targetElement.createDiv({ 
					text: `File not found: ${filePath}`, 
					cls: 'code-embed-error' 
				});
				return false;
			}
		} catch (error) {
			console.error(`Failed to read code file: ${filePath}`, error);
			targetElement.empty();
			targetElement.createDiv({ 
				text: `Error loading file: ${filePath}`, 
				cls: 'code-embed-error' 
			});
			return false;
		}
	}

	/**
	 * Update settings reference
	 */
	updateSettings(settings: CodeEmbedSettings): void {
		this.settings = settings;
	}
}
