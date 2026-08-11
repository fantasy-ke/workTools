import Dexie, { type Table } from "dexie";
import type {
  AppPersistedData,
  MaskTemplate,
  RecentFile,
  RuleTemplate,
  StructureBaseline,
  WorkspaceRecord,
  WorktoolsSettings,
} from "../types";
import { DEFAULT_DIFF_OPTIONS } from "../core/diff";

export const DEFAULT_SETTINGS: WorktoolsSettings = {
  language: "zh-CN",
  theme: "system",
  density: "comfortable",
  tabOverflowMode: "scroll",
  editorFont: "Cascadia Code",
  fontSize: 14,
  wordWrap: true,
  gpuAcceleration: true,
  temporaryByDefault: true,
  rememberRecentFiles: true,
  syncWorkspaceToLocalFile: false,
  maxLiveBytes: 5 * 1024 * 1024,
  defaultDiffOptions: { ...DEFAULT_DIFF_OPTIONS },
};

export function applySettingsDefaults(value?: Partial<WorktoolsSettings>): WorktoolsSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...value,
    language: value?.language === "en-US" ? "en-US" : "zh-CN",
  };
}

interface SettingsRow { id: "settings"; value: WorktoolsSettings }

export interface LocalWorkspaceSyncRow {
  id: "workspace-directory";
  directoryName: string;
  directoryHandle: FileSystemDirectoryHandle;
}

class WorktoolsDb extends Dexie {
  workspaces!: Table<WorkspaceRecord, string>;
  ruleTemplates!: Table<RuleTemplate, string>;
  maskTemplates!: Table<MaskTemplate, string>;
  baselines!: Table<StructureBaseline, string>;
  recentFiles!: Table<RecentFile, string>;
  settings!: Table<SettingsRow, string>;
  localWorkspaceSync!: Table<LocalWorkspaceSyncRow, string>;

  constructor() {
    super("worktools-db");
    this.version(1).stores({
      workspaces: "id, type, pinned, updatedAt",
      ruleTemplates: "id, createdAt",
      maskTemplates: "id, createdAt",
      baselines: "id, format, createdAt",
      recentFiles: "id, openedAt, name",
      settings: "id",
    });
    this.version(2).stores({
      workspaces: "id, type, pinned, updatedAt",
      ruleTemplates: "id, createdAt",
      maskTemplates: "id, createdAt",
      baselines: "id, format, createdAt",
      recentFiles: "id, openedAt, name",
      settings: "id",
      localWorkspaceSync: "id",
    });
  }
}

export const db = new WorktoolsDb();

export async function loadPersistedData(): Promise<AppPersistedData & { recycledWorkspaces: WorkspaceRecord[] }> {
  const [allWorkspaces, ruleTemplates, maskTemplates, baselines, recentFiles, settings] = await Promise.all([
    db.workspaces.orderBy("updatedAt").reverse().toArray(),
    db.ruleTemplates.orderBy("createdAt").reverse().toArray(),
    db.maskTemplates.orderBy("createdAt").reverse().toArray(),
    db.baselines.orderBy("createdAt").reverse().toArray(),
    db.recentFiles.orderBy("openedAt").reverse().limit(30).toArray(),
    db.settings.get("settings"),
  ]);
  const workspaces = allWorkspaces.filter((item) => !item.deletedAt);
  const recycledWorkspaces = allWorkspaces.filter((item) => Boolean(item.deletedAt));
  return { workspaces, recycledWorkspaces, ruleTemplates, maskTemplates, baselines, recentFiles, settings: applySettingsDefaults(settings?.value) };
}

export async function saveSettings(value: WorktoolsSettings): Promise<void> {
  await db.settings.put({ id: "settings", value });
}

export async function loadLocalWorkspaceSync(): Promise<LocalWorkspaceSyncRow | undefined> {
  return db.localWorkspaceSync.get("workspace-directory");
}

export async function saveLocalWorkspaceSync(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
  await db.localWorkspaceSync.put({
    id: "workspace-directory",
    directoryName: directoryHandle.name,
    directoryHandle,
  });
}

export async function clearLocalWorkspaceSync(): Promise<void> {
  await db.localWorkspaceSync.delete("workspace-directory");
}

export async function replacePersistedData(data: Omit<AppPersistedData, "settings">): Promise<void> {
  await db.transaction("rw", db.workspaces, db.ruleTemplates, db.maskTemplates, db.baselines, db.recentFiles, async () => {
    await Promise.all([db.workspaces.clear(), db.ruleTemplates.clear(), db.maskTemplates.clear(), db.baselines.clear(), db.recentFiles.clear()]);
    await Promise.all([
      db.workspaces.bulkPut(data.workspaces),
      db.ruleTemplates.bulkPut(data.ruleTemplates),
      db.maskTemplates.bulkPut(data.maskTemplates),
      db.baselines.bulkPut(data.baselines),
      db.recentFiles.bulkPut(data.recentFiles),
    ]);
  });
}

export async function clearAllData(): Promise<void> {
  await db.delete();
  await db.open();
}