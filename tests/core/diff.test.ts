import { describe, expect, it } from "vitest";
import { compareDocuments, DEFAULT_DIFF_OPTIONS, detectDiffFormat } from "../../src/core/diff";

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

  it("detects common SQL statements for comparison", () => {
    expect(detectDiffFormat("-- load active users\nSELECT id, name FROM users WHERE active = 1;")).toBe("sql");
    expect(detectDiffFormat("WITH recent AS (SELECT id FROM audit_log) SELECT * FROM recent;")).toBe("sql");
  });

  it("normalizes SQL layout before semantic comparison", () => {
    const left = "select id, name from users where active=1;";
    const right = "SELECT id, name\nFROM users\nWHERE active = 1;";
    const result = compareDocuments(left, right, "sql", DEFAULT_DIFF_OPTIONS);

    expect(result.format).toBe("sql");
    expect(result.leftValid && result.rightValid).toBe(true);
    expect(result.changes).toHaveLength(0);
    expect(result.normalizedLeft).toContain("SELECT");
  });

  it("formats SQL Server stored procedures before comparison", () => {
    const left = `ALTER PROCEDURE [dbo].[sync_order]
  @status INT
AS
BEGIN
  SELECT id FROM orders WHERE status = @status;
END;`;
    const right = left.replace("SELECT id", "SELECT id, name");

    const result = compareDocuments(left, right, "sql", DEFAULT_DIFF_OPTIONS);

    expect(result.leftValid && result.rightValid).toBe(true);
    expect(result.normalizedLeft).toContain("ALTER PROCEDURE [dbo].[sync_order]");
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("finds changed SQL values after normalization", () => {
    const result = compareDocuments(
      "SELECT id FROM users WHERE id = 1;",
      "SELECT id FROM users WHERE id = 2;",
      "sql",
      DEFAULT_DIFF_OPTIONS,
    );

    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.changes.some((change) => String(change.leftValue).includes("1"))).toBe(true);
    expect(result.changes.some((change) => String(change.rightValue).includes("2"))).toBe(true);
  });

  it("falls back to original text when SQL formatting fails", () => {
    const result = compareDocuments("SELECT 'unterminated", "SELECT 'closed';", "sql", DEFAULT_DIFF_OPTIONS);

    expect(result.leftValid).toBe(false);
    expect(result.rightValid).toBe(true);
    expect(result.warnings.join(" ")).toContain("SQL");
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("falls back to text comparison for duplicate JSON keys", () => {
    const result = compareDocuments('{"id":1,"id":2}', '{"id":2}', "json", DEFAULT_DIFF_OPTIONS);
    expect(result.warnings.join(" ")).toContain("重复 JSON Key");
    expect(result.changes.length).toBeGreaterThan(0);
  });
});
