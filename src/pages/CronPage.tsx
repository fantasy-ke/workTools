import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, Clipboard, Clock3, RotateCcw, Save, WandSparkles } from "lucide-react";
import type { CronDialect, CronFieldModel, WorkspaceSnapshot } from "../types";
import { Badge, Button, EmptyState, Field } from "../components/ui";
import { useToast } from "../components/Toast";
import { useAppStore } from "../store/appStore";
import { analyzeCron, buildCronExpression, CRON_PRESETS, defaultCronExpression } from "../core/cron";
import { useWorkspaceSaveShortcut } from "../hooks/useWorkspaceSaveShortcut";
import { translate as t } from "../i18n";

const TIMEZONES = ["Asia/Shanghai", "UTC", "Asia/Tokyo", "Europe/London", "America/New_York", "America/Los_Angeles"];
function createFieldHelp(): Record<keyof CronFieldModel, string> {
  return {
    second: "0-59", minute: "0-59", hour: "0-23", dayOfMonth: "1-31, ?, L, W", month: t("1-12 或 JAN-DEC"), dayOfWeek: t("0-7 或 SUN-SAT, ?, L, #"), year: t("可选，如 2026 或 *"),
  };
}

export function CronPage({ snapshot, active = false }: { snapshot?: WorkspaceSnapshot; active?: boolean }) {
  const fieldHelp = createFieldHelp();
  const saveWorkspace = useAppStore((state) => state.saveWorkspace);
  const language = useAppStore((state) => state.settings.language);
  const { notify } = useToast();
  const [dialect, setDialect] = useState<CronDialect>("unix");
  const [expression, setExpression] = useState("*/5 * * * *");
  const [timezone, setTimezone] = useState("Asia/Shanghai");

  useEffect(() => {
    if (snapshot?.kind === "cron") { setDialect(snapshot.dialect); setExpression(snapshot.expression); setTimezone(snapshot.timezone); }
  }, [snapshot]);
  const analysis = useMemo(() => analyzeCron(expression, dialect, timezone, 10), [expression, dialect, timezone]);
  const switchDialect = (next: CronDialect) => { setDialect(next); setExpression(defaultCronExpression(next)); };
  const updateField = (key: keyof CronFieldModel, value: string) => {
    if (!analysis.model) return;
    setExpression(buildCronExpression({ ...analysis.model, [key]: value || "*" }, dialect));
  };
  const saveCurrent = async () => { const name = window.prompt(t("工作区名称"), `Cron ${expression}`); if (!name) return; await saveWorkspace(name, { kind: "cron", dialect, expression, timezone }); notify(t("Cron 工作区已保存")); };
  useWorkspaceSaveShortcut(active, saveCurrent);
  const formatRun = (date: Date) => new Intl.DateTimeFormat(language, { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);

  return <div className="tool-page cron-page"><div className="cron-top"><div className="dialect-tabs">{(["unix", "spring", "quartz"] as const).map((item) => <button key={item} className={dialect === item ? "active" : ""} onClick={() => switchDialect(item)}>{item === "unix" ? "Unix / Linux" : item === "spring" ? "Spring" : "Quartz"}<small>{item === "unix" ? t("5 字段") : item === "spring" ? t("6 字段") : t("6 / 7 字段")}</small></button>)}</div><div className="cron-expression-block"><span className="eyebrow">{t("表达式")}</span><div className={`cron-input-wrap ${analysis.valid ? "valid" : "invalid"}`}><input value={expression} onChange={(event) => setExpression(event.target.value)} spellCheck={false} aria-label={t("Cron 表达式")}/><span>{analysis.valid ? <CheckCircle2 /> : "!"}</span></div><div className="cron-actions"><select className="select" value={timezone} onChange={(event) => setTimezone(event.target.value)}>{TIMEZONES.map((item) => <option key={item}>{item}</option>)}</select><select className="select" value="" onChange={(event) => { if (event.target.value) setExpression(event.target.value); }}><option value="">{t("常用预设")}</option>{CRON_PRESETS[dialect].map((preset) => <option key={preset.expression} value={preset.expression}>{t(preset.label)} · {preset.expression}</option>)}</select><Button size="small" onClick={async () => { await navigator.clipboard.writeText(expression); notify(t("表达式已复制")); }}><Clipboard />{t("复制")}</Button><Button size="small" onClick={() => setExpression(defaultCronExpression(dialect))}><RotateCcw />{t("重置")}</Button><Button size="small" title={t("保存工作区（Ctrl+S）")} onClick={saveCurrent}><Save />{t("保存工作区")}</Button></div></div></div><div className="cron-grid"><section className="cron-builder"><div className="section-heading compact"><div><span className="eyebrow">{t("生成器")}</span><h2>{t("字段构造")}</h2></div><WandSparkles /></div>{analysis.model ? <div className="cron-fields">{(dialect === "unix" ? ["minute", "hour", "dayOfMonth", "month", "dayOfWeek"] : dialect === "spring" ? ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek"] : ["second", "minute", "hour", "dayOfMonth", "month", "dayOfWeek", "year"]).map((key) => { const typed = key as keyof CronFieldModel; return <Field key={key} label={t(({ second: "秒", minute: "分", hour: "时", dayOfMonth: "日", month: "月", dayOfWeek: "周", year: "年" } as const)[typed])} hint={fieldHelp[typed]}><input className="cron-field-input" value={analysis.model?.[typed] ?? ""} onChange={(event) => updateField(typed, event.target.value)} spellCheck={false} /></Field>; })}</div> : <div className="cron-error-card"><strong>{t("暂时无法构造字段")}</strong><p>{analysis.error ? t(analysis.error) : ""}</p><span>{t("请先修正字段数量，生成器会自动恢复。")}</span></div>}<div className="syntax-card"><h3>{t("常用语法")}</h3><div className="syntax-grid"><span><code>*</code> {t("任意值")}</span><span><code>,</code> {t("多个值")}</span><span><code>-</code> {t("范围")}</span><span><code>/</code> {t("步长")}</span>{dialect === "quartz" && <><span><code>?</code> {t("不指定")}</span><span><code>L</code> {t("最后")}</span><span><code>W</code> {t("最近工作日")}</span><span><code>#</code> {t("第 N 个星期")}</span></>}</div></div></section><section className="cron-analysis"><div className="analysis-card primary"><span className="eyebrow">{t("中文复原")}</span>{analysis.valid ? <><h2>{t(analysis.description)}</h2><div className="field-chip-row">{analysis.fieldDescriptions.map((field) => <span key={field.label}><small>{t(field.label)}</small><code>{field.value}</code></span>)}</div></> : <div className="cron-invalid"><strong>{t("表达式无效")}</strong><p>{analysis.error}</p></div>}</div>{analysis.warnings.length > 0 && <div className="warning-banner">{analysis.warnings.map(t).join(t("；"))}</div>}<div className="analysis-card runs"><div className="section-heading compact"><div><span className="eyebrow">{t("时间预览")}</span><h2>{t("接下来 10 次运行")}</h2></div><Badge tone="accent">{timezone}</Badge></div>{analysis.nextRuns.length ? <ol className="run-list">{analysis.nextRuns.map((date, index) => <li key={date.toISOString()}><span>{String(index + 1).padStart(2, "0")}</span><Clock3 /><strong>{formatRun(date)}</strong><small>{date.toISOString()}</small></li>)}</ol> : <EmptyState icon={<CalendarClock />} title={t("暂无运行预览")} description={analysis.valid ? t("该特殊语法目前仅提供字段解释。") : t("修正表达式后即可查看运行时间。")} />}</div></section></div></div>;
}