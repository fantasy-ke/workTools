import { describe, expect, it } from "vitest";
import { translateForLanguage } from "../../src/i18n";

describe("workspace rename translations", () => {
  it("translates rename actions and validation into English", () => {
    expect(translateForLanguage("重命名工作区", "en-US")).toBe("Rename workspace");
    expect(translateForLanguage("工作区名称不能为空", "en-US")).toBe("Workspace name cannot be empty");
    expect(translateForLanguage("工作区已重命名", "en-US")).toBe("Workspace renamed");
    expect(translateForLanguage("工作区名称", "en-US")).toBe("Workspace name");
    expect(translateForLanguage("保存", "en-US")).toBe("Save");
    expect(translateForLanguage("取消", "en-US")).toBe("Cancel");
  });
});