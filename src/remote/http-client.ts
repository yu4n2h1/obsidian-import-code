import { requestUrl } from "obsidian";

// ---- Helpers ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

function win(): AnyObj {
	return window as unknown as AnyObj;
}

function glob(): AnyObj {
	return globalThis as unknown as AnyObj;
}

// ---- SSL error detection ----

function isSslError(message: string): boolean {
	const lower = message.toLowerCase();
	return /ssl|tls|certificate|cert[^a-z]|self.signed|unable to verify|untrusted|expired cert|bad cert|DEPTH_ZERO_SELF_SIGNED/i.test(lower);
}

// ---- HTTPS module loading ----

let _requireFn: ((id: string) => unknown) | null | undefined = undefined;
let _httpsModule: unknown = undefined;

function getRequire(): (id: string) => unknown {
	if (_requireFn !== undefined) return _requireFn as (id: string) => unknown;

	// 1. window.require (Obsidian preload)
	const winReq = win().require;
	if (typeof winReq === "function") {
		_requireFn = winReq as (id: string) => unknown;
		return _requireFn;
	}

	// 2. globalThis.require (might differ from window in some contexts)
	const globalReq = glob().require;
	if (typeof globalReq === "function" && globalReq !== winReq) {
		_requireFn = globalReq as (id: string) => unknown;
		return _requireFn;
	}

	// 3. CJS free-variable require via indirect eval
	try {
		// eslint-disable-next-line no-eval
		const cjsReq = (0, eval)("typeof require === 'function' ? require : undefined");
		if (typeof cjsReq === "function") {
			_requireFn = cjsReq as (id: string) => unknown;
			return _requireFn;
		}
	} catch { /* not available */ }

	_requireFn = null;
	throw new Error(
		"Node.js require() is not available. " +
		"SSL skip verification requires the Obsidian desktop app. " +
		"If you are on desktop, ensure the plugin has access to Node.js APIs."
	);
}

function loadHttpsModule(): unknown {
	const process = win().process as AnyObj | undefined;
	const isElectron = !!(process?.versions?.electron);
	if (!isElectron) {
		throw new Error(
			"SSL skip verification is only available in the Obsidian desktop app (Electron). " +
			"Mobile and web versions do not support this feature."
		);
	}

	const requireFn = getRequire();

	try {
		const mod = requireFn("https");
		if (mod && typeof (mod as AnyObj).request === "function") {
			return mod;
		}
		throw new Error("Loaded https module is missing the request() method");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(
			`Failed to load Node.js HTTPS module: ${msg}. ` +
			"The Electron environment may restrict access to native Node.js modules."
		);
	}
}

export function getHttps(): unknown {
	if (_httpsModule !== undefined) return _httpsModule;
	_httpsModule = loadHttpsModule();
	return _httpsModule;
}

// ---- Types ----

export interface HttpsRequestOptions {
	url: string;
	method?: string;
	body?: string;
	headers?: Record<string, string>;
	timeout?: number;
	skipSslVerify?: boolean;
}

export interface HttpsRequestResponse {
	status: number;
	text: string;
}

// ---- Path encoding ----

export function buildFullPath(basePath: string | undefined, filePath: string): string {
	const prefix = (basePath || "").replace(/^\/+/, "").replace(/\/+$/, "");
	if (prefix) {
		return `${prefix}/${filePath}`;
	}
	return filePath;
}

export function encodePathSegments(filePath: string): string {
	return filePath.split("/").map(encodeURIComponent).join("/");
}

// ---- Shared error enrichment ----

export function enrichError(err: unknown, context: string): string {
	const message = err instanceof Error ? err.message : String(err);
	if (message.includes("Skip SSL") || message.includes("SSL skip")) {
		return `${context}: ${message}`;
	}
	return `${context}: ${message}`;
}

// ---- Request adapters ----

async function requestUrlAdapter(options: HttpsRequestOptions): Promise<HttpsRequestResponse> {
	try {
		const resp = await requestUrl({
			url: options.url,
			method: options.method,
			body: options.body || "",
			headers: options.headers,
		});
		return { status: resp.status, text: resp.text };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		if (isSslError(message)) {
			throw new Error(
				`${message}\n\nTip: The server may be using a self-signed or invalid SSL certificate. ` +
				`You can enable "Skip SSL certificate verification" in the plugin settings to bypass this check.`
			);
		}
		throw err;
	}
}

// ---- HTTPS request with redirect support ----

interface HttpsResponse {
	statusCode: number;
	statusMessage?: string;
	headers: Record<string, string | string[] | undefined>;
	on(event: "data", cb: (chunk: string) => void): void;
	on(event: "end", cb: () => void): void;
	resume(): void;
}

interface HttpsRequest {
	on(event: "error", cb: (err: Error) => void): void;
	setTimeout(ms: number, cb: () => void): void;
	write(body: string): void;
	end(): void;
	destroy(): void;
}

interface HttpsModule {
	request(opts: AnyObj, cb: (res: HttpsResponse) => void): HttpsRequest;
}

function getHttpsModule(): HttpsModule {
	return getHttps() as unknown as HttpsModule;
}

const MAX_REDIRECTS = 5;

function makeHttpsRequest(
	url: string,
	options: HttpsRequestOptions,
	redirectCount: number
): Promise<HttpsRequestResponse> {
	if (redirectCount > MAX_REDIRECTS) {
		return Promise.reject(new Error(`Too many redirects (max: ${MAX_REDIRECTS})`));
	}

	if (!url.startsWith("https://")) {
		return Promise.reject(
			new Error(`Redirect target is HTTP; SSL skip only supports HTTPS URLs: ${url}`)
		);
	}

	const https = getHttpsModule();
	const urlObj = new URL(url);
	const method = options.method || "GET";
	const reqHeaders = options.headers || {};

	return new Promise<HttpsRequestResponse>((resolve, reject) => {
		const req = https.request(
			{
				hostname: urlObj.hostname,
				port: urlObj.port || 443,
				path: urlObj.pathname + urlObj.search,
				method,
				rejectUnauthorized: false,
				headers: {
					"User-Agent": "Obsidian-Code-Embed-Plugin",
					...reqHeaders,
				},
			},
			(res: HttpsResponse) => {
				const status = res.statusCode;

				// Handle redirects
				if ([301, 302, 307, 308].includes(status)) {
					const rawLocation = res.headers?.location;
					const location = Array.isArray(rawLocation) ? rawLocation[0] : rawLocation;
					if (!location) {
						reject(new Error(`HTTP ${status}: redirect without Location header`));
						return;
					}

					const redirectUrl = new URL(location, url).href;

					// Drain response body to free socket
					res.resume();

					// 301/302: use GET; 307/308: preserve method & body
					const redirectOptions = { ...options };
					if (status === 301 || status === 302) {
						redirectOptions.method = "GET";
						redirectOptions.body = undefined;
					}

					resolve(makeHttpsRequest(redirectUrl, redirectOptions, redirectCount + 1));
					return;
				}

				// Normal response
				let data = "";
				res.on("data", (chunk: string) => {
					data += chunk;
				});
				res.on("end", () => {
					if (status >= 200 && status < 300) {
						resolve({ status, text: data });
					} else {
						const statusMsg = res.statusMessage || "";
						reject(new Error(`HTTP ${status}: ${statusMsg}`));
					}
				});
			}
		);

		req.on("error", reject);
		req.setTimeout(options.timeout || 30000, () => {
			req.destroy();
			reject(new Error("Request timeout"));
		});

		if (options.body) {
			req.write(options.body);
		}
		req.end();
	});
}

export function httpsRequest(options: HttpsRequestOptions): Promise<HttpsRequestResponse> {
	return makeHttpsRequest(options.url, options, 0);
}

// ---- Main dispatch ----

export async function dispatchHttpRequest(options: HttpsRequestOptions): Promise<HttpsRequestResponse> {
	if (options.skipSslVerify && options.url.startsWith("https://")) {
		try {
			return await httpsRequest(options);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);

			if (
				message.includes("not available") ||
				message.includes("require() is not available") ||
				message.includes("Failed to load Node.js HTTPS") ||
				message.includes("restrict access")
			) {
				console.warn(
					`[Code Embed] SSL skip unavailable, falling back to Obsidian requestUrl. ` +
					`Certificate validation errors may occur: ${message}`
				);
				try {
					return await requestUrlAdapter(options);
				} catch (fallbackErr) {
					const fbMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
					throw new Error(
						`SSL skip verification is enabled but unavailable, ` +
						`and the fallback request also failed: ${fbMsg}`
					);
				}
			}
			throw err;
		}
	}
	return requestUrlAdapter(options);
}
