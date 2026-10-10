import type { WorkspaceRecord } from "../types";
import { createWorktoolsPackage, exportWorktoolsPackage, importWorktoolsPackage } from "../core/package";
import {
  clearLocalWorkspaceSync,
  loadLocalWorkspaceSync,
  markLocalWorkspaceSyncInitialized,
  saveLocalWorkspaceSync,
} from "../storage/db";
import { isTauriRuntime } from "./files";
import { safeFileName } from "../utils";

interface FileSystemAccessWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle>;
}

type PermissionedDirectoryHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

type IterableDirectoryHandle = PermissionedDirectoryHandle & {
  values: () => AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle>;
};

export type WorkspaceSyncStatus = "synced" | "not-configured" | "unsupported" | "permission-denied" | "error";

export interface WorkspaceSyncResult {
  status: WorkspaceSyncStatus;
  directoryName?: string;
}

export interface LocalWorkspaceSyncDirectory {
  directoryName: string;
  initialized: boolean;
}

function getFileSystemAccessWindow(): FileSystemAccessWindow | undefined {
  if (typeof window === "undefined") return undefined;
  return window as FileSystemAccessWindow;
}

export function isLocalWorkspaceSyncSupported(): boolean {
  if (isTauriRuntime()) return true;
  const target = getFileSystemAccessWindow();
  return Boolean(target?.isSecureContext && target.showDirectoryPicker);
}

export function getWorkspaceSyncFileName(workspace: WorkspaceRecord): string {
  return safeFileName(`worktools-workspace-${workspace.id}.apiwork`);
}

function joinPath(directoryPath: string, fileName: string): string {
  const separator = directoryPath.includes("\\") && !directoryPath.includes("/") ? "\\" : "/";
  return `${directoryPath.replace(/[\\/]+$/, "")}${separator}${fileName}`;
}

async function hasReadPermission(handle: PermissionedDirectoryHandle): Promise<boolean> {
  if (typeof handle.queryPermission !== "function") return true;
  return await handle.queryPermission({ mode: "read" }) === "granted";
}

async function hasWritePermission(handle: PermissionedDirectoryHandle): Promise<boolean> {
  const descriptor = { mode: "readwrite" } as const;
  if (typeof handle.queryPermission !== "function") return true;
  if (await handle.queryPermission(descriptor) === "granted") return true;
  return typeof handle.requestPermission === "function" && await handle.requestPermission(descriptor) === "granted";
}

function isWorkspaceFileName(name: string): boolean {
  return /^worktools-workspace-.*\.apiwork$/i.test(name);
}

function parseWorkspaceFile(name: string, bytes: Uint8Array): WorkspaceRecord {
  const pkg = importWorktoolsPackage(bytes);
  if (pkg.workspaces.length !== 1) throw new Error(`工作区文件必须恰好包含一条记录：${name}`);
  const workspace = pkg.workspaces[0];
  if (!workspace || getWorkspaceSyncFileName(workspace) !== name) throw new Error(`工作区文件名与内容不匹配：${name}`);
  return workspace;
}

export async function getLocalWorkspaceSyncDirectory(): Promise<LocalWorkspaceSyncDirectory | undefined> {
  const row = await loadLocalWorkspaceSync();
  return row ? { directoryName: row.directoryName, initialized: row.initialized ?? false } : undefined;
}

export async function chooseLocalWorkspaceSyncDirectory(): Promise<LocalWorkspaceSyncDirectory | undefined> {
  if (isTauriRuntime()) {
    const [{ open }] = await Promise.all([import("@tauri-apps/plugin-dialog")]);
    const selected = await open({ multiple: false, directory: true });
    if (!selected || Array.isArray(selected)) return undefined;
    const directoryName = selected.split(/[\\/]/).filter(Boolean).pop() ?? selected;
    await saveLocalWorkspaceSync({ directoryName, directoryPath: selected });
    return { directoryName, initialized: false };
  }

  const target = getFileSystemAccessWindow();
  if (!target?.isSecureContext || !target.showDirectoryPicker) return undefined;
  const handle = await target.showDirectoryPicker({ mode: "readwrite" });
  if (!await hasWritePermission(handle)) return undefined;
  await saveLocalWorkspaceSync({ directoryName: handle.name, directoryHandle: handle });
  return { directoryName: handle.name, initialized: false };
}

export async function clearLocalWorkspaceSyncDirectory(): Promise<void> {
  await clearLocalWorkspaceSync();
}

export async function loadLocalWorkspaceRecords(): Promise<WorkspaceRecord[]> {
  const row = await loadLocalWorkspaceSync();
  if (!row) return [];
  const workspaces: WorkspaceRecord[] = [];

  if (isTauriRuntime()) {
    if (!row.directoryPath) throw new Error("本地工作区目录路径不可用");
    const fs = await import("@tauri-apps/plugin-fs");
    for (const entry of await fs.readDir(row.directoryPath)) {
      if (!entry.isFile || !entry.name || !isWorkspaceFileName(entry.name)) continue;
      const workspace = parseWorkspaceFile(entry.name, await fs.readFile(joinPath(row.directoryPath, entry.name)));
      workspaces.push(workspace);
    }
    return workspaces;
  }

  if (!row.directoryHandle) throw new Error("本地工作区目录句柄不可用");
  const directoryHandle = row.directoryHandle as IterableDirectoryHandle;
  if (!await hasReadPermission(directoryHandle)) throw new Error("本地工作区目录读取权限未授予");
  for await (const entry of directoryHandle.values()) {
    if (entry.kind !== "file" || !isWorkspaceFileName(entry.name)) continue;
    const file = await entry.getFile();
    const record = parseWorkspaceFile(entry.name, new Uint8Array(await file.arrayBuffer()));
    if (record) workspaces.push(record);
  }
  return workspaces;
}

async function writeWorkspaceFile(workspace: WorkspaceRecord): Promise<void> {
  const pkg = createWorktoolsPackage({
    workspaces: [workspace],
    ruleTemplates: [],
    maskTemplates: [],
    baselines: [],
    recentFiles: [],
  });
  const bytes = exportWorktoolsPackage(pkg);
  const row = await loadLocalWorkspaceSync();
  if (!row) throw new Error("本地工作区目录未配置");

  if (isTauriRuntime()) {
    if (!row.directoryPath) throw new Error("本地工作区目录路径不可用");
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(joinPath(row.directoryPath, getWorkspaceSyncFileName(workspace)), bytes);
    return;
  }

  if (!row.directoryHandle) throw new Error("本地工作区目录句柄不可用");
  const handle = row.directoryHandle as IterableDirectoryHandle;
  if (!await hasWritePermission(handle)) throw new DOMException("Permission denied", "NotAllowedError");
  const fileHandle = await handle.getFileHandle(getWorkspaceSyncFileName(workspace), { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();
}

export async function syncWorkspaceToLocalDirectory(workspace: WorkspaceRecord): Promise<WorkspaceSyncResult> {
  if (!isLocalWorkspaceSyncSupported()) {
    const row = await loadLocalWorkspaceSync();
    if (row) await markLocalWorkspaceSyncInitialized(false).catch(() => undefined);
    return { status: "unsupported", directoryName: row?.directoryName };
  }
  const row = await loadLocalWorkspaceSync();
  if (!row) return { status: "not-configured" };

  try {
    await writeWorkspaceFile(workspace);
    return { status: "synced", directoryName: row.directoryName };
  } catch (error) {
    await markLocalWorkspaceSyncInitialized(false).catch(() => undefined);
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return { status: "permission-denied", directoryName: row.directoryName };
    }
    return { status: "error", directoryName: row.directoryName };
  }
}

async function removeWorkspaceFileFromRow(
  row: NonNullable<Awaited<ReturnType<typeof loadLocalWorkspaceSync>>>,
  fileName: string,
  knownToExist = false,
): Promise<void> {
  if (isTauriRuntime()) {
    if (!row.directoryPath) throw new Error("本地工作区目录路径不可用");
    const fs = await import("@tauri-apps/plugin-fs");
    if (!knownToExist) {
      const entries = await fs.readDir(row.directoryPath);
      if (!entries.some((entry) => entry.isFile && entry.name === fileName)) return;
    }
    await fs.remove(joinPath(row.directoryPath, fileName));
    return;
  }
  if (!row.directoryHandle) throw new Error("本地工作区目录句柄不可用");
  const handle = row.directoryHandle as IterableDirectoryHandle;
  if (!await hasWritePermission(handle)) throw new DOMException("Permission denied", "NotAllowedError");
  if (knownToExist) {
    await handle.removeEntry(fileName);
    return;
  }
  for await (const entry of handle.values()) {
    if (entry.kind === "file" && entry.name === fileName) {
      await handle.removeEntry(fileName);
      return;
    }
  }
}

export async function deleteLocalWorkspaceFile(workspaceId: string): Promise<WorkspaceSyncResult> {
  const row = await loadLocalWorkspaceSync();
  if (!row) return { status: "not-configured" };
  if (!isLocalWorkspaceSyncSupported()) {
    await markLocalWorkspaceSyncInitialized(false).catch(() => undefined);
    return { status: "unsupported", directoryName: row.directoryName };
  }
  try {
    const fileName = safeFileName(`worktools-workspace-${workspaceId}.apiwork`);
    await removeWorkspaceFileFromRow(row, fileName);
    return { status: "synced", directoryName: row.directoryName };
  } catch (error) {
    await markLocalWorkspaceSyncInitialized(false).catch(() => undefined);
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return { status: "permission-denied", directoryName: row.directoryName };
    }
    return { status: "error", directoryName: row.directoryName };
  }
}

export async function syncAllWorkspacesToLocalDirectory(
  workspaces: WorkspaceRecord[],
  replaceExisting = false,
): Promise<WorkspaceSyncResult> {
  if (!isLocalWorkspaceSyncSupported()) {
    const row = await loadLocalWorkspaceSync();
    if (row) await markLocalWorkspaceSyncInitialized(false).catch(() => undefined);
    return { status: "unsupported", directoryName: row?.directoryName };
  }
  const row = await loadLocalWorkspaceSync();
  if (!row) return { status: "not-configured" };

  try {
    for (const workspace of workspaces) {
      const result = await syncWorkspaceToLocalDirectory(workspace);
      if (result.status !== "synced") {
        if (result.status === "error" || result.status === "permission-denied") await markLocalWorkspaceSyncInitialized(false);
        return result;
      }
    }

    if (replaceExisting) {
      const expectedFiles = new Set(workspaces.map(getWorkspaceSyncFileName));
      const staleFiles: string[] = [];
      if (isTauriRuntime()) {
        if (!row.directoryPath) throw new Error("本地工作区目录路径不可用");
        const fs = await import("@tauri-apps/plugin-fs");
        for (const entry of await fs.readDir(row.directoryPath)) {
          if (entry.isFile && entry.name && isWorkspaceFileName(entry.name) && !expectedFiles.has(entry.name)) staleFiles.push(entry.name);
        }
      } else {
        if (!row.directoryHandle) throw new Error("本地工作区目录句柄不可用");
        const handle = row.directoryHandle as IterableDirectoryHandle;
        if (!await hasWritePermission(handle)) throw new DOMException("Permission denied", "NotAllowedError");
        for await (const entry of handle.values()) {
          if (entry.kind === "file" && isWorkspaceFileName(entry.name) && !expectedFiles.has(entry.name)) staleFiles.push(entry.name);
        }
      }
      for (const fileName of staleFiles) await removeWorkspaceFileFromRow(row, fileName, true);
    }

    await markLocalWorkspaceSyncInitialized(true);
    return { status: "synced", directoryName: row.directoryName };
  } catch (error) {
    await markLocalWorkspaceSyncInitialized(false);
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return { status: "permission-denied", directoryName: row.directoryName };
    }
    return { status: "error", directoryName: row.directoryName };
  }
}

export async function clearLocalWorkspaceFiles(): Promise<WorkspaceSyncResult> {
  const row = await loadLocalWorkspaceSync();
  if (!row) return { status: "not-configured" };
  if (!isLocalWorkspaceSyncSupported()) return { status: "unsupported", directoryName: row.directoryName };
  return syncAllWorkspacesToLocalDirectory([], true);
}
