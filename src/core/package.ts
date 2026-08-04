import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { AppPersistedData, WorktoolsPackage } from "../types";

const FORMAT = "worktools-apiwork-v1" as const;

export function createWorktoolsPackage(data: AppPersistedData): WorktoolsPackage {
  return {
    format: FORMAT,
    exportedAt: new Date().toISOString(),
    workspaces: data.workspaces,
    ruleTemplates: data.ruleTemplates,
    maskTemplates: data.maskTemplates,
    baselines: data.baselines,
    recentFiles: data.recentFiles,
  };
}

function validatePackage(value: unknown): WorktoolsPackage {
  if (!value || typeof value !== "object") throw new Error("工作包内容无效");
  const pkg = value as Partial<WorktoolsPackage>;
  if (pkg.format !== FORMAT) throw new Error("不支持的工作包版本");
  const keys: Array<keyof Pick<WorktoolsPackage, "workspaces" | "ruleTemplates" | "maskTemplates" | "baselines" | "recentFiles">> = ["workspaces", "ruleTemplates", "maskTemplates", "baselines", "recentFiles"];
  keys.forEach((key) => { if (!Array.isArray(pkg[key])) throw new Error(`工作包缺少 ${key}`); });
  return pkg as WorktoolsPackage;
}

export function exportWorktoolsPackage(pkg: WorktoolsPackage): Uint8Array {
  const manifest = JSON.stringify({ format: FORMAT, exportedAt: pkg.exportedAt, entry: "data.json" }, null, 2);
  const data = JSON.stringify(pkg, null, 2);
  return zipSync({ "manifest.json": strToU8(manifest), "data.json": strToU8(data) }, { level: 6 });
}

export function importWorktoolsPackage(bytes: Uint8Array): WorktoolsPackage {
  try {
    const files = unzipSync(bytes);
    const data = files["data.json"];
    if (!data) throw new Error("工作包缺少 data.json");
    return validatePackage(JSON.parse(strFromU8(data)));
  } catch (zipError) {
    try {
      return validatePackage(JSON.parse(strFromU8(bytes)));
    } catch {
      throw zipError instanceof Error ? zipError : new Error("工作包解析失败");
    }
  }
}