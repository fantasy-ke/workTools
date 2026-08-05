import { describe, expect, it } from "vitest";

type NodeFileSystem = {
  readFileSync(path: URL, encoding: "utf8"): string;
};

const nodeProcess = (globalThis as typeof globalThis & {
  process: { getBuiltinModule(name: "fs"): NodeFileSystem };
}).process;
const appCss = nodeProcess.getBuiltinModule("fs").readFileSync(
  new URL("../../src/App.css", import.meta.url),
  "utf8",
);

describe("Monaco 行号布局", () => {
  it("旧版行号样式只作用于旧编辑器容器", () => {
    expect(appCss).toContain(".editor-row-wrap > .line-numbers {");
    expect(appCss).not.toMatch(/(?:^|\n)\.line-numbers\s*\{/);
  });
});
