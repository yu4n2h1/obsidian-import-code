import { BaseExtractor } from "./base-extractor";
import { PythonExtractor } from "./python";
import { RubyExtractor } from "./ruby";
import { YamlExtractor } from "./yaml";
import { TypeScriptExtractor } from "./typescript";
import { JavaScriptExtractor } from "./javascript";
import { JavaExtractor } from "./java";
import { CExtractor } from "./c-family";
import { GoExtractor } from "./go";
import { RustExtractor } from "./rust";
import { PhpExtractor } from "./php";
import { LuaExtractor } from "./lua";
import { HtmlExtractor } from "./html";
import { BashExtractor } from "./bash";
import { PerlExtractor } from "./perl";
import { XmlExtractor } from "./xml";
import { SqlExtractor } from "./sql";
import { JsonExtractor } from "./json";
import { KotlinExtractor } from "./kotlin";
import { SwiftExtractor } from "./swift";
import { CSharpExtractor } from "./csharp";
import { ScalaExtractor } from "./scala";
import { DefaultExtractor } from "./default";


// ---- extractor 实例（顺序即语言识别的遍历顺序；TypeScript 必须先于 JavaScript） ----

const allExtractors: BaseExtractor[] = [
	new PythonExtractor(),
	new RubyExtractor(),
	new YamlExtractor(),
	new TypeScriptExtractor(),
	new JavaScriptExtractor(),
	new JavaExtractor(),
	new CExtractor(),
	new GoExtractor(),
	new RustExtractor(),
	new PhpExtractor(),
	new LuaExtractor(),
	new HtmlExtractor(),
	new BashExtractor(),
	new PerlExtractor(),
	new XmlExtractor(),
	new SqlExtractor(),
	new JsonExtractor(),
	new KotlinExtractor(),
	new SwiftExtractor(),
	new CSharpExtractor(),
	new ScalaExtractor(),
];

const defaultExtractor = new DefaultExtractor();

// ---- 注册表 ----

const registry = new Map<string, BaseExtractor>();
for (const extractor of allExtractors) {
	for (const lang of extractor.languages) {
		registry.set(lang, extractor);
	}
}

/** 返回所有已注册 extractor（按语言识别遍历顺序），供 language.ts 检测使用。 */
export function getAllExtractors(): readonly BaseExtractor[] {
	return allExtractors;
}

// ---- 语言名标准化 ----

function getExtractor(language: string): BaseExtractor {
	return registry.get(language) ?? defaultExtractor;
}

// ---- 公共 API（签名与旧 code-extractor.ts 完全兼容） ----

/**
 * 查找命名符号的 1-based 行范围（start, end 均为包含）。
 * 未找到时返回 null。
 */
export function findSymbolLineRange(
	content: string,
	symbolName: string,
	language: string
): { start: number; end: number } | null {
	return getExtractor(language).findSymbolLineRange(content, symbolName);
}

/**
 * 返回代码内容中第一个函数/类/方法的名称。
 * 用于自动生成文件名（auto 策略）。未找到时返回 null。
 */
export function extractFirstSymbolName(
	content: string,
	language: string
): string | null {
	return getExtractor(language).extractFirstSymbolName(content);
}
