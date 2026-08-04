import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Download, FileInput, Filter, GitCompareArrows, Play, Save, Settings2, ShieldCheck, X } from "lucide-react";
import type { DiffChangeKind, DiffOptions, DiffResult, DocumentFormat, WorkspaceRecord, WorkspaceSnapshot } from "../types";
import { CodeEditor, type CodeEditorInstance } from "../components/CodeEditor";
import { Badge, Button, EmptyState, Field, PanelHeader, Toggle } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAppStore } from "../store/appStore";
import { compareDocuments, DEFAULT_DIFF_OPTIONS } from "../core/diff";
import { buildDiffHighlights } from "../core/diffHighlights";
import { generateDiffExport, type DiffExportFormat as ExportFormat } from "../core/export";
import { detectFormat } from "../core/document";
import { openTextFiles, saveTextFile } from "../platform/files";
import { formatBytes } from "../utils";
import { useMonacoFindShortcut } from "../hooks/useMonacoFindShortcut";
import { saveWorkspaceTarget, useWorkspaceSaveShortcut } from "../hooks/useWorkspaceSaveShortcut";
import { translate as t } from "../i18n";

const LEFT_SAMPLE = `{
  "orderId": "A-10001",
  "status": "pending",
  "guest": { "name": "Zhang San", "phone": "13800138000" },
  "rooms": [
    { "id": "DLX", "count": 1, "price": 688 }
  ],
  "token": "left-sensitive-token"
}`;
const RIGHT_SAMPLE = `{
  "orderId": "A-10001",
  "status": "confirmed",
  "guest": { "name": "Zhang San", "phone": "13800138000", "email": "guest@example.com" },
  "rooms": [
    { "id": "DLX", "count": 2, "price": 688 }
  ],
  "token": "right-sensitive-token"
}`;

type FilterKind = "all" | DiffChangeKind;

export function DiffPage({ snapshot, workspaceId, active = false, onTitleChange, onWorkspaceSaved }: { snapshot?: WorkspaceSnapshot; workspaceId?: string; active?: boolean; onTitleChange?: (name: string) => void; onWorkspaceSaved?: (workspace: WorkspaceRecord) => void }) {
  const settings = useAppStore((state) => state.settings);
  const ruleTemplates = useAppStore((state) => state.ruleTemplates);
  const maskRules = useAppStore((state) => state.maskRules);
  const saveRuleTemplate = useAppStore((state) => state.saveRuleTemplate);
  const saveWorkspace = useAppStore((state) => state.saveWorkspace);
  const updateWorkspace = useAppStore((state) => state.updateWorkspace);
  const addRecentFile = useAppStore((state) => state.addRecentFile);
  const { notify } = useToast();
  const [leftText, setLeftText] = useState(LEFT_SAMPLE);
  const [rightText, setRightText] = useState(RIGHT_SAMPLE);
  const [leftName, setLeftName] = useState("before.json");
  const [rightName, setRightName] = useState("after.json");
  const [format, setFormat] = useState<DocumentFormat>("auto");
  const [options, setOptions] = useState<DiffOptions>({ ...DEFAULT_DIFF_OPTIONS, ...settings.defaultDiffOptions });
  const [result, setResult] = useState<DiffResult>(() => compareDocuments(LEFT_SAMPLE, RIGHT_SAMPLE, "auto", settings.defaultDiffOptions));
  const [showOptions, setShowOptions] = useState(false);
  const [maskExport, setMaskExport] = useState(true);
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<FilterKind>("all");
  const leftEditorRef = useRef<CodeEditorInstance | null>(null);
  const rightEditorRef = useRef<CodeEditorInstance | null>(null);
  const focusedSideRef = useRef<"left" | "right">("left");
  const workspaceIdRef = useRef(workspaceId);

  useEffect(() => { workspaceIdRef.current = workspaceId; }, [workspaceId]);

  useMonacoFindShortcut(active, () => {
    const focusedEditor = focusedSideRef.current === "left" ? leftEditorRef.current : rightEditorRef.current;
    return focusedEditor ?? leftEditorRef.current ?? rightEditorRef.current;
  });

  useEffect(() => {
    if (snapshot?.kind === "diff") {
      setLeftText(snapshot.leftText); setRightText(snapshot.rightText); setFormat(snapshot.format); setOptions(snapshot.options);
      setResult(compareDocuments(snapshot.leftText, snapshot.rightText, snapshot.format, snapshot.options));
      setLeftName(snapshot.leftName || t("工作区 - 左侧")); setRightName(snapshot.rightName || t("工作区 - 右侧"));
    }
  }, [snapshot]);

  const resolvedFormat = format === "auto" ? (detectFormat(leftText) === detectFormat(rightText) ? detectFormat(leftText) : "text") : format;
  const filtered = useMemo(() => result.changes.filter((change) => (kind === "all" || change.kind === kind) && (!filter || `${change.path} ${change.message}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))), [result, filter, kind]);
  const counts = useMemo(() => result.changes.reduce<Record<string, number>>((map, item) => ({ ...map, [item.kind]: (map[item.kind] ?? 0) + 1 }), {}), [result]);
  const highlights = useMemo(() => buildDiffHighlights(leftText, rightText, resolvedFormat, filtered), [leftText, rightText, resolvedFormat, filtered]);

  const compare = () => { const next = compareDocuments(leftText, rightText, format, options); setResult(next); notify(next.changes.length ? t(`发现 ${next.changes.length} 处差异`) : t("两侧内容一致"), next.changes.length ? "info" : "success"); };
  const openSide = async (side: "left" | "right") => {
    const [file] = await openTextFiles(false); if (!file) return;
    if (file.size > settings.maxLiveBytes) { notify(t(`文件为 ${formatBytes(file.size)}，超过实时对比上限`), "error"); return; }
    const nextLeftName = side === "left" ? file.name : leftName; const nextRightName = side === "right" ? file.name : rightName;
    if (side === "left") { setLeftText(file.content); setLeftName(file.name); } else { setRightText(file.content); setRightName(file.name); }
    onTitleChange?.(`${nextLeftName} vs ${nextRightName}`);
    await addRecentFile({ name: file.name, size: file.size, path: file.path, format: detectFormat(file.content) });
  };
  const exportResult = async (exportFormat: ExportFormat) => {
    try {
      const content = generateDiffExport({ title: t(`${leftName} 与 ${rightName} 对比报告`), leftName, rightName, leftText, rightText, result, options, maskRules, maskEnabled: maskExport }, exportFormat);
      const extension = exportFormat === "markdown" ? "md" : exportFormat;
      await saveTextFile(`worktools-diff.${extension}`, content); notify(t(`已导出 ${extension.toUpperCase()} 对比结果`));
    } catch (error) { notify(error instanceof Error ? error.message : t("导出失败"), "error"); }
  };
  const saveRules = async () => { const name = window.prompt(t("规则模板名称"), t("供应商报文对比规则")); if (!name) return; await saveRuleTemplate(name, options); notify(t("规则模板已保存")); };
  const saveCurrentWorkspace = async () => {
    const saved = await saveWorkspaceTarget({
      workspaceId: workspaceIdRef.current,
      snapshot: { kind: "diff", leftText, rightText, format, options, leftName, rightName },
      sensitiveMode: maskExport,
      requestName: () => window.prompt(t("工作区名称"), `${leftName} vs ${rightName}`),
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
  const updateOption = <K extends keyof DiffOptions>(key: K, value: DiffOptions[K]) => setOptions((current) => ({ ...current, [key]: value }));

  return <div className="tool-page diff-page"><div className="toolbar"><div className="toolbar-group"><Button size="small" onClick={() => openSide("left")}><FileInput />{t("左侧文件")}</Button><Button size="small" onClick={() => openSide("right")}><FileInput />{t("右侧文件")}</Button><Button size="small" variant="ghost" onClick={() => { setLeftText(rightText); setRightText(leftText); setLeftName(rightName); setRightName(leftName); }}><ArrowLeftRight />{t("交换")}</Button></div><div className="toolbar-separator"/><div className="toolbar-group"><select className="select" value={format} onChange={(event) => setFormat(event.target.value as DocumentFormat)}><option value="auto">{t("自动识别")}</option><option value="json">JSON / JSONC</option><option value="xml">XML</option><option value="text">{t("纯文本")}</option></select><select className="select" value={options.mode} onChange={(event) => updateOption("mode", event.target.value as DiffOptions["mode"])}><option value="semantic">{t("语义对比")}</option><option value="structure">{t("结构对比")}</option><option value="text">{t("文本对比")}</option></select><Button size="small" variant="primary" onClick={compare}><Play />{t("开始对比")}</Button></div><div className="toolbar-spacer"/><select className="select template-select" defaultValue="" onChange={(event) => { const template = ruleTemplates.find((item) => item.id === event.target.value); if (template) { setOptions(template.options); notify(t(`已加载规则：${template.name}`)); } event.target.value = ""; }}><option value="">{t("加载规则模板")}</option>{ruleTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button size="small" onClick={saveRules}><Save />{t("保存规则")}</Button><Button size="small" title={t("保存工作区（Ctrl+S）")} onClick={saveCurrentWorkspace}><Save />{t("保存工作区")}</Button><Button size="small" onClick={() => setShowOptions(true)}><Settings2 />{t("高级选项")}</Button></div><div className="diff-editor-grid"><section className="editor-panel"><PanelHeader title={leftName} meta={t(`${formatBytes(new Blob([leftText]).size)} · 左侧`)} actions={<Badge tone={result.leftValid ? "success" : "danger"}>{result.leftValid ? t("可解析") : t("解析失败")}</Badge>} /><CodeEditor value={leftText} onChange={setLeftText} format={resolvedFormat} theme={settings.theme} fontFamily={settings.editorFont} fontSize={settings.fontSize} wordWrap={settings.wordWrap} onEditorMount={(editor) => { leftEditorRef.current = editor; }} onEditorFocus={() => { focusedSideRef.current = "left"; }} label={t("左侧报文")} highlights={highlights.left} /></section><section className="editor-panel"><PanelHeader title={rightName} meta={t(`${formatBytes(new Blob([rightText]).size)} · 右侧`)} actions={<Badge tone={result.rightValid ? "success" : "danger"}>{result.rightValid ? t("可解析") : t("解析失败")}</Badge>} /><CodeEditor value={rightText} onChange={setRightText} format={resolvedFormat} theme={settings.theme} fontFamily={settings.editorFont} fontSize={settings.fontSize} wordWrap={settings.wordWrap} onEditorMount={(editor) => { rightEditorRef.current = editor; }} onEditorFocus={() => { focusedSideRef.current = "right"; }} label={t("右侧报文")} highlights={highlights.right} /></section></div><section className="result-drawer"><div className="result-header"><div className="result-summary"><GitCompareArrows /><strong>{result.changes.length ? t(`${result.changes.length} 处差异`) : t("内容一致")}</strong><Badge tone="success">{t("新增")} {counts.added ?? 0}</Badge><Badge tone="danger">{t("删除")} {counts.removed ?? 0}</Badge><Badge tone="warning">{t("变化")} {(counts.changed ?? 0) + (counts["type-changed"] ?? 0)}</Badge><span>{result.durationMs.toFixed(1)} ms{result.truncated ? t(" · 已截断") : ""}</span></div><div className="result-actions"><div className="filter-input"><Filter /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t("筛选路径")} /></div><select className="select" value={kind} onChange={(event) => setKind(event.target.value as FilterKind)}><option value="all">{t("全部类型")}</option><option value="added">{t("新增")}</option><option value="removed">{t("删除")}</option><option value="changed">{t("值变化")}</option><option value="type-changed">{t("类型变化")}</option></select><Toggle checked={maskExport} onChange={setMaskExport} label={t("脱敏")} /><div className="export-group"><Button size="small" onClick={() => exportResult("html")}><Download />HTML</Button><Button size="small" onClick={() => exportResult("markdown")}>MD</Button><Button size="small" onClick={() => exportResult("csv")}>CSV</Button><Button size="small" onClick={() => exportResult("json")}>JSON</Button></div></div></div>{result.warnings.length > 0 && <div className="warning-banner">{result.warnings.map(t).join(t("；"))}</div>}<div className="change-table"><div className="change-table-head"><span>{t("类型")}</span><span>{t("路径")}</span><span>{t("说明")}</span><span>{t("左值")}</span><span>{t("右值")}</span></div>{filtered.length ? filtered.map((change) => <div className={`change-row change-${change.kind}`} key={change.id}><span><Badge tone={change.kind === "added" ? "success" : change.kind === "removed" ? "danger" : "warning"}>{change.kind}</Badge></span><code title={change.path}>{change.path}</code><span>{t(change.message)}</span><pre>{change.leftValue === undefined ? "—" : typeof change.leftValue === "string" ? change.leftValue : JSON.stringify(change.leftValue)}</pre><pre>{change.rightValue === undefined ? "—" : typeof change.rightValue === "string" ? change.rightValue : JSON.stringify(change.rightValue)}</pre></div>) : <EmptyState icon={<GitCompareArrows />} title={result.changes.length ? t("没有匹配的差异") : t("两侧内容一致")} description={result.changes.length ? t("调整筛选条件查看其他差异。") : t("当前模式和规则下未发现差异。")} />}</div></section>{showOptions && <aside className="options-drawer"><header><div><span className="eyebrow">{t("对比策略")}</span><h2>{t("高级选项")}</h2></div><button className="icon-btn" onClick={() => setShowOptions(false)}><X /></button></header><div className="options-body"><Field label={t("数组处理")}><select className="select wide" value={options.arrayMode} onChange={(event) => updateOption("arrayMode", event.target.value as DiffOptions["arrayMode"])}><option value="sequence">{t("按顺序")}</option><option value="unordered">{t("忽略顺序")}</option><option value="match-by-key">{t("按关键字段匹配")}</option></select></Field>{options.arrayMode === "match-by-key" && <Field label={t("数组关键字段")} hint={t("例如 id、code、roomId")}><input className="field-input wide" value={options.arrayKey} onChange={(event) => updateOption("arrayKey", event.target.value)} /></Field>}<Toggle checked={options.ignoreWhitespace} onChange={(value) => updateOption("ignoreWhitespace", value)} label={t("忽略空白差异")} /><Toggle checked={options.ignoreCase} onChange={(value) => updateOption("ignoreCase", value)} label={t("忽略大小写")} /><Toggle checked={options.strictTypes} onChange={(value) => updateOption("strictTypes", value)} label={t("严格比较类型")} description={t("关闭后，数字 1 与字符串 1 可视为相同")} /><Toggle checked={options.missingEqualsNull} onChange={(value) => updateOption("missingEqualsNull", value)} label={t("缺失字段等同 null")} /><Field label={t("忽略路径")} hint={t("每行一个 JSON Path，支持 * 和 [*]")}><textarea className="field-textarea" value={options.ignorePaths.join("\n")} onChange={(event) => updateOption("ignorePaths", event.target.value.split(/\r?\n/).filter(Boolean))} placeholder={'$.timestamp\n$.items[*].traceId'} /></Field><Field label={t("仅比较路径")} hint={t("留空表示全部路径")}><textarea className="field-textarea" value={options.includePaths.join("\n")} onChange={(event) => updateOption("includePaths", event.target.value.split(/\r?\n/).filter(Boolean))} placeholder="$.data" /></Field><Field label={t("最大差异数")}><input className="field-input wide" type="number" min="100" max="20000" value={options.maxChanges} onChange={(event) => updateOption("maxChanges", Math.max(100, Math.min(20000, Number(event.target.value))))} /></Field><div className="local-note"><ShieldCheck /><span>{t("对比和报告生成均在当前设备完成。")}</span></div></div><footer><Button onClick={() => setOptions({ ...DEFAULT_DIFF_OPTIONS })}>{t("恢复默认")}</Button><Button variant="primary" onClick={() => { setShowOptions(false); compare(); }}>{t("应用并对比")}</Button></footer></aside>}</div>;
}
