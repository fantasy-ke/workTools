import { describe, expect, it } from "vitest";
import type { LocalTextFile } from "../../src/types";
import { normalizeDirectoryRelativePath, pairDirectoryFiles } from "../../src/core/batch";

const file = (relativePath: string, content = "{}"): LocalTextFile => ({ name: relativePath.split("/").at(-1) || relativePath, relativePath, content, size: content.length });

describe("batch directory pairing", () => {
  it("removes only the browser-selected root directory", () => {
    expect(normalizeDirectoryRelativePath("left-root\\orders\\a.json", true)).toBe("orders/a.json");
    expect(normalizeDirectoryRelativePath("orders/a.json", false)).toBe("orders/a.json");
  });

  it("preserves nested folders when pairing desktop paths", () => {
    const pairs = pairDirectoryFiles([file("orders/a.json"), file("refunds/a.json")], [file("orders/a.json"), file("refunds/a.json")]);
    expect(pairs.map((item) => item.name)).toEqual(["orders/a.json", "refunds/a.json"]);
    expect(pairs.every((item) => item.left && item.right)).toBe(true);
  });

  it("keeps unmatched files visible", () => {
    const pairs = pairDirectoryFiles([file("only-left.json")], [file("only-right.json")]);
    expect(pairs).toHaveLength(2);
    expect(pairs.filter((item) => !item.left || !item.right)).toHaveLength(2);
  });
});
