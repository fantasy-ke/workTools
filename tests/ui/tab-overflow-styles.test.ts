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

describe("task tab overflow styles", () => {
  it("keeps scroll mode on one line and lets wrap mode expand the tab row", () => {
    expect(appCss).toMatch(/\.task-tabs\[data-overflow-mode="scroll"\]\{[^}]*flex-wrap:nowrap[^}]*overflow-x:auto/);
    expect(appCss).toMatch(/\.task-tabs\[data-overflow-mode="wrap"\]\{[^}]*flex-wrap:wrap/);
    expect(appCss).toMatch(/\.app-shell\[data-tab-overflow="wrap"\]\{[^}]*grid-template-rows:44px auto/);
  });
});
