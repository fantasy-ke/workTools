import { create } from "zustand";
import type {
  AppPersistedData,
  MaskRule,
  MaskTemplate,
  RecentFile,
  RuleTemplate,
  StructureBaseline,
  ViewId,
  WorkspaceRecord,
  WorkspaceSnapshot,
  WorktoolsPackage,
  WorktoolsSettings,
} from "../types";
import { createId } from "../utils";
import { DEFAULT_MASK_RULES } from "../core/masking";
import {
  DEFAULT_SETTINGS,
  clearAllData,
  db,
  loadPersistedData,
  replacePersistedData,
  saveSettings,
} from "../storage/db";

interface AppState extends AppPersistedData {
  recycledWorkspaces: WorkspaceRecord[];
  hydrated: boolean;
  storageError?: string;
  view: ViewId;
  maskRules: MaskRule[];
  initialize: () => Promise<void>;
  setView: (view: ViewId) => void;
  updateSettings: (patch: Partial<WorktoolsSettings>) => Promise<void>;
  saveWorkspace: (name: string, snapshot: WorkspaceSnapshot, sensitiveMode?: boolean) => Promise<WorkspaceRecord>;
  updateWorkspace: (id: string, snapshot: WorkspaceSnapshot, sensitiveMode?: boolean) => Promise<WorkspaceRecord>;
  renameWorkspace: (id: string, name: string) => Promise<WorkspaceRecord>;
  deleteWorkspace: (id: string) => Promise<void>;
  restoreWorkspace: (id: string) => Promise<void>;
  permanentlyDeleteWorkspace: (id: string) => Promise<void>;
  emptyWorkspaceTrash: () => Promise<void>;
  toggleWorkspacePinned: (id: string) => Promise<void>;
  saveRuleTemplate: (name: string, options: RuleTemplate["options"]) => Promise<RuleTemplate>;
  deleteRuleTemplate: (id: string) => Promise<void>;
  saveMaskTemplate: (name: string, rules: MaskRule[]) => Promise<MaskTemplate>;
  deleteMaskTemplate: (id: string) => Promise<void>;
  loadMaskRules: (rules: MaskRule[]) => void;
  setMaskRules: (rules: MaskRule[]) => void;
  saveBaseline: (baseline: Omit<StructureBaseline, "id" | "createdAt">) => Promise<StructureBaseline>;
  deleteBaseline: (id: string) => Promise<void>;
  addRecentFile: (file: Omit<RecentFile, "id" | "openedAt">) => Promise<void>;
  importPackage: (pkg: WorktoolsPackage) => Promise<void>;
  clearData: () => Promise<void>;
}

const empty: AppPersistedData = {
  workspaces: [],
  ruleTemplates: [],
  maskTemplates: [],
  baselines: [],
  recentFiles: [],
  settings: DEFAULT_SETTINGS,
};

export const useAppStore = create<AppState>((set, get) => ({
  ...empty,
  recycledWorkspaces: [],
  hydrated: false,
  view: "home",
  maskRules: DEFAULT_MASK_RULES,
  initialize: async () => {
    try {
      const data = await loadPersistedData();
      set({ ...data, hydrated: true, storageError: undefined });
    } catch (error) {
      set({ hydrated: true, storageError: error instanceof Error ? error.message : "本地数据库初始化失败" });
    }
  },
  setView: (view) => set({ view }),
  updateSettings: async (patch) => {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    await saveSettings(settings);
  },
  saveWorkspace: async (name, snapshot, sensitiveMode = false) => {
    const now = new Date().toISOString();
    const record: WorkspaceRecord = {
      id: createId("workspace"),
      name: name.trim() || "未命名工作区",
      type: snapshot.kind,
      createdAt: now,
      updatedAt: now,
      pinned: false,
      sensitiveMode,
      snapshot,
    };
    await db.workspaces.put(record);
    set({ workspaces: [record, ...get().workspaces] });
    return record;
  },
  updateWorkspace: async (id, snapshot, sensitiveMode = false) => {
    const existing = get().workspaces.find((workspace) => workspace.id === id);
    if (!existing) throw new Error("工作区不存在");
    const record: WorkspaceRecord = {
      ...existing,
      type: snapshot.kind,
      updatedAt: new Date().toISOString(),
      sensitiveMode,
      snapshot,
    };
    await db.workspaces.put(record);
    set({ workspaces: [record, ...get().workspaces.filter((workspace) => workspace.id !== id)] });
    return record;
  },
  renameWorkspace: async (id, name) => {
    const existing = get().workspaces.find((workspace) => workspace.id === id);
    if (!existing) throw new Error("工作区不存在");
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("工作区名称不能为空");
    if (trimmedName === existing.name) return existing;
    const record: WorkspaceRecord = {
      ...existing,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
    };
    await db.workspaces.put(record);
    set({ workspaces: [record, ...get().workspaces.filter((workspace) => workspace.id !== id)] });
    return record;
  },
  deleteWorkspace: async (id) => {
    const item = get().workspaces.find((workspace) => workspace.id === id);
    if (!item) return;
    const now = new Date().toISOString();
    const recycled = { ...item, pinned: false, updatedAt: now, deletedAt: now };
    await db.workspaces.put(recycled);
    set({
      workspaces: get().workspaces.filter((workspace) => workspace.id !== id),
      recycledWorkspaces: [recycled, ...get().recycledWorkspaces],
    });
  },
  restoreWorkspace: async (id) => {
    const item = get().recycledWorkspaces.find((workspace) => workspace.id === id);
    if (!item) return;
    const restored: WorkspaceRecord = { ...item, deletedAt: undefined, updatedAt: new Date().toISOString() };
    await db.workspaces.put(restored);
    set({
      workspaces: [restored, ...get().workspaces],
      recycledWorkspaces: get().recycledWorkspaces.filter((workspace) => workspace.id !== id),
    });
  },
  permanentlyDeleteWorkspace: async (id) => {
    await db.workspaces.delete(id);
    set({ recycledWorkspaces: get().recycledWorkspaces.filter((workspace) => workspace.id !== id) });
  },
  emptyWorkspaceTrash: async () => {
    const ids = get().recycledWorkspaces.map((workspace) => workspace.id);
    await db.workspaces.bulkDelete(ids);
    set({ recycledWorkspaces: [] });
  },
  toggleWorkspacePinned: async (id) => {
    const item = get().workspaces.find((workspace) => workspace.id === id);
    if (!item) return;
    const updated = { ...item, pinned: !item.pinned, updatedAt: new Date().toISOString() };
    await db.workspaces.put(updated);
    set({ workspaces: get().workspaces.map((workspace) => workspace.id === id ? updated : workspace) });
  },
  saveRuleTemplate: async (name, options) => {
    const template: RuleTemplate = { id: createId("rules"), name: name.trim() || "未命名规则", createdAt: new Date().toISOString(), options };
    await db.ruleTemplates.put(template);
    set({ ruleTemplates: [template, ...get().ruleTemplates] });
    return template;
  },
  deleteRuleTemplate: async (id) => {
    await db.ruleTemplates.delete(id);
    set({ ruleTemplates: get().ruleTemplates.filter((item) => item.id !== id) });
  },
  saveMaskTemplate: async (name, rules) => {
    const template: MaskTemplate = { id: createId("mask"), name: name.trim() || "未命名脱敏规则", createdAt: new Date().toISOString(), rules };
    await db.maskTemplates.put(template);
    set({ maskTemplates: [template, ...get().maskTemplates] });
    return template;
  },
  deleteMaskTemplate: async (id) => {
    await db.maskTemplates.delete(id);
    set({ maskTemplates: get().maskTemplates.filter((item) => item.id !== id) });
  },
  loadMaskRules: (rules) => set({ maskRules: rules.map((rule) => ({ ...rule })) }),
  setMaskRules: (maskRules) => set({ maskRules }),
  saveBaseline: async (value) => {
    const baseline: StructureBaseline = { ...value, id: createId("baseline"), createdAt: new Date().toISOString() };
    await db.baselines.put(baseline);
    set({ baselines: [baseline, ...get().baselines] });
    return baseline;
  },
  deleteBaseline: async (id) => {
    await db.baselines.delete(id);
    set({ baselines: get().baselines.filter((item) => item.id !== id) });
  },
  addRecentFile: async (value) => {
    if (!get().settings.rememberRecentFiles) return;
    const recent: RecentFile = { ...value, id: value.path || `${value.name}-${value.size}`, openedAt: new Date().toISOString() };
    await db.recentFiles.put(recent);
    const items = [recent, ...get().recentFiles.filter((item) => item.id !== recent.id)].slice(0, 30);
    set({ recentFiles: items });
  },
  importPackage: async (pkg) => {
    const data = {
      workspaces: pkg.workspaces.filter((workspace) => !workspace.deletedAt),
      ruleTemplates: pkg.ruleTemplates,
      maskTemplates: pkg.maskTemplates,
      baselines: pkg.baselines,
      recentFiles: pkg.recentFiles,
    };
    await replacePersistedData(data);
    set({ ...data, recycledWorkspaces: [] });
  },
  clearData: async () => {
    await clearAllData();
    await saveSettings(DEFAULT_SETTINGS);
    set({ ...empty, recycledWorkspaces: [], maskRules: DEFAULT_MASK_RULES });
  },
}));
