import { describe, expect, it } from "vitest";
import { getWorkspaceSyncFileName } from "../../src/platform/workspaceSync";
import type { WorkspaceRecord } from "../../src/types";

const workspace: WorkspaceRecord = {
  id: "workspace-1",
  name: "first",
  type: "format",
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
  pinned: false,
  sensitiveMode: false,
  snapshot: { kind: "format", text: "{}", format: "json", sourceName: "demo.json" },
};

describe("workspace local file sync", () => {
  it("uses a stable file name when a workspace is renamed", () => {
    const firstName = getWorkspaceSyncFileName(workspace);
    const renamed = getWorkspaceSyncFileName({ ...workspace, name: "renamed" });

    expect(firstName).toBe("worktools-workspace-workspace-1.apiwork");
    expect(renamed).toBe(firstName);
  });
});
