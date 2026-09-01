import { describe, it, expect } from "vitest";
import { guessExtensionFromContent, getLanguageFromPath } from "../src/utils/language";
import { DEFAULT_SETTINGS } from "../src/types";

/**
 * 语言识别检测测试。
 * 覆盖 guessExtensionFromContent 的两阶段检测（首行强信号 + 内容启发式）
 * 与 getLanguageFromPath 的路径扩展名识别。
 * 已发现的检测缺陷单独归入「已知检测缺陷」describe，便于修复后更新断言。
 */

describe("guessExtensionFromContent：首行强信号（shebang / 文件头）", () => {
	const cases: Array<{ name: string; content: string; expected: string }> = [
		{ name: "python3 shebang", content: "#!/usr/bin/env python3", expected: "py" },
		{ name: "python shebang", content: "#!/usr/bin/python", expected: "py" },
		{ name: "bash shebang", content: "#!/bin/bash", expected: "sh" },
		{ name: "sh shebang", content: "#!/bin/sh", expected: "sh" },
		{ name: "zsh shebang", content: "#!/bin/zsh", expected: "sh" },
		{ name: "ruby shebang", content: "#!/usr/bin/ruby", expected: "rb" },
		{ name: "perl shebang", content: "#!/usr/bin/perl", expected: "pl" },
		{ name: "lua shebang", content: "#!/usr/bin/lua", expected: "lua" },
		{ name: "node shebang", content: "#!/usr/bin/env node", expected: "js" },
		{ name: "php shebang", content: "#!/usr/bin/php", expected: "php" },
		{ name: "php 文件头", content: "<?php echo 1;", expected: "php" },
		{ name: "xml 文件头", content: '<?xml version="1.0"?>', expected: "xml" },
		{ name: "html doctype", content: "<!DOCTYPE html>", expected: "html" },
		{ name: "html 标签", content: '<html lang="en">', expected: "html" },
	];

	it.each(cases)("$name → $expected", ({ content, expected }) => {
		expect(guessExtensionFromContent(content)).toBe(expected);
	});
});

describe("guessExtensionFromContent：内容启发式", () => {
	const cases: Array<{ name: string; content: string; expected: string }> = [
		{ name: "Python def", content: "def foo():\n    pass", expected: "py" },
		{ name: "JavaScript function", content: "function foo() {}", expected: "js" },
		{ name: "JavaScript const", content: "const x = 1;", expected: "js" },
		{ name: "JavaScript let", content: "let y = 2;", expected: "js" },
		{ name: "JavaScript var", content: "var z = 3;", expected: "js" },
		{ name: "TSX import React", content: 'import React from "react";', expected: "tsx" },
		{ name: "TypeScript interface", content: "interface User { name: string }", expected: "ts" },
		{ name: "C include", content: "#include <stdio.h>", expected: "c" },
		{ name: "C++ include", content: "#include <iostream>", expected: "cpp" },
		{ name: "Go package+main", content: "package main\n\nfunc main() {}", expected: "go" },
		{ name: "JSON dependencies", content: '{\n  "dependencies": {}', expected: "json" },
		{ name: "YAML frontmatter", content: "---\nkey: value", expected: "yaml" },
		{ name: "Rust use+main", content: "use std::io;\n\nfn main() {}", expected: "rs" },
		{ name: "SQL SELECT", content: "SELECT * FROM users;", expected: "sql" },
		{ name: "SQL CREATE TABLE", content: "CREATE TABLE users (id INT);", expected: "sql" },
		{ name: "SQL INSERT", content: "INSERT INTO users VALUES (1);", expected: "sql" },
		{ name: "SQL UPDATE", content: "UPDATE users SET name='x';", expected: "sql" },
	];

	it.each(cases)("$name → $expected", ({ content, expected }) => {
		expect(guessExtensionFromContent(content)).toBe(expected);
	});
});

describe("guessExtensionFromContent：优先级与边界", () => {
	it("首行 shebang 命中时不再走内容启发式", () => {
		expect(guessExtensionFromContent("#!/usr/bin/env python3\ndef foo(){}")).toBe("py");
	});

	it("无法识别的内容返回 null", () => {
		expect(guessExtensionFromContent("hello world")).toBeNull();
	});

	it("shebang 解释器名大小写不敏感", () => {
		expect(guessExtensionFromContent("#!/usr/bin/env PYTHON3")).toBe("py");
		expect(guessExtensionFromContent("#!/bin/BASH")).toBe("sh");
	});

	it("解释器路径带版本号仍命中", () => {
		expect(guessExtensionFromContent("#!/usr/bin/env python3.11")).toBe("py");
	});

	it("TypeScript 特性优先于 JavaScript（import React → tsx）", () => {
		expect(guessExtensionFromContent('import React from "react";\nfunction App() {}')).toBe("tsx");
	});
});

describe("已知检测缺陷（待修复，修复后请更新断言）", () => {
	it("Python class + 缩进 def 未识别", () => {
		// python.ts detectByContent 第二个正则 /^\s+def\s+/ 缺 /m，且 head 已 trimStart，
		// 导致第二行的缩进 def 永远匹配不到。理想应返回 "py"。
		expect(guessExtensionFromContent("class Foo:\n    def bar(self):\n        pass")).toBeNull();
	});

	it("TypeScript type 别名（type X = {...}）未识别", () => {
		// typescript.ts 正则 [<{] 不匹配 `type X = {` 里的 `=`，只覆盖 `type X {`。
		// 理想应返回 "ts"。
		expect(guessExtensionFromContent("type User = { name: string };")).toBeNull();
	});

	it("Java 带点包名（package com.example）未识别", () => {
		// java.ts 正则 \w+ 不匹配点号，只覆盖单词包名。理想应返回 "java"。
		expect(guessExtensionFromContent("package com.example;")).toBeNull();
	});
});

describe("getLanguageFromPath：路径扩展名识别", () => {
	it.each([
		{ path: "file.py", expected: ["py", "python"] },
		{ path: "file.ts", expected: ["ts", "typescript"] },
		{ path: "file.js", expected: ["js", "javascript"] },
		{ path: "file.sh", expected: ["sh", "bash"] },
		{ path: "file.yml", expected: ["yml", "yaml"] },
		{ path: "file.cpp", expected: ["cpp", "cpp"] },
	])("$path → $expected", ({ path, expected }) => {
		expect(getLanguageFromPath(path, DEFAULT_SETTINGS)).toEqual(expected);
	});

	it("未知扩展名回退为扩展名本身", () => {
		expect(getLanguageFromPath("file.unknown", DEFAULT_SETTINGS)).toEqual(["unknown", "unknown"]);
	});

	it("剥离 query 与锚点后再取扩展名", () => {
		expect(getLanguageFromPath("file.py?x=1", DEFAULT_SETTINGS)).toEqual(["py", "python"]);
		expect(getLanguageFromPath("file.py#L1", DEFAULT_SETTINGS)).toEqual(["py", "python"]);
	});

	it("扩展名大小写不敏感", () => {
		expect(getLanguageFromPath("file.PY", DEFAULT_SETTINGS)).toEqual(["py", "python"]);
	});
});
