import { useMemo, useState } from "react";
import {
  Braces,
  CalendarClock,
  Download,
  FileArchive,
  FileInput,
  FileKey2,
  FolderKanban,
  GitCompareArrows,
  Pin,
  PinOff,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { WorkspaceRecord } from "../types";
import { Badge, Button, EmptyState } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAppStore } from "../store/appStore";
import { createWorktoolsPackage, exportWorktoolsPackage, importWorktoolsPackage } from "../core/package";
import { openBinaryFile, saveBinaryFile } from "../platform/files";
import { formatDateTime } from "../utils";
import { translate as t } from "../i18n";

type Tab = "workspaces" | "rules" | "masks" | "baselines" | "trash";

function workspaceIcon(type: WorkspaceRecord["type"]) {
  if (type === "format") return <Braces />;
  if (type === "diff") return <GitCompareArrows />;
  return <CalendarClock />;
}

function workspaceDescription(type: WorkspaceRecord["type"]) {
  if (type === "format") return t("格式化与结构查看");
  if (type === "diff") return t("报文对比场景");
  return t("Cron 表达式场景");
}

export function WorkspacesPage({ onOpen }: { onOpen: (workspace: WorkspaceRecord) => void }) {
  const state = useAppStore();
  const { notify } = useToast();
  const [tab, setTab] = useState<Tab>("workspaces");
  const [search, setSearch] = useState("");
  const normalizedSearch = search.toLocaleLowerCase();
  const filtered = useMemo(
    () => [...state.workspaces]
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
      .filter((item) => item.name.toLocaleLowerCase().includes(normalizedSearch)),
    [state.workspaces, normalizedSearch],
  );
  const recycled = useMemo(
    () => [...state.recycledWorkspaces]
      .sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""))
      .filter((item) => item.name.toLocaleLowerCase().includes(normalizedSearch)),
    [state.recycledWorkspaces, normalizedSearch],
  );

  const exportPackage = async () => {
    const pkg = createWorktoolsPackage({
      workspaces: state.workspaces,
      ruleTemplates: state.ruleTemplates,
      maskTemplates: state.maskTemplates,
      baselines: state.baselines,
      recentFiles: state.recentFiles,
      settings: state.settings,
    });
    await saveBinaryFile(`worktools-${new Date().toISOString().slice(0, 10)}.apiwork`, exportWorktoolsPackage(pkg));
    notify(t("工作包已导出"));
  };

  const importPackage = async () => {
    const file = await openBinaryFile("apiwork");
    if (!file) return;
    if (!window.confirm(t("导入会替换当前的工作区、模板、基线、回收站和最近文件记录。继续吗？"))) return;
    try {
      const pkg = importWorktoolsPackage(file.bytes);
      await state.importPackage(pkg);
      notify(t(`已导入 ${pkg.workspaces.length} 个工作区`));
    } catch (error) {
      notify(error instanceof Error ? error.message : t("工作包导入失败"), "error");
    }
  };

  const moveToTrash = async (workspace: WorkspaceRecord) => {
    await state.deleteWorkspace(workspace.id);
    notify(t(`“${workspace.name}”已移入回收站`));
  };

  const restoreWorkspace = async (workspace: WorkspaceRecord) => {
    await state.restoreWorkspace(workspace.id);
    notify(t(`“${workspace.name}”已恢复`));
  };

  const permanentlyDeleteWorkspace = async (workspace: WorkspaceRecord) => {
    if (!window.confirm(t(`永久删除工作区“${workspace.name}”？此操作无法撤销。`))) return;
    await state.permanentlyDeleteWorkspace(workspace.id);
    notify(t(`“${workspace.name}”已永久删除`));
  };

  const emptyTrash = async () => {
    if (!state.recycledWorkspaces.length) return;
    if (!window.confirm(t(`清空回收站中的 ${state.recycledWorkspaces.length} 个工作区？此操作无法撤销。`))) return;
    await state.emptyWorkspaceTrash();
    notify(t("回收站已清空"));
  };

  const tabLabel = (item: Tab) => {
    if (item === "workspaces") return t(`工作区 ${state.workspaces.length}`);
    if (item === "rules") return t(`对比规则 ${state.ruleTemplates.length}`);
    if (item === "masks") return t(`脱敏模板 ${state.maskTemplates.length}`);
    if (item === "baselines") return t(`结构基线 ${state.baselines.length}`);
    return t(`回收站 ${state.recycledWorkspaces.length}`);
  };

  return (
    <div className="page-scroll library-page">
      <div className="library-hero">
        <div>
          <span className="eyebrow">{t("本地资料库")}</span>
          <h1>{t("工作区与复用资产")}</h1>
          <p>{t("主动保存的报文场景、对比规则、脱敏模板和结构基线统一存放在本机。")}</p>
        </div>
        <div>
          <Button onClick={importPackage}><Upload />{t("导入 .apiwork")}</Button>
          <Button variant="primary" onClick={exportPackage}><Download />{t("导出工作包")}</Button>
        </div>
      </div>

      <div className="library-tabs">
        {(["workspaces", "rules", "masks", "baselines", "trash"] as const).map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{tabLabel(item)}</button>
        ))}
      </div>

      {tab === "workspaces" && (
        <section>
          <div className="library-toolbar">
            <div className="search-box"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("搜索工作区")} /></div>
            <span>{t("保存内容仅存放在本机；删除后可从回收站恢复。")}</span>
          </div>
          {filtered.length ? (
            <div className="workspace-card-grid">
              {filtered.map((workspace) => (
                <article className="workspace-card" key={workspace.id}>
                  <div className="workspace-card-top">
                    <span className="workspace-type-icon">{workspaceIcon(workspace.type)}</span>
                    <div className="workspace-card-actions">
                      <button className="icon-btn" onClick={() => state.toggleWorkspacePinned(workspace.id)} aria-label={workspace.pinned ? t("取消置顶") : t("置顶")}>{workspace.pinned ? <PinOff /> : <Pin />}</button>
                      <button className="icon-btn danger" onClick={() => void moveToTrash(workspace)} aria-label={t("移到回收站")} title={t("移到回收站")}><Trash2 /></button>
                    </div>
                  </div>
                  <Badge tone={workspace.type === "diff" ? "warning" : workspace.type === "cron" ? "accent" : "success"}>{workspace.type.toUpperCase()}</Badge>
                  <h3>{workspace.name}</h3>
                  <p>{workspaceDescription(workspace.type)}</p>
                  <div className="workspace-card-meta">
                    <span>{formatDateTime(workspace.updatedAt)}</span>
                    {workspace.sensitiveMode && <span><FileKey2 />{t("脱敏导出")}</span>}
                  </div>
                  <Button variant="ghost" onClick={() => onOpen(workspace)}>{t("打开工作区")}</Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={<FolderKanban />} title={t("没有匹配的工作区")} description={search ? t("换一个关键词试试。") : t("从格式化、对比或 Cron 页面保存第一个工作区。")} />
          )}
        </section>
      )}

      {tab === "trash" && (
        <section>
          <div className="library-toolbar">
            <div className="search-box"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("搜索回收站")} /></div>
            <Button size="small" variant="danger" disabled={!state.recycledWorkspaces.length} onClick={() => void emptyTrash()}><Trash2 />{t("清空回收站")}</Button>
          </div>
          {recycled.length ? (
            <div className="workspace-card-grid">
              {recycled.map((workspace) => (
                <article className="workspace-card workspace-card-recycled" key={workspace.id}>
                  <div className="workspace-card-top">
                    <span className="workspace-type-icon">{workspaceIcon(workspace.type)}</span>
                    <button className="icon-btn danger" onClick={() => void permanentlyDeleteWorkspace(workspace)} aria-label={t("永久删除")} title={t("永久删除")}><Trash2 /></button>
                  </div>
                  <Badge tone="muted">{workspace.type.toUpperCase()}</Badge>
                  <h3>{workspace.name}</h3>
                  <p>{workspaceDescription(workspace.type)}</p>
                  <div className="workspace-card-meta"><span>{t("删除于")} {formatDateTime(workspace.deletedAt || workspace.updatedAt)}</span></div>
                  <Button variant="ghost" onClick={() => void restoreWorkspace(workspace)}><RotateCcw />{t("恢复工作区")}</Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Trash2 />} title={t("回收站为空")} description={search ? t("没有匹配的已删除工作区。") : t("从工作区删除的内容会暂存在这里。")} />
          )}
        </section>
      )}

      {tab === "rules" && (
        <AssetList icon={<GitCompareArrows />} empty={t("暂无对比规则模板")} items={state.ruleTemplates.map((item) => ({
          id: item.id,
          name: item.name,
          meta: t(`${item.options.mode} · 数组 ${item.options.arrayMode} · ${formatDateTime(item.createdAt)}`),
          detail: t(`${item.options.ignorePaths.length} 条忽略路径，最大 ${item.options.maxChanges} 处差异`),
          onDelete: () => state.deleteRuleTemplate(item.id),
        }))} />
      )}
      {tab === "masks" && (
        <AssetList icon={<FileKey2 />} empty={t("暂无脱敏模板")} items={state.maskTemplates.map((item) => ({
          id: item.id,
          name: item.name,
          meta: t(`${item.rules.length} 条规则 · ${formatDateTime(item.createdAt)}`),
          detail: item.rules.map((rule) => rule.path).join("、") || t("空模板"),
          onDelete: () => state.deleteMaskTemplate(item.id),
        }))} />
      )}
      {tab === "baselines" && (
        <AssetList icon={<FileArchive />} empty={t("暂无结构基线")} items={state.baselines.map((item) => ({
          id: item.id,
          name: item.name,
          meta: t(`${item.format.toUpperCase()} · ${item.structure.length} 个结构项 · ${formatDateTime(item.createdAt)}`),
          detail: item.sourceName || t("手动保存"),
          onDelete: () => state.deleteBaseline(item.id),
        }))} />
      )}
    </div>
  );
}

function AssetList({ icon, empty, items }: { icon: React.ReactNode; empty: string; items: Array<{ id: string; name: string; meta: string; detail: string; onDelete: () => void }> }) {
  return items.length ? (
    <div className="asset-list">
      {items.map((item) => (
        <article className="asset-row" key={item.id}>
          <span className="asset-icon">{icon}</span>
          <div><h3>{item.name}</h3><p>{item.detail}</p><small>{item.meta}</small></div>
          <button className="icon-btn danger" onClick={() => window.confirm(t(`删除“${item.name}”？`)) && item.onDelete()}><Trash2 /></button>
        </article>
      ))}
    </div>
  ) : <EmptyState icon={<FileInput />} title={empty} description={t("在对应工具页面保存后即可复用。")} />;
}