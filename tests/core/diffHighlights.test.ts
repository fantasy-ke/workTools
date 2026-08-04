import { describe, expect, it } from "vitest";
import { compareDocuments, DEFAULT_DIFF_OPTIONS } from "../../src/core/diff";
import { buildDiffHighlights } from "../../src/core/diffHighlights";

describe("diff highlights", () => {
  it("locates changed and added JSON fields in each editor", () => {
    const left = `{
  "status": "pending",
  "guest": { "name": "A" }
}`;
    const right = `{
  "status": "confirmed",
  "guest": { "name": "A", "email": "a@example.com" }
}`;
    const result = compareDocuments(left, right, "json", DEFAULT_DIFF_OPTIONS);
    const highlights = buildDiffHighlights(left, right, "json", result.changes);

    expect(highlights.left).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "changed", startLineNumber: 2 }),
    ]));
    expect(highlights.left.some((item) => item.kind === "added")).toBe(false);
    expect(highlights.right).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "changed", startLineNumber: 2 }),
      expect.objectContaining({ kind: "added", startLineNumber: 3 }),
    ]));
  });

  it("locates match-by-key array paths", () => {
    const left = '{"items":[{"id":"A","count":1}]}';
    const right = '{"items":[{"id":"A","count":2}]}';
    const options = { ...DEFAULT_DIFF_OPTIONS, arrayMode: "match-by-key" as const, arrayKey: "id" };
    const result = compareDocuments(left, right, "json", options);
    const highlights = buildDiffHighlights(left, right, "json", result.changes);

    expect(highlights.left).toHaveLength(1);
    expect(highlights.right).toHaveLength(1);
    expect(highlights.left[0].startColumn).toBeGreaterThan(1);
  });

  it("highlights text changes as whole lines", () => {
    const left = "same\nold";
    const right = "same\nnew";
    const result = compareDocuments(left, right, "text", { ...DEFAULT_DIFF_OPTIONS, mode: "text" });
    const highlights = buildDiffHighlights(left, right, "text", result.changes);

    expect(highlights.left[0]).toMatchObject({ startLineNumber: 2, wholeLine: true });
    expect(highlights.right[0]).toMatchObject({ startLineNumber: 2, wholeLine: true });
  });

  it("locates changed XML text", () => {
    const left = "<root>\n  <status>pending</status>\n</root>";
    const right = "<root>\n  <status>confirmed</status>\n</root>";
    const result = compareDocuments(left, right, "xml", DEFAULT_DIFF_OPTIONS);
    const highlights = buildDiffHighlights(left, right, "xml", result.changes);

    expect(highlights.left[0]).toMatchObject({ startLineNumber: 2, kind: "changed" });
    expect(highlights.right[0]).toMatchObject({ startLineNumber: 2, kind: "changed" });
  });
});