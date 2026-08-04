import { describe, expect, it } from "vitest";
import { compareDocuments, DEFAULT_DIFF_OPTIONS } from "../../src/core/diff";

describe("diff core", () => {
  it("ignores JSON property order in semantic mode", () => {
    const result = compareDocuments('{"a":1,"b":2}', '{"b":2,"a":1}', "json", DEFAULT_DIFF_OPTIONS);
    expect(result.changes).toHaveLength(0);
    expect(result.leftValid && result.rightValid).toBe(true);
  });

  it("finds a changed semantic path", () => {
    const result = compareDocuments('{"user":{"name":"A"}}', '{"user":{"name":"B"}}', "json", DEFAULT_DIFF_OPTIONS);
    expect(result.changes).toEqual(expect.arrayContaining([expect.objectContaining({ path: "$.user.name", kind: "changed" })]));
  });

  it("matches arrays by key independent of sequence", () => {
    const left = '{"items":[{"id":1,"name":"A"},{"id":2,"name":"B"}]}';
    const right = '{"items":[{"id":2,"name":"B"},{"id":1,"name":"A"}]}';
    const result = compareDocuments(left, right, "json", { ...DEFAULT_DIFF_OPTIONS, arrayMode: "match-by-key", arrayKey: "id" });
    expect(result.changes).toHaveLength(0);
  });

  it("falls back to text comparison for duplicate JSON keys", () => {
    const result = compareDocuments('{"id":1,"id":2}', '{"id":2}', "json", DEFAULT_DIFF_OPTIONS);
    expect(result.warnings.join(" ")).toContain("重复 JSON Key");
    expect(result.changes.length).toBeGreaterThan(0);
  });
});
