import { afterEach, describe, expect, it, vi } from "vitest";
import { applySettingsDefaults, db, loadWorkspaceTabSession, saveWorkspaceTabSession } from "../../src/storage/db";

describe("settings defaults", () => {
  it("enables GPU rendering hints for new and older local settings", () => {
    expect(applySettingsDefaults().gpuAcceleration).toBe(true);
    expect(applySettingsDefaults().language).toBe("zh-CN");
    expect(applySettingsDefaults({ theme: "dark" }).gpuAcceleration).toBe(true);
    expect(applySettingsDefaults({ language: "en-US" }).language).toBe("en-US");
    expect(applySettingsDefaults()).not.toHaveProperty("syncWorkspaceToLocalFile");
    expect(applySettingsDefaults().tabOverflowMode).toBe("scroll");
    expect(applySettingsDefaults({ tabOverflowMode: "wrap" }).tabOverflowMode).toBe("wrap");
  });

  it("preserves an explicit disabled preference", () => {
    expect(applySettingsDefaults({ gpuAcceleration: false }).gpuAcceleration).toBe(false);
  });
});

describe("workspace tab session", () => {
  afterEach(() => vi.restoreAllMocks());

  it("loads the saved workspace tab session from IndexedDB", async () => {
    const row = { id: "open-workspaces" as const, workspaceIds: ["workspace-1"], activeWorkspaceId: "workspace-1" };
    const get = vi.spyOn(db.workspaceTabSessions, "get").mockResolvedValue(row);

    await expect(loadWorkspaceTabSession()).resolves.toEqual(row);
    expect(get).toHaveBeenCalledWith("open-workspaces");
  });

  it("persists workspace IDs and the active saved workspace", async () => {
    const put = vi.spyOn(db.workspaceTabSessions, "put").mockResolvedValue("open-workspaces");

    await saveWorkspaceTabSession({ workspaceIds: ["workspace-1"], activeWorkspaceId: "workspace-1" });

    expect(put).toHaveBeenCalledWith({
      id: "open-workspaces",
      workspaceIds: ["workspace-1"],
      activeWorkspaceId: "workspace-1",
    });
  });
});
