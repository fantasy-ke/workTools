import { describe, expect, it } from "vitest";

type NodeFileSystem = {
  readFileSync(path: URL, encoding: "utf8"): string;
};

// 测试通过 Node 内置模块读取原始样式，不为生产代码引入 Node 类型。
const nodeProcess = (globalThis as typeof globalThis & {
  process: { getBuiltinModule(name: "fs"): NodeFileSystem };
}).process;
const appCss = nodeProcess.getBuiltinModule("fs").readFileSync(
  new URL("../../src/App.css", import.meta.url),
  "utf8",
);

describe("Monaco 查找按钮提示布局", () => {
  it("提示越过编辑器头部时保持可见且不覆盖关闭按钮", () => {
    expect(appCss).toContain(".code-editor:has(.context-view.monaco-component){overflow:visible}");
    expect(appCss).toContain(".monaco-hover.workbench-hover.compact .hover-contents{white-space:nowrap!important}");
  });
});
