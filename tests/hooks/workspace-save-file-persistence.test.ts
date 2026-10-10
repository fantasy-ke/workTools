import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceRecord, WorkspaceSnapshot } from "../../src/types";

const { syncWorkspaceToLocalDirectory } = vi.hoisted(() => ({
  syncWorkspaceToLocalDirectory: vi.fn(async () => ({ status: "synced" as const, directoryName: "shared-workspaces" })),
}));

vi.mock("../../src/platform/workspaceSync", () => ({ syncWorkspaceToLocalDirectory }));

import { saveWorkspaceTarget } from "../../src/hooks/useWorkspaceSaveShortcut";

afterEach(() => vi.restoreAllMocks());

describe("workspace file save", () => {
  it("writes both newly created and updated workspaces to their local files", async () => {
    const snapshot: WorkspaceSnapshot = { kind: "format", text: "{}", format: "json" };
    const workspace: WorkspaceRecord = {
      id: "workspace-1",
      name: "orders",
      type: "format",
      createdAt: "2026-08-11T08:00:00.000Z",
      updatedAt: "2026-08-11T08:00:00.000Z",
      pinned: false,
      sensitiveMode: false,
      snapshot,
    };
    const updatedWorkspace = { ...workspace, updatedAt: "2026-08-12T08:00:00.000Z" };
    const createWorkspace = vi.fn(async () => workspace);
    const updateWorkspace = vi.fn(async () => updatedWorkspace);

    const created = await saveWorkspaceTarget({
      requestName: () => workspace.name,
      snapshot,
      createWorkspace,
      updateWorkspace,
    });
    const updated = await saveWorkspaceTarget({
      workspaceId: workspace.id,
      requestName: () => null,
      snapshot,
      createWorkspace,
      updateWorkspace,
    });

    expect(syncWorkspaceToLocalDirectory).toHaveBeenNthCalledWith(1, workspace);
    expect(syncWorkspaceToLocalDirectory).toHaveBeenNthCalledWith(2, updatedWorkspace);
    expect(created?.sync?.status).toBe("synced");
    expect(updated?.sync?.status).toBe("synced");
  });
});
