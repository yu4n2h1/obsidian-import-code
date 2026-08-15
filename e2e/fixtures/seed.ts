/**
 * 幂等 seed：在 example vault 里生成长期固定的测试 fixture。
 * 每个测试场景一个独立笔记（只含一个 embed），让 dev:dom 查询唯一、断言精确。
 * 直接写文件系统（example vault 是本地目录），覆盖写入保证内容确定。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXAMPLE_VAULT, FIXTURE_DIR } from "../harness/paths";

/** sample.py —— 行号对断言至关重要，勿随意增删空行 */
const SAMPLE_PY = `def hello():
    return "hello"

def add(a, b):
    return a + b

class Greeter:
    def greet(self, name):
        return f"Hi {name}"
`;

/** sample.ts —— 用于语言高亮断言（language-typescript） */
const SAMPLE_TS = `function greetTs(name: string): string {
    return \`Hello \${name}\`;
}

export const answer: number = 42;
`;

/** 每个 embed 场景独立笔记；内容即一个 `![[...]]` embed */
const NOTES: Record<string, string> = {
	"embed-full.md": "![[e2e-fixtures/sample.py]]\n",
	"embed-symbol.md": "![[e2e-fixtures/sample.py@hello]]\n",
	"embed-line.md": "![[e2e-fixtures/sample.py@1-3]]\n",
	"embed-highlight.md": "![[e2e-fixtures/sample.py#2-4]]\n",
	"embed-error.md": "![[e2e-fixtures/nope.py]]\n",
	"embed-ts.md": "![[e2e-fixtures/sample.ts]]\n",
};

export function seed(): void {
	const dir = join(EXAMPLE_VAULT, FIXTURE_DIR);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "sample.py"), SAMPLE_PY);
	writeFileSync(join(dir, "sample.ts"), SAMPLE_TS);
	for (const [name, content] of Object.entries(NOTES)) {
		writeFileSync(join(dir, name), content);
	}
}

// 直接执行本文件时运行 seed
if (process.argv[1]?.endsWith("seed.ts")) {
	seed();
	console.log(`[e2e] fixture 已写入 ${EXAMPLE_VAULT}/${FIXTURE_DIR}`);
}
