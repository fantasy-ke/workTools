import { useEffect, useRef } from "react";
import type { WorkspaceRecord, WorkspaceSnapshot } from "../types";

interface WorkspaceSaveTargetOptions {
  workspaceId?: string;
  snapshot: WorkspaceSnapshot;
  sensitiveMode?: boolean;
  requestName: () => string | null;
  createWorkspace: (name: string, snapshot: WorkspaceSnapshot, sensitiveMode?: boolean) => Promise<WorkspaceRecord>;
  updateWorkspace: (id: string, snapshot: WorkspaceSnapshot, sensitiveMode?: boolean) => Promise<WorkspaceRecord>;
}

export async function saveWorkspaceTarget({
  workspaceId,
  snapshot,
  sensitiveMode = false,
  requestName,
  createWorkspace,
  updateWorkspace,
}: WorkspaceSaveTargetOptions): Promise<WorkspaceRecord | undefined> {
  if (workspaceId) return updateWorkspace(workspaceId, snapshot, sensitiveMode);
  const name = requestName();
  if (!name) return undefined;
  return createWorkspace(name, snapshot, sensitiveMode);
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
