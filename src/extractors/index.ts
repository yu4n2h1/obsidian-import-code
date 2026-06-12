import { BaseExtractor } from "./base-extractor";
import { PythonExtractor } from "./python";
import { RubyExtractor } from "./ruby";
import { YamlExtractor } from "./yaml";
import { JavaScriptExtractor } from "./javascript";
import { TypeScriptExtractor } from "./typescript";
import { JavaExtractor } from "./java";
import { CExtractor } from "./c-family";
import { CSharpExtractor } from "./csharp";
import { GoExtractor } from "./go";
import { RustExtractor } from "./rust";
import { KotlinExtractor } from "./kotlin";
import { SwiftExtractor } from "./swift";
import { PhpExtractor } from "./php";
import { ScalaExtractor } from "./scala";
import { LuaExtractor } from "./lua";
import { HtmlExtractor } from "./html";
import { DefaultExtractor } from "./default";
import { EXTENSION_TO_LANGUAGE } from "../utils/constants";

// ---- 注册表 ----

const registry = new Map<string, BaseExtractor>();

function register(extractor: BaseExtractor): void {
	for (const lang of extractor.languages) {
		registry.set(lang, extractor);
	}
}

register(new PythonExtractor());
register(new RubyExtractor());
register(new YamlExtractor());
register(new JavaScriptExtractor());
register(new TypeScriptExtractor());
register(new JavaExtractor());
register(new CExtractor());
register(new CSharpExtractor());
register(new GoExtractor());
register(new RustExtractor());
register(new KotlinExtractor());
register(new SwiftExtractor());
register(new PhpExtractor());
register(new ScalaExtractor());
register(new LuaExtractor());
register(new HtmlExtractor());

const defaultExtractor = new DefaultExtractor();

// ---- 语言名标准化 ----

/**
 * 将原始扩展名（如 "py"）标准化为语言名（如 "python"）。
 * 修复 modal.ts 传入原始扩展名导致 STRATEGY_MAP 查找失败的 bug。
 */
function normalizeLanguage(raw: string): string {
	return EXTENSION_TO_LANGUAGE[raw] ?? raw;
}

function getExtractor(language: string): BaseExtractor {
	return registry.get(normalizeLanguage(language)) ?? defaultExtractor;
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
