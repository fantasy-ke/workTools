import { useEffect, useRef } from "react";
import type { WorkspaceRecord, WorkspaceSnapshot } from "../types";
import { syncWorkspaceToLocalDirectory, type WorkspaceSyncResult } from "../platform/workspaceSync";

interface WorkspaceSaveTargetOptions {
  workspaceId?: string;
  snapshot: WorkspaceSnapshot;
  sensitiveMode?: boolean;
  requestName: () => string | null;
  createWorkspace: (name: string, snapshot: WorkspaceSnapshot, sensitiveMode?: boolean) => Promise<WorkspaceRecord>;
  updateWorkspace: (id: string, snapshot: WorkspaceSnapshot, sensitiveMode?: boolean) => Promise<WorkspaceRecord>;
}

export interface WorkspaceSaveResult {
  workspace: WorkspaceRecord;
  sync?: WorkspaceSyncResult;
}

export async function saveWorkspaceTarget({
  workspaceId,
  snapshot,
  sensitiveMode = false,
  requestName,
  createWorkspace,
  updateWorkspace,
}: WorkspaceSaveTargetOptions): Promise<WorkspaceSaveResult | undefined> {
  if (workspaceId) {
    const workspace = await updateWorkspace(workspaceId, snapshot, sensitiveMode);
    return { workspace, sync: await syncWorkspaceToLocalDirectory(workspace) };
  }
  const name = requestName();
  if (!name) return undefined;
  const workspace = await createWorkspace(name, snapshot, sensitiveMode);
  return { workspace, sync: await syncWorkspaceToLocalDirectory(workspace) };
}

export function getWorkspaceSaveMessage(result: WorkspaceSaveResult, translate: (source: string) => string): string {
  if (result.sync?.status === "synced") return translate("工作区已保存为本地文件");
  if (result.sync?.status === "not-configured") return translate("工作区已保存到本机数据库；请先在设置中选择本地目录以生成文件");
  if (result.sync?.status === "unsupported") return translate("工作区已保存；当前浏览器不支持自动同步，请使用导出工作包");
  if (result.sync?.status === "permission-denied") return translate("工作区已保存，但本地目录权限未授予");
  if (result.sync?.status === "error") return translate("工作区已保存，但同步本地文件失败");
  return translate("工作区已保存");
}

export function useWorkspaceSaveShortcut(
  active: boolean,
  onSave: () => void | Promise<void>,
) {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.key.toLocaleLowerCase() !== "s"
      ) return;

      event.preventDefault();
      void onSaveRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);
}
