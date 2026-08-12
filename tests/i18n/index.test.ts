import { describe, expect, it } from "vitest";
import { translateForLanguage } from "../../src/i18n";

describe("i18n", () => {
  it("keeps Chinese source text in the Chinese locale", () => {
    expect(translateForLanguage("批量对比", "zh-CN")).toBe("批量对比");
  });

  it("translates exact and interpolated UI text into English", () => {
    expect(translateForLanguage("批量对比", "en-US")).toBe("Batch Compare");
    expect(translateForLanguage("3 处差异", "en-US")).toBe("3 differences");
    expect(translateForLanguage("配置处理", "en-US")).toBe("Configuration Processing");
    expect(translateForLanguage("已替换 5 处符号", "en-US")).toBe("Replaced 5 delimiters");
    expect(translateForLanguage("保存工作区时同步到本地文件", "en-US")).toBe("Sync workspaces to a local file when saving");
    expect(translateForLanguage("双击可新建多个标签", "en-US")).toBe("Double-click for more tabs");
    expect(translateForLanguage("格式有问题 好好检查一下 老表", "en-US")).toBe("The format has issues. Check it carefully, buddy.");
    expect(translateForLanguage("至少一侧 SQL 无法格式化，已退回原文对比", "en-US")).toBe("At least one SQL input could not be formatted; original-text comparison was used");
    expect(translateForLanguage("字符串长度", "en-US")).toBe("String Length");
    expect(translateForLanguage("中文字符", "en-US")).toBe("Chinese Characters");
  });
});
