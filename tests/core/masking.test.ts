import { describe, expect, it } from "vitest";
import type { MaskRule } from "../../src/types";
import { applyMaskRules, maskDocumentText } from "../../src/core/masking";

const rules: MaskRule[] = [
  { id: "token", path: "$.users[*].token", strategy: "keep-edges", replacement: "***", keepStart: 2, keepEnd: 2, enabled: true },
  { id: "password", path: "$.password", strategy: "remove", replacement: "***", enabled: true },
];

describe("masking core", () => {
  it("applies wildcard array rules and removes fields", () => {
    const masked = applyMaskRules({ users: [{ token: "abcdefgh" }, { token: "12345678" }], password: "secret" }, rules);
    expect(masked).toEqual({ users: [{ token: "ab***gh" }, { token: "12***78" }] });
  });

  it("exports masked JSON without mutating the source text", () => {
    const source = '{"users":[{"token":"abcdefgh"}],"password":"secret"}';
    const output = maskDocumentText(source, "json", rules);
    expect(JSON.parse(output)).toEqual({ users: [{ token: "ab***gh" }] });
    expect(source).toContain("secret");
  });
});
