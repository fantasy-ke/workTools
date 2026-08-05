import { useEffect, useMemo, useRef, useState } from "react";
import { Braces, ChevronDown, Clipboard, Download, Eraser, FileCheck2, FileInput, FileText, ListTree, Minimize2, Save, ShieldCheck, Sparkles, Undo2 } from "lucide-react";
import type { DocumentFormat, StructureEntry, WorkspaceRecord, WorkspaceSnapshot } from "../types";
import { CodeEditor, type CodeEditorInstance } from "../components/CodeEditor";
import { Badge, Button, EmptyState, PanelHeader, Toggle } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAppStore } from "../store/appStore";
import { detectFormat, escapeText, formatDocument, inferStructure, parseDocument, removeEscapes, unescapeText } from "../core/document";
import { maskDocumentText } from "../core/masking";
import { generateDocumentHtmlExport } from "../core/export";
import { openTextFiles, saveTextFile } from "../platform/files";
import { formatBytes } from "../utils";
import { useMonacoFindShortcut } from "../hooks/useMonacoFindShortcut";
import { saveWorkspaceTarget, useWorkspaceSaveShortcut } from "../hooks/useWorkspaceSaveShortcut";
import { translate as t } from "../i18n";
import { DocumentTreeView } from "./format/DocumentTreeView";

const SAMPLE = `{
  "requestId": "req-20260803-001",
  "hotel": { "id": 1024, "name": "示例酒店" },
  "rooms": [
    { "id": "DLX", "price": 688.00, "currency": "CNY" },
    { "id": "STD", "price": 428.00, "currency": "CNY" }
  ],
  "token": "sk-example-sensitive-token"
}`;

function resolve(text: string, format: DocumentFormat) { return format === "auto" ? detectFormat(text) : format; }

function compareEntries(current: StructureEntry[], baseline: StructureEntry[]) {
  const left = new Map(baseline.map((entry) => [entry.path, entry]));
  const right = new Map(current.map((entry) => [entry.path, entry]));
  return [...new Set([...left.keys(), ...right.keys()])].sort().flatMap((path) => {
    const a = left.get(path); const b = right.get(path);
    if (!a && b) return [{ path, message: t(`新增 ${b.type}`) }];
    if (a && !b) return [{ path, message: t(`缺少 ${a.type}`) }];
    if (a && b && (a.type !== b.type || a.cardinality !== b.cardinality)) return [{ path, message: `${a.type} → ${b.type}` }];
    return [];
  });
}

export function FormatPage({ snapshot, workspaceId, active = false, onTitleChange, onWorkspaceSaved }: { snapshot?: WorkspaceSnapshot; workspaceId?: string; active?: boolean; onTitleChange?: (name: string) => void; onWorkspaceSaved?: (workspace: WorkspaceRecord) => void }) {
  const settings = useAppStore((state) => state.settings);
  const maskRules = useAppStore((state) => state.maskRules);
  const baselines = useAppStore((state) => state.baselines);
  const addRecentFile = useAppStore((state) => state.addRecentFile);
  const saveWorkspace = useAppStore((state) => state.saveWorkspace);
  const updateWorkspace = useAppStore((state) => state.updateWorkspace);
  const saveBaseline = useAppStore((state) => state.saveBaseline);
  const { notify } = useToast();
  const [text, setText] = useState(SAMPLE);
  const [format, setFormat] = useState<DocumentFormat>("auto");
  const [sourceName, setSourceName] = useState(t("未命名.json"));
  const [tab, setTab] = useState<"tree" | "structure" | "problems" | "baseline">("tree");
  const [maskExport, setMaskExport] = useState(true);
  const [selectedBaseline, setSelectedBaseline] = useState("");
  const editorRef = useRef<CodeEditorInstance | null>(null);
  const workspaceIdRef = useRef(workspaceId);

  useMonacoFindShortcut(active, () => editorRef.current);

  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);

  useEffect(() => {
    if (snapshot?.kind === "format") { setText(snapshot.text); setFormat(snapshot.format); setSourceName(snapshot.sourceName || t("工作区报文")); }
  }, [snapshot]);

  const resolved = resolve(text, format);
  const parsed = useMemo(() => parseDocument(text, resolved), [text, resolved]);
  const structure = useMemo(() => parsed.valid && resolved !== "text" ? inferStructure(parsed.data) : [], [parsed, resolved]);
  const baseline = baselines.find((item) => item.id === selectedBaseline);
  const baselineChanges = useMemo(() => baseline ? compareEntries(structure, baseline.structure) : [], [baseline, structure]);

  const openFile = async () => {
    const [file] = await openTextFiles(false);
    if (!file) return;
    if (file.size > settings.maxLiveBytes) { notify(t(`文件为 ${formatBytes(file.size)}，超过实时编辑上限`), "error"); return; }
    setText(file.content); setSourceName(file.name); setFormat("auto"); onTitleChange?.(file.name);
    const detected = detectFormat(file.content);
    await addRecentFile({ name: file.name, size: file.size, path: file.path, format: detected });
    notify(t(`已打开 ${file.name}`));
  };
  const applyFormat = (minify: boolean) => {
    if (resolved === "text") { notify(t("纯文本无需格式化"), "info"); return; }
    const result = formatDocument(text, resolved, minify);
    if (!result.parsed.valid) { notify(result.parsed.issues[0]?.message ?? t("报文格式无效"), "error"); setTab("problems"); return; }
    setText(result.text); notify(minify ? t("已压缩报文") : t("已格式化报文"));
  };
  const applyEscapeTransform = (action: "escape" | "unescape" | "remove") => {
    const next = action === "escape" ? escapeText(text) : action === "unescape" ? unescapeText(text) : removeEscapes(text);
    if (next === text) {
      notify(action === "escape" ? t("当前内容无需添加转义") : action === "unescape" ? t("没有可反转义的内容") : t("没有可移除的转义层"), "info");
      return;
    }
    setText(next);
    notify(action === "escape" ? t("已添加一层 JSON 转义") : action === "unescape" ? t("已反转义控制符与 Unicode") : t("已移除一层引号、斜杠转义"));
  };  const copy = async () => { await navigator.clipboard.writeText(text); notify(t("已复制到剪贴板")); };
  const getExportContent = () => maskExport && resolved !== "text" ? maskDocumentText(text, resolved, maskRules) : text;
  const exportRaw = async () => {
    try {
      const content = getExportContent();
      const ext = resolved === "json" ? "json" : resolved === "xml" ? "xml" : "txt";
      await saveTextFile(`worktools-message.${ext}`, content); notify(maskExport ? t("已导出脱敏报文") : t("已导出原始报文"));
    } catch (error) { notify(error instanceof Error ? error.message : t("导出失败"), "error"); }
  };
  const exportTxt = async () => {
    try {
      await saveTextFile("worktools-message.txt", getExportContent());
      notify(t("已导出 TXT 文件"));
    } catch (error) { notify(error instanceof Error ? error.message : t("导出失败"), "error"); }
  };
  const exportHighlighted = async () => {
    try {
      const content = getExportContent();
      const report = generateDocumentHtmlExport({ title: sourceName + " - " + t("语法高亮"), fileName: sourceName, text: content, format: resolved });
      await saveTextFile("worktools-message-highlighted.html", report);
      notify(t("已导出高亮 HTML"));
    } catch (error) { notify(error instanceof Error ? error.message : t("导出失败"), "error"); }
  };
  const saveCurrentWorkspace = async () => {
    const saved = await saveWorkspaceTarget({
      workspaceId: workspaceIdRef.current,
      snapshot: { kind: "format", text, format, sourceName },
      sensitiveMode: maskExport,
      requestName: () => window.prompt(t("工作区名称"), sourceName.replace(/\.[^.]+$/, "")),
      createWorkspace: saveWorkspace,
      updateWorkspace,
    });
    if (!saved) return;
    workspaceIdRef.current = saved.id;
    onTitleChange?.(saved.name);
    onWorkspaceSaved?.(saved);
    notify(t("工作区已保存"));
  };
  useWorkspaceSaveShortcut(active, saveCurrentWorkspace);

  const createBaseline = async () => {
    if (!parsed.valid || resolved === "text") { notify(t("请先提供有效的 JSON 或 XML"), "error"); return; }
    const name = window.prompt(t("结构基线名称"), t(`${sourceName} 结构`));
    if (!name) return;
    const saved = await saveBaseline({ name, format: resolved, sourceName, structure }); setSelectedBaseline(saved.id); setTab("baseline"); notify(t("结构基线已保存"));
  };

  return <div className="tool-page"><div className="toolbar"><div className="toolbar-group"><Button size="small" onClick={openFile}><FileInput />{t("打开")}</Button><select className="select" value={format} onChange={(event) => setFormat(event.target.value as DocumentFormat)} aria-label={t("报文格式")}><option value="auto">{t("自动识别")}</option><option value="json">JSON / JSONC</option><option value="xml">XML</option><option value="text">{t("纯文本")}</option></select></div><div className="toolbar-separator"/><div className="toolbar-group"><Button size="small" variant="primary" onClick={() => applyFormat(false)}><Sparkles />{t("格式化")}</Button><Button size="small" onClick={() => applyFormat(true)}><Minimize2 />{t("压缩")}</Button><details className="toolbar-dropdown" onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.removeAttribute("open"); }}><summary className="btn btn-secondary btn-sm"><Braces />{t("转义")}<ChevronDown className="dropdown-chevron" /></summary><div className="toolbar-dropdown-menu" role="menu"><button role="menuitem" onClick={(event) => { applyEscapeTransform("escape"); event.currentTarget.closest("details")?.removeAttribute("open"); }}><Braces /><span><strong>{t("添加转义")}</strong><small>{t("添加一层 JSON 字符串转义")}</small></span></button><button role="menuitem" onClick={(event) => { applyEscapeTransform("unescape"); event.currentTarget.closest("details")?.removeAttribute("open"); }}><Undo2 /><span><strong>{t("反转义")}</strong><small>{t("还原控制符与 Unicode 字符")}</small></span></button><button role="menuitem" onClick={(event) => { applyEscapeTransform("remove"); event.currentTarget.closest("details")?.removeAttribute("open"); }}><Eraser /><span><strong>{t("移除转义")}</strong><small>{t("仅移除一层引号与斜杠转义")}</small></span></button></div></details><Button size="small" variant="ghost" onClick={copy}><Clipboard />{t("复制")}</Button></div><div className="toolbar-spacer"/><Badge tone={parsed.valid ? "success" : "danger"}>{parsed.valid ? t(`${resolved.toUpperCase()} 有效`) : t(`${parsed.issues.length} 个问题`)}</Badge><Button size="small" onClick={createBaseline}><FileCheck2 />{t("保存基线")}</Button><Button size="small" title={t("保存工作区（Ctrl+S）")} onClick={saveCurrentWorkspace}><Save />{t("保存工作区")}</Button><details className="toolbar-dropdown toolbar-dropdown-end" onKeyDown={(event) => { if (event.key === "Escape") event.currentTarget.removeAttribute("open"); }}><summary className="btn btn-secondary btn-sm"><Download />{t("导出报文")}<ChevronDown className="dropdown-chevron" /></summary><div className="toolbar-dropdown-menu" role="menu"><button role="menuitem" onClick={(event) => { void exportRaw(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><Download /><span><strong>{t("导出报文文件")}</strong><small>{t("保留 JSON/XML 原始文件格式")}</small></span></button><button role="menuitem" onClick={(event) => { void exportTxt(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><FileText /><span><strong>{t("导出 TXT 文件")}</strong><small>{t("以 .txt 保存当前报文内容")}</small></span></button><button role="menuitem" onClick={(event) => { void exportHighlighted(); event.currentTarget.closest("details")?.removeAttribute("open"); }}><FileCheck2 /><span><strong>{t("导出高亮 HTML")}</strong><small>{t("带语法颜色和行号，适合浏览器查看")}</small></span></button></div></details></div><div className="split-workspace format-layout"><section className="editor-panel"><PanelHeader title={sourceName} meta={t(`${formatBytes(new Blob([text]).size)} · ${text.split(/\r?\n/).length} 行`)} actions={<span className="privacy-inline"><ShieldCheck />{t("本地处理")}</span>} /><CodeEditor value={text} onChange={setText} format={resolved} theme={settings.theme} fontFamily={settings.editorFont} fontSize={settings.fontSize} wordWrap={settings.wordWrap} onEditorMount={(editor) => { editorRef.current = editor; }} label={t("报文编辑器")} /></section><aside className="inspector-panel"><div className="inspector-tabs"><button className={tab === "tree" ? "active" : ""} onClick={() => setTab("tree")}>{t("树形")}</button><button className={tab === "structure" ? "active" : ""} onClick={() => setTab("structure")}>{t("结构")}</button><button className={tab === "problems" ? "active" : ""} onClick={() => setTab("problems")}>{t("问题")} <span>{parsed.issues.length}</span></button><button className={tab === "baseline" ? "active" : ""} onClick={() => setTab("baseline")}>{t("基线")}</button></div><div className="inspector-content">{tab === "tree" && (parsed.valid && resolved !== "text" ? <DocumentTreeView value={parsed.data} /> : <EmptyState icon={<ListTree />} title={t("暂无结构")} description={t("输入有效的 JSON 或 XML 后自动生成结构。")} />)}{tab === "structure" && (structure.length ? <div className="structure-list">{structure.map((entry) => <div className="structure-row" key={`${entry.path}-${entry.type}`} style={{ paddingLeft: 12 + Math.min(entry.depth, 8) * 15 }}><ListTree /><code>{entry.name}</code><span>{entry.type}{entry.cardinality === "many" ? "[]" : ""}</span></div>)}</div> : <EmptyState icon={<ListTree />} title={t("暂无结构")} description={t("输入有效的 JSON 或 XML 后自动生成结构。")} />)}{tab === "problems" && (parsed.issues.length ? <div className="issue-list">{parsed.issues.map((item, index) => <div className={`issue-row issue-${item.severity}`} key={`${item.offset}-${index}`}><strong>{item.severity === "error" ? t("错误") : t("警告")}</strong><span>{t(item.message)}</span><small>{t("行")} {item.line}, {t("列")} {item.column}{item.path ? ` · ${item.path}` : ""}</small></div>)}</div> : <EmptyState icon={<FileCheck2 />} title={t("没有发现问题")} description={t("当前报文可以正常解析。")} />)}{tab === "baseline" && <div className="baseline-pane"><label className="form-field"><span>{t("选择结构基线")}</span><select className="select wide" value={selectedBaseline} onChange={(event) => setSelectedBaseline(event.target.value)}><option value="">{t("请选择")}</option>{baselines.filter((item) => item.format === resolved).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{baseline ? <><div className="summary-strip"><span>{t("基线字段")} {baseline.structure.length}</span><span>{t("当前字段")} {structure.length}</span><Badge tone={baselineChanges.length ? "warning" : "success"}>{baselineChanges.length ? t(`${baselineChanges.length} 处变化`) : t("结构一致")}</Badge></div><div className="issue-list">{baselineChanges.map((change) => <div className="issue-row issue-warning" key={change.path}><code>{change.path}</code><span>{t(change.message)}</span></div>)}</div></> : <EmptyState icon={<FileCheck2 />} title={t("选择一个基线")} description={t("保存供应商或接口的稳定结构，后续快速识别字段变化。")} />}</div>}</div><div className="inspector-footer"><Toggle checked={maskExport} onChange={setMaskExport} label={t("导出时脱敏")} description={t("使用设置中的脱敏规则，不修改编辑器内容")} /></div></aside></div></div>;
}
