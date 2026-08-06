import { useMemo, useRef, useState } from "react";
import { ArrowLeftRight, Braces, CheckCircle2, Clipboard, Eraser, FileCog, Play, ReplaceAll, RotateCcw } from "lucide-react";
import { CodeEditor, type CodeEditorInstance } from "../components/CodeEditor";
import { useToast } from "../components/Toast";
import { Badge, Button, PanelHeader } from "../components/ui";
import {
  apolloToJson,
  createDelimiterHighlights,
  decodeDelimiterToken,
  delimiterPresets,
  jsonToApollo,
  replaceDelimiter,
  type ConfigPathSeparator,
} from "../core/configProcessing";
import { useMonacoFindShortcut } from "../hooks/useMonacoFindShortcut";
import { translate as t } from "../i18n";
import { useAppStore } from "../store/appStore";

const APOLLO_SAMPLE = "CITHotelSell:PushOrderWorkStatusUrl = https://b2b-manage-api-test.huitravel.com/v1/workorder/UpdateHopWorkOrderNotify CITHotelSell:PushOrderWorkReplayUrl = https://b2b-manage-api-test.huitravel.com/v1/workorder/HopWorkOrderReplayNotify CITHotelSell:PushOrderWorkReplayDeleteUrl = https://b2b-manage-api-test.huitravel.com/v1/workorder/DeleteHopWorkOrderReplayNotify CITHotelSell:UseNewOrderWorkPushSign = 1";
const JSON_SAMPLE = `{
  "CITHotelSell": {
    "PushOrderWorkStatusUrl": "https://b2b-manage-api-test.huitravel.com/v1/workorder/UpdateHopWorkOrderNotify",
    "PushOrderWorkReplayUrl": "https://b2b-manage-api-test.huitravel.com/v1/workorder/HopWorkOrderReplayNotify",
    "PushOrderWorkReplayDeleteUrl": "https://b2b-manage-api-test.huitravel.com/v1/workorder/DeleteHopWorkOrderReplayNotify",
    "UseNewOrderWorkPushSign": 1
  }
}`;
const DELIMITER_SAMPLE = "250_0,268_0,354_0,432_0,370_0,371_0";

type ConfigMode = "apollo" | "delimiter";
type ConvertDirection = "apollo-to-json" | "json-to-apollo";
type DelimiterPresetId = (typeof delimiterPresets)[number]["id"] | "custom";

const presetLabels: Record<Exclude<DelimiterPresetId, "custom">, string> = {
  "comma-to-pipe": "逗号 , → 竖线 |",
  "pipe-to-comma": "竖线 | → 逗号 ,",
  "semicolon-to-newline": "分号 ; → 换行",
  "newline-to-comma": "换行 → 逗号 ,",
  "tab-to-comma": "制表符 → 逗号 ,",
  "underscore-to-hyphen": "下划线 _ → 短横线 -",
};

function visibleToken(value: string) {
  if (value === "\n") return t("换行");
  if (value === "\t") return t("制表符");
  if (value === " ") return t("空格");
  return value;
}

export function ConfigPage({ active = false }: { active?: boolean }) {
  const settings = useAppStore((state) => state.settings);
  const { notify } = useToast();
  const [mode, setMode] = useState<ConfigMode>("apollo");
  const [direction, setDirection] = useState<ConvertDirection>("json-to-apollo");
  const [pathSeparator, setPathSeparator] = useState<ConfigPathSeparator>(":");
  const [apolloInput, setApolloInput] = useState(JSON_SAMPLE);
  const [apolloOutput, setApolloOutput] = useState(APOLLO_SAMPLE);
  const [delimiterInput, setDelimiterInput] = useState(DELIMITER_SAMPLE);
  const [delimiterOutput, setDelimiterOutput] = useState(DELIMITER_SAMPLE.replaceAll(",", "|"));
  const [presetId, setPresetId] = useState<DelimiterPresetId>("comma-to-pipe");
  const [fromToken, setFromToken] = useState(",");
  const [toToken, setToToken] = useState("|");
  const inputEditorRef = useRef<CodeEditorInstance | null>(null);
  const outputEditorRef = useRef<CodeEditorInstance | null>(null);
  const focusedSideRef = useRef<"input" | "output">("input");

  useMonacoFindShortcut(active, () => {
    const focused = focusedSideRef.current === "input" ? inputEditorRef.current : outputEditorRef.current;
    return focused ?? inputEditorRef.current ?? outputEditorRef.current;
  });

  const sourceDelimiter = decodeDelimiterToken(fromToken);
  const targetDelimiter = decodeDelimiterToken(toToken);
  const delimiterMatchCount = sourceDelimiter ? delimiterInput.split(sourceDelimiter).length - 1 : 0;
  const inputHighlights = useMemo(
    () => mode === "delimiter" ? createDelimiterHighlights(delimiterInput, sourceDelimiter, t("待替换符号"), "changed") : [],
    [delimiterInput, mode, sourceDelimiter],
  );
  const outputHighlights = useMemo(
    () => mode === "delimiter" ? createDelimiterHighlights(delimiterOutput, targetDelimiter, t("替换后符号"), "added") : [],
    [delimiterOutput, mode, targetDelimiter],
  );

  const runApolloConversion = () => {
    try {
      if (direction === "apollo-to-json") {
        const result = apolloToJson(apolloInput);
        setApolloOutput(result.text);
        setPathSeparator(result.detectedSeparator);
        notify(t(`已转换 ${result.entryCount} 个配置项`), "success");
      } else {
        const result = jsonToApollo(apolloInput, pathSeparator);
        setApolloOutput(result.text);
        notify(t(`已转换 ${result.entryCount} 个配置项`), "success");
      }
    } catch (error) {
      notify(t(error instanceof Error ? error.message : "配置转换失败"), "error");
    }
  };

  const runDelimiterReplacement = () => {
    try {
      const result = replaceDelimiter(delimiterInput, fromToken, toToken);
      setDelimiterOutput(result.text);
      notify(result.count ? t(`已替换 ${result.count} 处符号`) : t("没有找到待替换符号"), result.count ? "success" : "info");
    } catch (error) {
      notify(t(error instanceof Error ? error.message : "分隔符替换失败"), "error");
    }
  };

  const selectPreset = (id: DelimiterPresetId) => {
    setPresetId(id);
    if (id === "custom") return;
    const preset = delimiterPresets.find((item) => item.id === id);
    if (!preset) return;
    setFromToken(preset.from === "\n" ? "\\n" : preset.from === "\t" ? "\\t" : preset.from);
    setToToken(preset.to === "\n" ? "\\n" : preset.to === "\t" ? "\\t" : preset.to);
  };

  const swapContent = () => {
    if (mode === "apollo") {
      setDirection((current) => current === "apollo-to-json" ? "json-to-apollo" : "apollo-to-json");
      setApolloInput(apolloOutput);
      setApolloOutput(apolloInput);
    } else {
      setDelimiterInput(delimiterOutput);
      setDelimiterOutput(delimiterInput);
      setFromToken(toToken);
      setToToken(fromToken);
      setPresetId("custom");
    }
  };

  const clearContent = () => {
    if (mode === "apollo") { setApolloInput(""); setApolloOutput(""); }
    else { setDelimiterInput(""); setDelimiterOutput(""); }
  };

  const copyResult = async () => {
    const value = mode === "apollo" ? apolloOutput : delimiterOutput;
    await navigator.clipboard.writeText(value);
    notify(t("结果已复制"), "success");
  };

  const inputValue = mode === "apollo" ? apolloInput : delimiterInput;
  const outputValue = mode === "apollo" ? apolloOutput : delimiterOutput;
  const inputFormat = mode === "apollo" && direction === "json-to-apollo" ? "json" : "text";
  const outputFormat = mode === "apollo" && direction === "apollo-to-json" ? "json" : "text";

  return (
    <div className="tool-page config-page">
      <div className="toolbar config-toolbar">
        <div className="seg-control config-mode-switch" aria-label={t("处理模式")}>
          <button className={mode === "apollo" ? "active" : ""} onClick={() => setMode("apollo")}><Braces />{t("Apollo ↔ JSON")}</button>
          <button className={mode === "delimiter" ? "active" : ""} onClick={() => setMode("delimiter")}><ReplaceAll />{t("分隔符替换")}</button>
        </div>
        <div className="toolbar-separator" />
        {mode === "apollo" ? (
          <>
            <select className="select" value={direction} onChange={(event) => setDirection(event.target.value as ConvertDirection)} aria-label={t("转换方向")}>
              <option value="apollo-to-json">Apollo → JSON</option>
              <option value="json-to-apollo">JSON → Apollo</option>
            </select>
            {direction === "json-to-apollo" && (
              <select className="select" value={pathSeparator} onChange={(event) => setPathSeparator(event.target.value as ConfigPathSeparator)} aria-label={t("层级分隔符")}>
                <option value=":">{t("冒号层级")} (:)</option>
                <option value=".">{t("点号层级")} (.)</option>
              </select>
            )}
            <Button size="small" variant="primary" onClick={runApolloConversion}><Play />{t("转换")}</Button>
          </>
        ) : (
          <>
            <select className="select delimiter-preset" value={presetId} onChange={(event) => selectPreset(event.target.value as DelimiterPresetId)} aria-label={t("分隔符预设")}>
              {delimiterPresets.map((preset) => <option key={preset.id} value={preset.id}>{t(presetLabels[preset.id])}</option>)}
              <option value="custom">{t("自定义符号")}</option>
            </select>
            <label className="delimiter-token-field"><span>{t("从")}</span><input className="field-input" value={fromToken} onChange={(event) => { setFromToken(event.target.value); setPresetId("custom"); }} aria-label={t("来源符号")} /></label>
            <label className="delimiter-token-field"><span>{t("到")}</span><input className="field-input" value={toToken} onChange={(event) => { setToToken(event.target.value); setPresetId("custom"); }} aria-label={t("目标符号")} /></label>
            <Button size="small" variant="primary" onClick={runDelimiterReplacement}><Play />{t("全部替换")}</Button>
          </>
        )}
        <div className="toolbar-spacer" />
        <Button size="small" variant="ghost" onClick={swapContent}><ArrowLeftRight />{t("交换")}</Button>
        <Button size="small" onClick={copyResult} disabled={!outputValue}><Clipboard />{t("复制结果")}</Button>
        <Button size="small" variant="ghost" onClick={clearContent}><Eraser />{t("清空")}</Button>
      </div>

      <div className="config-status">
        <span><FileCog />{mode === "apollo" ? t("Apollo 配置与嵌套 JSON 双向转换") : t("按固定或自定义符号执行全文替换")}</span>
        {mode === "apollo" ? (
          <span>{t("支持等号、逐行和连续粘贴格式")}</span>
        ) : (
          <><Badge tone={delimiterMatchCount ? "accent" : "muted"}>{delimiterMatchCount} {t("处匹配")}</Badge><code>{visibleToken(sourceDelimiter)} → {visibleToken(targetDelimiter)}</code><span>{t("自定义可输入 \\n、\\t 或 space")}</span></>
        )}
      </div>

      <div className="config-editor-grid">
        <section className="editor-panel">
          <PanelHeader title={mode === "apollo" ? (direction === "apollo-to-json" ? t("Apollo 输入") : t("JSON 输入")) : t("待处理文本")} meta={t("输入")} actions={<Badge tone="accent">Ctrl+F</Badge>} />
          <CodeEditor value={inputValue} onChange={mode === "apollo" ? setApolloInput : setDelimiterInput} format={inputFormat} theme={settings.theme} fontFamily={settings.editorFont} fontSize={settings.fontSize} wordWrap={settings.wordWrap} label={t("配置处理输入")} highlights={inputHighlights} onEditorMount={(editor) => { inputEditorRef.current = editor; }} onEditorFocus={() => { focusedSideRef.current = "input"; }} />
        </section>
        <section className="editor-panel">
          <PanelHeader title={mode === "apollo" ? (direction === "apollo-to-json" ? t("JSON 结果") : t("Apollo 结果")) : t("替换结果")} meta={t("结果")} actions={outputValue ? <Badge tone="success"><CheckCircle2 />{t("已生成")}</Badge> : undefined} />
          <CodeEditor value={outputValue} onChange={mode === "apollo" ? setApolloOutput : setDelimiterOutput} format={outputFormat} theme={settings.theme} fontFamily={settings.editorFont} fontSize={settings.fontSize} wordWrap={settings.wordWrap} label={t("配置处理结果")} highlights={outputHighlights} onEditorMount={(editor) => { outputEditorRef.current = editor; }} onEditorFocus={() => { focusedSideRef.current = "output"; }} />
        </section>
      </div>

      <div className="config-footer-note"><RotateCcw />{t("交换会同时切换转换方向；所有内容仅在本地处理。")}</div>
    </div>
  );
}
