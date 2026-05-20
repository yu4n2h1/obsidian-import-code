import { requestUrl } from "obsidian";

/**
 * 获取 Node.js https 模块（用于跳过 SSL 证书验证）。
 * 尝试多种方式以确保在 Obsidian 的不同版本中都能正常工作。
 */
function getHttpsModule(): any {
	try {
		const req = (window as any).require;
		if (typeof req === "function") {
			const mod = req("https");
			if (mod) return mod;
		}
	} catch { /* continue */ }

	try {
		const mod = require("https");
		if (mod) return mod;
	} catch { /* continue */ }

	try {
		const req = (globalThis as any).require;
		if (typeof req === "function") {
			const mod = req("https");
			if (mod) return mod;
		}
	} catch { /* continue */ }

	throw new Error(
		"Node.js HTTPS module not available. SSL skip requires desktop Obsidian."
	);
}

let _httpsModule: any = undefined;

export function getHttps(): any {
	if (_httpsModule !== undefined) return _httpsModule;
	_httpsModule = getHttpsModule();
	return _httpsModule;
}

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

async function requestUrlAdapter(options: HttpsRequestOptions): Promise<HttpsRequestResponse> {
	const resp = await requestUrl({
		url: options.url,
		method: options.method,
		body: options.body || "",
		headers: options.headers,
	});
	return { status: resp.status, text: resp.text };
}

export async function dispatchHttpRequest(options: HttpsRequestOptions): Promise<HttpsRequestResponse> {
	if (options.skipSslVerify && options.url.startsWith("https://")) {
		return httpsRequest(options);
	}
	return requestUrlAdapter(options);
}

export function httpsRequest(options: HttpsRequestOptions): Promise<HttpsRequestResponse> {
	const https = getHttps();
	const urlObj = new URL(options.url);
	const method = options.method || "GET";
	const headers = options.headers || {};

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
					...headers,
				},
			},
			(res: any) => {
				let data = "";
				res.on("data", (chunk: string) => {
					data += chunk;
				});
				res.on("end", () => {
					const status = res.statusCode as number;
					if (status >= 200 && status < 300) {
						resolve({ status, text: data });
					} else {
						reject(
							new Error(
								`HTTP ${status}: ${res.statusMessage || ""}`
							)
						);
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
