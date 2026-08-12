import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/storage/db";
import { useAppStore } from "../../src/store/appStore";
import type { WorkspaceRecord } from "../../src/types";

const originalState = useAppStore.getState();
const workspace: WorkspaceRecord = {
  id: "workspace-1",
  name: "旧名称",
  type: "format",
  createdAt: "2026-08-11T08:00:00.000Z",
  updatedAt: "2026-08-11T08:00:00.000Z",
  pinned: false,
  sensitiveMode: false,
  snapshot: { kind: "format", text: "{}", format: "json" },
};

describe("workspace rename", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T08:00:00.000Z"));
    useAppStore.setState({ workspaces: [workspace] });
  });

  afterEach(() => {
    useAppStore.setState(originalState);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("trims and persists the new workspace name", async () => {
    const put = vi.spyOn(db.workspaces, "put").mockResolvedValue("workspace-1");

    const renamed = await useAppStore.getState().renameWorkspace(workspace.id, "  新名称  ");

    expect(renamed).toEqual({
      ...workspace,
      name: "新名称",
      updatedAt: "2026-08-12T08:00:00.000Z",
    });
    expect(put).toHaveBeenCalledWith(renamed);
    expect(useAppStore.getState().workspaces).toEqual([renamed]);
  });

  it("rejects an empty workspace name without writing to storage", async () => {
    const put = vi.spyOn(db.workspaces, "put").mockResolvedValue("workspace-1");

    await expect(useAppStore.getState().renameWorkspace(workspace.id, "   ")).rejects.toThrow("工作区名称不能为空");

    expect(put).not.toHaveBeenCalled();
    expect(useAppStore.getState().workspaces).toEqual([workspace]);
  });
});