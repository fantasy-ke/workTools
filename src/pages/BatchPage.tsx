import { useMemo, useState } from "react";
import { CheckCircle2, Download, Files, FolderOpen, GitCompareArrows, LoaderCircle, Play, TriangleAlert } from "lucide-react";
import type { BatchPair, LocalTextFile } from "../types";
import { Badge, Button, EmptyState, PanelHeader } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAppStore } from "../store/appStore";
import { compareDocuments } from "../core/diff";
import { pairDirectoryFiles } from "../core/batch";
import { openDirectoryTextFiles, saveTextFile } from "../platform/files";
import { formatBytes } from "../utils";
import { translate as t } from "../i18n";

export function BatchPage() {
  const settings = useAppStore((state) => state.settings);
  const { notify } = useToast();
  const [leftFiles, setLeftFiles] = useState<LocalTextFile[]>([]);
  const [rightFiles, setRightFiles] = useState<LocalTextFile[]>([]);
  const [pairs, setPairs] = useState<BatchPair[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const selected = pairs.find((item) => item.id === selectedId) ?? pairs[0];
  const stats = useMemo(() => ({ total: pairs.length, complete: pairs.filter((item) => item.result).length, changed: pairs.filter((item) => item.result?.changes.length).length, unmatched: pairs.filter((item) => !item.left || !item.right).length, failed: pairs.filter((item) => item.error).length }), [pairs]);

  const choose = async (side: "left" | "right") => {
    const files = await openDirectoryTextFiles(); if (!files.length) return;
    const accepted = files.filter((file) => file.size <= settings.maxLiveBytes);
    if (accepted.length !== files.length) notify(t(`${files.length - accepted.length} 个超大文件已跳过`), "info");
    const nextLeft = side === "left" ? accepted : leftFiles;
    const nextRight = side === "right" ? accepted : rightFiles;
    if (side === "left") setLeftFiles(accepted); else setRightFiles(accepted);
    const nextPairs = pairDirectoryFiles(nextLeft, nextRight); setPairs(nextPairs); setSelectedId(nextPairs[0]?.id ?? ""); setProgress(0);
    notify(t(`已读取 ${accepted.length} 个${side === "left" ? "左侧" : "右侧"}文件`));
  };
  const runAll = async () => {
    if (!pairs.length) { notify(t("请先选择左右目录"), "error"); return; }
    setRunning(true); setProgress(0);
    const next: BatchPair[] = [];
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index];
      if (!pair.left || !pair.right) next.push({ ...pair, error: t("左右文件未配对") });
      else {
        try { next.push({ ...pair, result: compareDocuments(pair.left.content, pair.right.content, "auto", settings.defaultDiffOptions), error: undefined }); }
        catch (error) { next.push({ ...pair, error: error instanceof Error ? error.message : t("对比失败") }); }
      }
      setProgress(Math.round(((index + 1) / pairs.length) * 100));
      if (index % 20 === 0) await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    setPairs(next); setRunning(false); notify(t("批量对比已完成"));
  };
  const exportSummary = async (format: "csv" | "json") => {
    const data = pairs.map((pair) => ({ file: pair.name, status: pair.error ? "failed" : pair.result ? (pair.result.changes.length ? "changed" : "same") : "pending", changes: pair.result?.changes.length ?? 0, format: pair.result?.format ?? "", warnings: pair.result?.warnings.join("；") ?? pair.error ?? "" }));
    const csvHeader = [t("文件"), t("状态"), t("差异数"), t("格式"), t("警告")].join(",");
    const content = format === "json" ? JSON.stringify({ exportedAt: new Date().toISOString(), summary: stats, files: data, results: pairs.map((pair) => ({ name: pair.name, result: pair.result, error: pair.error })) }, null, 2) : `\uFEFF${[csvHeader, ...data.map((item) => [item.file, item.status, item.changes, item.format, item.warnings].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))].join("\r\n")}`;
    await saveTextFile(`worktools-batch.${format}`, content); notify(t(`已导出批量 ${format.toUpperCase()} 结果`));
  };

  return <div className="tool-page batch-page"><div className="toolbar"><div className="toolbar-group"><Button size="small" onClick={() => choose("left")}><FolderOpen />{t("选择左目录")}</Button><Button size="small" onClick={() => choose("right")}><FolderOpen />{t("选择右目录")}</Button><Button size="small" variant="primary" onClick={runAll} disabled={running}>{running ? <LoaderCircle className="spin" /> : <Play />}{running ? t(`对比中 ${progress}%`) : t("开始批量对比")}</Button></div><div className="toolbar-spacer"/><Badge tone="muted">{leftFiles.length} ↔ {rightFiles.length} {t("个文件")}</Badge><Button size="small" onClick={() => exportSummary("csv")} disabled={!stats.complete}><Download />{t("导出 CSV")}</Button><Button size="small" onClick={() => exportSummary("json")} disabled={!stats.complete}>{t("导出 JSON")}</Button></div><div className="batch-summary"><div><span>{t("配对任务")}</span><strong>{stats.total}</strong></div><div><span>{t("已完成")}</span><strong>{stats.complete}</strong></div><div><span>{t("存在差异")}</span><strong className="warn-text">{stats.changed}</strong></div><div><span>{t("未配对")}</span><strong className="danger-text">{stats.unmatched}</strong></div><div><span>{t("失败")}</span><strong>{stats.failed}</strong></div>{running && <div className="progress-track"><i style={{ width: `${progress}%` }} /></div>}</div><div className="batch-grid"><aside className="pair-list"><div className="pair-list-head"><strong>{t("文件任务")}</strong><span>{pairs.length}</span></div>{pairs.length ? pairs.map((pair) => <button key={pair.id} className={`pair-row ${selected?.id === pair.id ? "active" : ""}`} onClick={() => setSelectedId(pair.id)}><span className="pair-status">{pair.error ? <TriangleAlert /> : pair.result ? pair.result.changes.length ? <GitCompareArrows /> : <CheckCircle2 /> : <Files />}</span><span><strong title={pair.name}>{pair.name}</strong><small>{!pair.left ? t("缺少左侧") : !pair.right ? t("缺少右侧") : pair.error ?? pair.result ? t(`${pair.result?.changes.length ?? 0} 处差异`) : t("等待对比")}</small></span>{pair.result && <Badge tone={pair.result.changes.length ? "warning" : "success"}>{pair.result.changes.length}</Badge>}</button>) : <EmptyState icon={<Files />} title={t("等待目录")} description={t("分别选择左右目录后，将按相对路径自动配对。")} />}</aside><section className="batch-detail">{selected ? <><PanelHeader title={selected.name} meta={t(`${selected.left ? formatBytes(selected.left.size) : "缺失"} ↔ ${selected.right ? formatBytes(selected.right.size) : "缺失"}`)} actions={selected.result && <Badge tone={selected.result.changes.length ? "warning" : "success"}>{selected.result.changes.length ? t(`${selected.result.changes.length} 处差异`) : t("一致")}</Badge>} />{selected.error ? <EmptyState icon={<TriangleAlert />} title={t("该任务无法完成")} description={t(selected.error)} /> : selected.result ? <div className="batch-change-list">{selected.result.warnings.length > 0 && <div className="warning-banner">{selected.result.warnings.map(t).join(t("；"))}</div>}{selected.result.changes.length ? selected.result.changes.slice(0, 500).map((change) => <div className="batch-change" key={change.id}><Badge tone={change.kind === "added" ? "success" : change.kind === "removed" ? "danger" : "warning"}>{change.kind}</Badge><code>{change.path}</code><span>{t(change.message)}</span></div>) : <EmptyState icon={<CheckCircle2 />} title={t("文件内容一致")} description={t("按当前默认规则未发现差异。")} />}</div> : <div className="dual-preview"><pre>{selected.left?.content.slice(0, 20_000) ?? t("左侧文件缺失")}</pre><pre>{selected.right?.content.slice(0, 20_000) ?? t("右侧文件缺失")}</pre></div>}</> : <EmptyState icon={<GitCompareArrows />} title={t("选择一个任务")} description={t("对比结果会显示在这里。")} />}</section></div></div>;
}