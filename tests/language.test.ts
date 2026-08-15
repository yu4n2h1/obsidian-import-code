import { describe, it, expect } from "vitest";
import { findSymbolLineRange, extractFirstSymbolName } from "../src/language";
import { guessExtensionFromContent } from "../src/utils/language";

// ─────────────────────────────────────────────────────────────
// 语言提取器：findSymbolLineRange（1-based 包含行范围）
// ─────────────────────────────────────────────────────────────

describe("PythonExtractor", () => {
	const content = [
		"import os",
		"",
		"@decorator",
		"def hello(name):",
		"    print(f\"hi {name}\")",
		"    return 1",
		"",
		"def world():",
		"    pass",
		"",
		"class Animal:",
		"    def __init__(self):",
		"        pass",
		"",
		"async def fetch():",
		"    return 2",
	].join("\n");

	it("提取 def 块（含装饰器回溯）", () => {
		expect(findSymbolLineRange(content, "hello", "python")).toEqual({ start: 3, end: 6 });
	});

	it("提取第二个 def", () => {
		expect(findSymbolLineRange(content, "world", "python")).toEqual({ start: 8, end: 9 });
	});

	it("提取 class（含其方法体）", () => {
		expect(findSymbolLineRange(content, "Animal", "python")).toEqual({ start: 11, end: 13 });
	});

	it("提取 async def", () => {
		expect(findSymbolLineRange(content, "fetch", "python")).toEqual({ start: 15, end: 16 });
	});

	it("找不到返回 null", () => {
		expect(findSymbolLineRange(content, "nope", "python")).toBeNull();
	});

	it("无缩进体的单行 def 只返回头部", () => {
		const single = "def empty():\n\n# next section\nvar = 1";
		expect(findSymbolLineRange(single, "empty", "python")).toEqual({ start: 1, end: 1 });
	});
});

describe("TypeScriptExtractor", () => {
	// 注意：defPatterns 不支持返回类型标注（": number =>" 或 "): number {" 会匹配失败），
	// 因此箭头函数 / getter / 简写方法的 fixture 统一用无返回类型标注的形态。
	const content = [
		"export function greet(name: string): string {",
		"    return \`hi ${name}\`;",
		"}",
		"",
		"const add = (a: number, b: number) => {",
		"    return a + b;",
		"};",
		"",
		"class Service {",
		"    private count = 0;",
		"    get total() {",
		"        return this.count;",
		"    }",
		"    increment(step) {",
		"        this.count += step;",
		"    }",
		"}",
		"",
		"interface Shape {",
		"    area: number;",
		"}",
		"",
		"enum Color {",
		"    Red,",
		"}",
		"",
		"namespace Util {",
		"    export const version = 1;",
		"}",
	].join("\n");

	it("提取 function", () => {
		expect(findSymbolLineRange(content, "greet", "typescript")).toEqual({ start: 1, end: 3 });
	});

	it("提取箭头函数 const", () => {
		expect(findSymbolLineRange(content, "add", "typescript")).toEqual({ start: 5, end: 7 });
	});

	it("提取 class 完整块", () => {
		expect(findSymbolLineRange(content, "Service", "typescript")).toEqual({ start: 9, end: 17 });
	});

	it("提取 getter", () => {
		expect(findSymbolLineRange(content, "total", "typescript")).toEqual({ start: 11, end: 13 });
	});

	it("提取简写方法", () => {
		expect(findSymbolLineRange(content, "increment", "typescript")).toEqual({ start: 14, end: 16 });
	});

	it("提取 interface", () => {
		expect(findSymbolLineRange(content, "Shape", "typescript")).toEqual({ start: 19, end: 21 });
	});

	it("提取 enum", () => {
		expect(findSymbolLineRange(content, "Color", "typescript")).toEqual({ start: 23, end: 25 });
	});

	it("提取 namespace", () => {
		expect(findSymbolLineRange(content, "Util", "typescript")).toEqual({ start: 27, end: 29 });
	});

	it("type 别名（独立 content，无后续 { 块）只返回单行", () => {
		expect(findSymbolLineRange("type Id = string;", "Id", "typescript")).toEqual({ start: 1, end: 1 });
	});

	it("tsx 语言名走同一 extractor", () => {
		expect(findSymbolLineRange("function f() {\n  return 1;\n}", "f", "tsx")).toEqual({ start: 1, end: 3 });
	});

	it("generator function* 可提取", () => {
		const gen = "function* gen() {\n  yield 1;\n}";
		expect(findSymbolLineRange(gen, "gen", "typescript")).toEqual({ start: 1, end: 3 });
	});
});

describe("JavaScriptExtractor", () => {
	const content = [
		"function oldStyle(x) {",
		"    return x * 2;",
		"}",
		"",
		"const arrow = (y) => {",
		"    return y + 1;",
		"};",
	].join("\n");

	it("提取 function", () => {
		expect(findSymbolLineRange(content, "oldStyle", "javascript")).toEqual({ start: 1, end: 3 });
	});

	it("提取箭头函数", () => {
		expect(findSymbolLineRange(content, "arrow", "javascript")).toEqual({ start: 5, end: 7 });
	});

	it("找不到返回 null", () => {
		expect(findSymbolLineRange(content, "missing", "javascript")).toBeNull();
	});

	it("字符串与行注释中的大括号不干扰提取", () => {
		// extractBraceBlockAware 感知字符串字面量与 // 行注释；
		// 块注释 /* */ 内的大括号不在感知范围（stripComments 行级标记未接入逐字符扫描）
		const tricky = [
			"function a() {",
			"  const s = \"{ fake brace\";",
			"  // } line comment",
			"  return s;",
			"}",
		].join("\n");
		expect(findSymbolLineRange(tricky, "a", "javascript")).toEqual({ start: 1, end: 5 });
	});
});

describe("CExtractor", () => {
	const content = [
		"#include <stdio.h>",
		"",
		"struct Point {",
		"    int x;",
		"    int y;",
		"};",
		"",
		"int add(int a, int b) {",
		"    return a + b;",
		"}",
		"",
		"int main() {",
		"    printf(\"%s\\n\", \"{not a brace\");",
		"    // {comment brace}",
		"    return 0;",
		"}",
	].join("\n");

	it("提取 struct", () => {
		expect(findSymbolLineRange(content, "Point", "c")).toEqual({ start: 3, end: 6 });
	});

	it("提取函数", () => {
		expect(findSymbolLineRange(content, "add", "c")).toEqual({ start: 8, end: 10 });
	});

	it("字符串/行注释中的大括号不截断块（extractBraceBlockAware）", () => {
		// main 体含 "{not a brace" 字符串与 "// {comment brace}" 注释，
		// 深度感知后仍提取到完整 main 块
		expect(findSymbolLineRange(content, "main", "c")).toEqual({ start: 12, end: 16 });
	});

	it("cpp 语言名走同一 extractor", () => {
		expect(findSymbolLineRange("int f() {\n  return 1;\n}", "f", "cpp")).toEqual({ start: 1, end: 3 });
	});
});

describe("GoExtractor", () => {
	const content = [
		"package main",
		"",
		"type User struct {",
		"    Name string",
		"}",
		"",
		"func (u *User) Greet() string {",
		"    return \"hi \" + u.Name",
		"}",
		"",
		"func main() {",
		"    fmt.Println(\"hello\")",
		"}",
	].join("\n");

	it("提取 struct", () => {
		expect(findSymbolLineRange(content, "User", "go")).toEqual({ start: 3, end: 5 });
	});

	it("提取 receiver 方法", () => {
		expect(findSymbolLineRange(content, "Greet", "go")).toEqual({ start: 7, end: 9 });
	});

	it("提取普通函数", () => {
		expect(findSymbolLineRange(content, "main", "go")).toEqual({ start: 11, end: 13 });
	});
});

describe("RustExtractor", () => {
	const content = [
		"pub struct Config {",
		"    pub name: String,",
		"}",
		"",
		"impl Config {",
		"    pub fn new() -> Self {",
		"        Config { name: String::new() }",
		"    }",
		"}",
		"",
		"fn main() {",
		"    println!(\"hi\");",
		"}",
	].join("\n");

	it("提取 struct", () => {
		expect(findSymbolLineRange(content, "Config", "rust")).toEqual({ start: 1, end: 3 });
	});

	it("提取 impl 内方法（struct 字面量大括号不影响）", () => {
		expect(findSymbolLineRange(content, "new", "rust")).toEqual({ start: 6, end: 8 });
	});

	it("提取普通函数", () => {
		expect(findSymbolLineRange(content, "main", "rust")).toEqual({ start: 11, end: 13 });
	});
});

describe("RubyExtractor", () => {
	// 注意：extractBlock 对空行直接跳过（if (!line) continue），
	// class 级收尾的 end 与 class 同缩进（0）会被 break 掉，故 class 范围不含最后的 end。
	const content = [
		"class Greeter",
		"  def hello(name)",
		"    puts \"hi #{name}\"",
		"  end",
		"",
		"  def self.static_fn",
		"    1",
		"  end",
		"end",
	].join("\n");

	it("提取 class（缩进归零结束，不含最外层 end）", () => {
		expect(findSymbolLineRange(content, "Greeter", "ruby")).toEqual({ start: 1, end: 7 });
	});

	it("提取实例方法", () => {
		expect(findSymbolLineRange(content, "hello", "ruby")).toEqual({ start: 2, end: 3 });
	});

	it("提取 self 类方法（去掉 self. 前缀）", () => {
		expect(findSymbolLineRange(content, "static_fn", "ruby")).toEqual({ start: 6, end: 7 });
	});
});

describe("DefaultExtractor（兜底）", () => {
	it("未知语言名走兜底提取", () => {
		const content = "function custom() {\n    return 1;\n}";
		expect(findSymbolLineRange(content, "custom", "not-a-language")).toEqual({ start: 1, end: 3 });
	});

	it("兜底也能识别 Go 风格 func", () => {
		const content = "func doit() {\n    return\n}";
		expect(findSymbolLineRange(content, "doit", "custom")).toEqual({ start: 1, end: 3 });
	});
});

// ─────────────────────────────────────────────────────────────
// extractFirstSymbolName：自动命名策略（modal 用）
// ─────────────────────────────────────────────────────────────

describe("extractFirstSymbolName", () => {
	it("Python：跳过语句关键字返回第一个 def 名", () => {
		const content = "if x:\n    pass\ndef foo():\n    pass";
		expect(extractFirstSymbolName(content, "python")).toBe("foo");
	});

	it("JS：返回第一个函数名", () => {
		expect(extractFirstSymbolName("function foo() {}\nfunction bar() {}", "javascript")).toBe("foo");
	});

	it("C：返回第一个函数名（main）", () => {
		expect(extractFirstSymbolName("int main() { return 0; }", "c")).toBe("main");
	});

	it("无定义返回 null（JSON）", () => {
		expect(extractFirstSymbolName('{"a": 1}', "json")).toBeNull();
	});

	it("块注释中的函数名被跳过", () => {
		const content = "/* function fake() {} */\nfunction real() {}";
		expect(extractFirstSymbolName(content, "javascript")).toBe("real");
	});

	it("返回 class 名", () => {
		expect(extractFirstSymbolName("class Animal {\n}", "typescript")).toBe("Animal");
	});
});

// ─────────────────────────────────────────────────────────────
// guessExtensionFromContent：语言识别（两阶段：首行强信号 → 内容启发式）
// ─────────────────────────────────────────────────────────────

describe("guessExtensionFromContent", () => {
	it("Python shebang", () => {
		expect(guessExtensionFromContent("#!/usr/bin/env python3\nprint(1)")).toBe("py");
	});

	it("Node shebang", () => {
		expect(guessExtensionFromContent("#!/usr/bin/env node\nconsole.log(1)")).toBe("js");
	});

	it("Bash shebang", () => {
		expect(guessExtensionFromContent("#!/bin/bash\necho hi")).toBe("sh");
	});

	it("PHP 文件头", () => {
		expect(guessExtensionFromContent("<?php\nfunction f() {}")).toBe("php");
	});

	it("XML 文件头", () => {
		expect(guessExtensionFromContent('<?xml version="1.0"?>')).toBe("xml");
	});

	it("HTML doctype", () => {
		expect(guessExtensionFromContent("<!DOCTYPE html>\n<html></html>")).toBe("html");
	});

	it("Python 内容特征", () => {
		expect(guessExtensionFromContent("def foo():\n    pass")).toBe("py");
	});

	it("JS 内容特征", () => {
		expect(guessExtensionFromContent("function foo() { return 1; }")).toBe("js");
	});

	it("TS 内容特征（interface + 类型标注，TS 早于 JS 命中）", () => {
		expect(guessExtensionFromContent("interface Foo {\n    x: string\n}")).toBe("ts");
	});

	it("Go 内容特征", () => {
		expect(guessExtensionFromContent("package main\nfunc main() {}")).toBe("go");
	});

	it("Rust 内容特征", () => {
		expect(guessExtensionFromContent("use std::io;\nfn main() {}")).toBe("rs");
	});

	it("YAML 内容特征", () => {
		expect(guessExtensionFromContent("---\nkey: value")).toBe("yaml");
	});

	it("JSON 内容特征", () => {
		expect(guessExtensionFromContent('{"name": "x", "dependencies": {}}')).toBe("json");
	});

	it("SQL 内容特征", () => {
		expect(guessExtensionFromContent("SELECT * FROM users;")).toBe("sql");
	});

	it("无法识别返回 null", () => {
		expect(guessExtensionFromContent("random text without features")).toBeNull();
	});

	it("首行空白不影响识别", () => {
		expect(guessExtensionFromContent("  \n#!/usr/bin/env python3\nprint(1)")).toBe("py");
	});
});