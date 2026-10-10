// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorktoolsPackage, exportWorktoolsPackage, importWorktoolsPackage } from "../../src/core/package";
import type { WorkspaceRecord } from "../../src/types";

const { loadLocalWorkspaceSync, markLocalWorkspaceSyncInitialized, isTauriRuntime, readDir, readFile, writeFile, remove } = vi.hoisted(() => ({
  loadLocalWorkspaceSync: vi.fn(),
  markLocalWorkspaceSyncInitialized: vi.fn(async () => undefined),
  isTauriRuntime: vi.fn(() => false),
  readDir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../../src/storage/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/storage/db")>();
  return { ...actual, loadLocalWorkspaceSync, markLocalWorkspaceSyncInitialized };
});
vi.mock("../../src/platform/files", () => ({ isTauriRuntime }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readDir, readFile, writeFile, remove }));

import { loadLocalWorkspaceRecords, syncAllWorkspacesToLocalDirectory, syncWorkspaceToLocalDirectory } from "../../src/platform/workspaceSync";

const workspace: WorkspaceRecord = {
  id: "workspace-1",
  name: "订单工作区",
  type: "format",
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
  pinned: false,
  sensitiveMode: false,
  snapshot: { kind: "format", text: "{\"order\":1}", format: "json" },
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function setBrowserDirectoryPicker() {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window, "showDirectoryPicker", { configurable: true, value: vi.fn() });
}

describe("local workspace files", () => {
  beforeEach(() => {
    setBrowserDirectoryPicker();
    loadLocalWorkspaceSync.mockReset();
    markLocalWorkspaceSyncInitialized.mockReset().mockResolvedValue(undefined);
    isTauriRuntime.mockReset().mockReturnValue(false);
    readDir.mockReset();
    readFile.mockReset();
    writeFile.mockReset();
    remove.mockReset();
  });

  it("loads each valid workspace package from the selected directory", async () => {
    const fileName = "worktools-workspace-workspace-1.apiwork";
    const bytes = exportWorktoolsPackage(createWorktoolsPackage({
      workspaces: [workspace],
      ruleTemplates: [],
      maskTemplates: [],
      baselines: [],
      recentFiles: [],
    }));
    const fileEntry = {
      kind: "file",
      name: fileName,
      getFile: async () => new File([toArrayBuffer(bytes)], fileName),
    } as unknown as FileSystemFileHandle;
    const otherEntry = { kind: "file", name: "notes.txt" } as FileSystemFileHandle;
    const directoryHandle = {
      name: "shared-workspaces",
      queryPermission: vi.fn(async () => "granted" as PermissionState),
      values: async function* () {
        yield fileEntry;
        yield otherEntry;
      },
    } as unknown as FileSystemDirectoryHandle;
    loadLocalWorkspaceSync.mockResolvedValue({
      id: "workspace-directory",
      directoryName: "shared-workspaces",
      directoryHandle,
    });

    await expect(loadLocalWorkspaceRecords()).resolves.toEqual([workspace]);
  });

  it("writes every save as a single-workspace .apiwork package", async () => {
    let savedBytes: Uint8Array | undefined;
    const writable = {
      write: vi.fn(async (value: unknown) => {
        if (value instanceof Uint8Array) savedBytes = new Uint8Array(value);
        else if (value instanceof ArrayBuffer) savedBytes = new Uint8Array(value);
      }),
      close: vi.fn(async () => undefined),
    };
    const fileHandle = { createWritable: vi.fn(async () => writable) } as unknown as FileSystemFileHandle;
    const directoryHandle = {
      name: "shared-workspaces",
      queryPermission: vi.fn(async () => "granted" as PermissionState),
      getFileHandle: vi.fn(async () => fileHandle),
    } as unknown as FileSystemDirectoryHandle;
    loadLocalWorkspaceSync.mockResolvedValue({
      id: "workspace-directory",
      directoryName: "shared-workspaces",
      directoryHandle,
    });

    await expect(syncWorkspaceToLocalDirectory(workspace)).resolves.toEqual({ status: "synced", directoryName: "shared-workspaces" });

    expect(directoryHandle.getFileHandle).toHaveBeenCalledWith("worktools-workspace-workspace-1.apiwork", { create: true });
    expect(writable.close).toHaveBeenCalledOnce();
    expect(savedBytes).toBeDefined();
    expect(importWorktoolsPackage(savedBytes!).workspaces).toEqual([workspace]);
  });

  it("reads and writes workspaces through the Tauri local filesystem", async () => {
    const fileName = "worktools-workspace-workspace-1.apiwork";
    const bytes = exportWorktoolsPackage(createWorktoolsPackage({
      workspaces: [workspace],
      ruleTemplates: [],
      maskTemplates: [],
      baselines: [],
      recentFiles: [],
    }));
    isTauriRuntime.mockReturnValue(true);
    loadLocalWorkspaceSync.mockResolvedValue({
      id: "workspace-directory",
      directoryName: "shared-workspaces",
      directoryPath: "C:\\Workspaces",
    });
    readDir.mockResolvedValue([{ name: fileName, isFile: true, isDirectory: false }]);
    readFile.mockResolvedValue(bytes);

    await expect(loadLocalWorkspaceRecords()).resolves.toEqual([workspace]);
    await expect(syncWorkspaceToLocalDirectory(workspace)).resolves.toEqual({ status: "synced", directoryName: "shared-workspaces" });
    expect(writeFile).toHaveBeenCalledWith(`C:\\Workspaces\\${fileName}`, expect.any(Uint8Array));
  });

  it("keeps existing files when replacement writes fail", async () => {
    isTauriRuntime.mockReturnValue(true);
    loadLocalWorkspaceSync.mockResolvedValue({
      id: "workspace-directory",
      directoryName: "shared-workspaces",
      directoryPath: "C:\\Workspaces",
    });
    writeFile.mockRejectedValue(new Error("disk full"));

    await expect(syncAllWorkspacesToLocalDirectory([workspace], true)).resolves.toMatchObject({ status: "error" });

    expect(remove).not.toHaveBeenCalled();
    expect(markLocalWorkspaceSyncInitialized).toHaveBeenCalledWith(false);
  });
});
