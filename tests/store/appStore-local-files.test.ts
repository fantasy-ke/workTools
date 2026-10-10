import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppPersistedData, WorkspaceRecord } from "../../src/types";

const { loadPersistedData, loadLocalWorkspaceSync, loadLocalWorkspaceRecords, syncAllWorkspacesToLocalDirectory } = vi.hoisted(() => ({
  loadPersistedData: vi.fn(),
  loadLocalWorkspaceSync: vi.fn(),
  loadLocalWorkspaceRecords: vi.fn(),
  syncAllWorkspacesToLocalDirectory: vi.fn(async () => ({ status: "synced" as const, directoryName: "shared-workspaces" })),
}));

vi.mock("../../src/storage/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/storage/db")>();
  return { ...actual, loadPersistedData, loadLocalWorkspaceSync };
});

vi.mock("../../src/platform/workspaceSync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/platform/workspaceSync")>();
  return { ...actual, loadLocalWorkspaceRecords, syncAllWorkspacesToLocalDirectory };
});

import { db, DEFAULT_SETTINGS } from "../../src/storage/db";
import { useAppStore } from "../../src/store/appStore";

const databaseWorkspace: WorkspaceRecord = {
  id: "workspace-1",
  name: "数据库工作区",
  type: "format",
  createdAt: "2026-08-11T08:00:00.000Z",
  updatedAt: "2026-08-11T08:00:00.000Z",
  pinned: false,
  sensitiveMode: false,
  snapshot: { kind: "format", text: "database", format: "json" },
};
const fileWorkspace: WorkspaceRecord = {
  ...databaseWorkspace,
  name: "文件工作区",
  updatedAt: "2026-08-12T08:00:00.000Z",
  snapshot: { kind: "format", text: "local-file", format: "json" },
};
const fileOnlyWorkspace: WorkspaceRecord = {
  ...databaseWorkspace,
  id: "workspace-2",
  name: "只存在于文件的工作区",
  updatedAt: "2026-08-10T08:00:00.000Z",
};
const recycledFileWorkspace: WorkspaceRecord = {
  ...databaseWorkspace,
  id: "workspace-3",
  name: "文件回收站工作区",
  updatedAt: "2026-08-13T08:00:00.000Z",
  deletedAt: "2026-08-13T08:00:00.000Z",
};
const originalState = useAppStore.getState();
const persistedData: AppPersistedData & { recycledWorkspaces: WorkspaceRecord[] } = {
  workspaces: [databaseWorkspace],
  recycledWorkspaces: [],
  ruleTemplates: [],
  maskTemplates: [],
  baselines: [],
  recentFiles: [],
  settings: DEFAULT_SETTINGS,
};

describe("workspace file hydration", () => {
  beforeEach(() => {
    loadPersistedData.mockReset().mockResolvedValue(persistedData);
    loadLocalWorkspaceSync.mockReset().mockResolvedValue({
      id: "workspace-directory",
      directoryName: "shared-workspaces",
      initialized: false,
    });
    loadLocalWorkspaceRecords.mockReset().mockResolvedValue([fileWorkspace, fileOnlyWorkspace, recycledFileWorkspace]);
    syncAllWorkspacesToLocalDirectory.mockReset().mockResolvedValue({ status: "synced", directoryName: "shared-workspaces" });
    useAppStore.setState(originalState);
  });

  afterEach(() => {
    useAppStore.setState(originalState);
    vi.restoreAllMocks();
  });

  it("loads file-only workspaces and prefers the newest workspace version", async () => {
    vi.spyOn(db, "transaction").mockImplementation((async (...args: unknown[]) => {
      const callback = args.at(-1) as () => Promise<void>;
      await callback();
    }) as typeof db.transaction);
    const clear = vi.spyOn(db.workspaces, "clear").mockResolvedValue(undefined);
    const bulkPut = vi.spyOn(db.workspaces, "bulkPut").mockResolvedValue("workspace-3");

    await useAppStore.getState().initialize();

    expect(useAppStore.getState().workspaceFileError).toBeUndefined();
    expect(useAppStore.getState().workspaces).toEqual([fileWorkspace, fileOnlyWorkspace]);
    expect(useAppStore.getState().recycledWorkspaces).toEqual([recycledFileWorkspace]);
    expect(clear).toHaveBeenCalledOnce();
    expect(bulkPut).toHaveBeenCalledWith([fileWorkspace, fileOnlyWorkspace, recycledFileWorkspace]);
    expect(syncAllWorkspacesToLocalDirectory).toHaveBeenCalledWith([fileWorkspace, fileOnlyWorkspace, recycledFileWorkspace]);
    expect(useAppStore.getState().hydrated).toBe(true);
  });

  it("uses the initialized local folder as the source of truth on later startup", async () => {
    loadLocalWorkspaceSync.mockResolvedValue({
      id: "workspace-directory",
      directoryName: "shared-workspaces",
      initialized: true,
    });
    loadLocalWorkspaceRecords.mockResolvedValue([fileWorkspace, recycledFileWorkspace]);
    vi.spyOn(db, "transaction").mockImplementation((async (...args: unknown[]) => {
      const callback = args.at(-1) as () => Promise<void>;
      await callback();
    }) as typeof db.transaction);
    const clear = vi.spyOn(db.workspaces, "clear").mockResolvedValue(undefined);
    const bulkPut = vi.spyOn(db.workspaces, "bulkPut").mockResolvedValue("workspace-3");

    await useAppStore.getState().initialize();

    expect(useAppStore.getState().workspaces).toEqual([fileWorkspace]);
    expect(useAppStore.getState().recycledWorkspaces).toEqual([recycledFileWorkspace]);
    expect(clear).toHaveBeenCalledOnce();
    expect(bulkPut).toHaveBeenCalledWith([fileWorkspace, recycledFileWorkspace]);
    expect(syncAllWorkspacesToLocalDirectory).not.toHaveBeenCalled();
  });
});
