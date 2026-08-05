import type { WorkspaceRecord } from "../types";
import { createWorktoolsPackage, exportWorktoolsPackage } from "../core/package";
import { clearLocalWorkspaceSync, loadLocalWorkspaceSync, saveLocalWorkspaceSync } from "../storage/db";
import { isTauriRuntime } from "./files";
import { safeFileName } from "../utils";

interface FileSystemAccessWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
}

type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

export type WorkspaceSyncStatus = "synced" | "not-configured" | "unsupported" | "permission-denied" | "error";

export interface WorkspaceSyncResult {
  status: WorkspaceSyncStatus;
  directoryName?: string;
}

export interface LocalWorkspaceSyncDirectory {
  directoryName: string;
}

function getFileSystemAccessWindow(): FileSystemAccessWindow | undefined {
  if (typeof window === "undefined") return undefined;
  return window as FileSystemAccessWindow;
}

export function isLocalWorkspaceSyncSupported(): boolean {
  const target = getFileSystemAccessWindow();
  return Boolean(target?.isSecureContext && target.showDirectoryPicker && !isTauriRuntime());
}

export function getWorkspaceSyncFileName(workspace: WorkspaceRecord): string {
  return safeFileName(`worktools-workspace-${workspace.id}.apiwork`);
}

async function hasWritePermission(handle: PermissionedDirectoryHandle): Promise<boolean> {
  const descriptor = { mode: "readwrite" } as const;
  if (typeof handle.queryPermission !== "function") return true;
  if (await handle.queryPermission(descriptor) === "granted") return true;
  return typeof handle.requestPermission === "function" && await handle.requestPermission(descriptor) === "granted";
}

export async function getLocalWorkspaceSyncDirectory(): Promise<LocalWorkspaceSyncDirectory | undefined> {
  const row = await loadLocalWorkspaceSync();
  return row ? { directoryName: row.directoryName } : undefined;
}

export async function chooseLocalWorkspaceSyncDirectory(): Promise<LocalWorkspaceSyncDirectory | undefined> {
  const target = getFileSystemAccessWindow();
  if (!isLocalWorkspaceSyncSupported() || !target?.showDirectoryPicker) return undefined;
  const handle = await target.showDirectoryPicker({ mode: "readwrite" });
  if (!await hasWritePermission(handle)) return undefined;
  await saveLocalWorkspaceSync(handle);
  return { directoryName: handle.name };
}

export async function clearLocalWorkspaceSyncDirectory(): Promise<void> {
  await clearLocalWorkspaceSync();
}

export async function syncWorkspaceToLocalDirectory(workspace: WorkspaceRecord): Promise<WorkspaceSyncResult> {
  if (!isLocalWorkspaceSyncSupported()) return { status: "unsupported" };
  let directoryName: string | undefined;
  try {
    const row = await loadLocalWorkspaceSync();
    if (!row) return { status: "not-configured" };
    directoryName = row.directoryName;
    const handle = row.directoryHandle as PermissionedDirectoryHandle;
    if (!await hasWritePermission(handle)) return { status: "permission-denied", directoryName: row.directoryName };
    const fileHandle = await handle.getFileHandle(getWorkspaceSyncFileName(workspace), { create: true });
    const writable = await fileHandle.createWritable();
    const pkg = createWorktoolsPackage({
      workspaces: [workspace],
      ruleTemplates: [],
      maskTemplates: [],
      baselines: [],
      recentFiles: [],
    });
    await writable.write(exportWorktoolsPackage(pkg));
    await writable.close();
    return { status: "synced", directoryName: row.directoryName };
  } catch {
    return { status: "error", directoryName };
  }
}
