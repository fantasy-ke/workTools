import { describe, expect, it } from "vitest";
import type { AppPersistedData, WorktoolsSettings } from "../../src/types";
import { createWorktoolsPackage, exportWorktoolsPackage, importWorktoolsPackage } from "../../src/core/package";

const emptyData: AppPersistedData = {
  workspaces: [], ruleTemplates: [], maskTemplates: [], baselines: [], recentFiles: [], settings: {} as WorktoolsSettings,
};

describe("apiwork package", () => {
  it("round-trips a zipped worktools package", () => {
    const pkg = createWorktoolsPackage(emptyData);
    const restored = importWorktoolsPackage(exportWorktoolsPackage(pkg));
    expect(restored.format).toBe("worktools-apiwork-v1");
    expect(restored.workspaces).toEqual([]);
  });

  it("rejects unsupported package versions", () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ format: "unknown", workspaces: [], ruleTemplates: [], maskTemplates: [], baselines: [], recentFiles: [] }));
    expect(() => importWorktoolsPackage(bytes)).toThrow();
  });
});
