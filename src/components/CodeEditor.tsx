import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { ResolvedFormat, ThemeMode } from "../types";
import type { EditorHighlight } from "../core/diffHighlights";
import "../monaco";
import { translate as t } from "../i18n";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  format?: ResolvedFormat;
  theme: ThemeMode;
  fontFamily: string;
  fontSize: number;
  wordWrap: boolean;
  readOnly?: boolean;
  label: string;
  highlights?: EditorHighlight[];
}

function visualKind(kind: EditorHighlight["kind"]): "added" | "removed" | "changed" | "moved" {
  if (kind === "added" || kind === "removed" || kind === "moved") return kind;
  return "changed";
}

export function CodeEditor({
  value,
  onChange,
  format = "text",
  theme,
  fontFamily,
  fontSize,
  wordWrap,
  readOnly = false,
  label,
  highlights = [],
}: CodeEditorProps) {
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationIdsRef = useRef<string[]>([]);

  const applyHighlights = useCallback((instance: MonacoEditor.IStandaloneCodeEditor) => {
    const decorations: MonacoEditor.IModelDeltaDecoration[] = highlights.map((highlight) => {
      const kind = visualKind(highlight.kind);
      return {
        range: {
          startLineNumber: highlight.startLineNumber,
          startColumn: highlight.startColumn,
          endLineNumber: highlight.endLineNumber,
          endColumn: highlight.endColumn,
        },
        options: {
          isWholeLine: highlight.wholeLine,
          className: highlight.wholeLine ? `worktools-diff-${kind}-line` : undefined,
          inlineClassName: highlight.wholeLine ? undefined : `worktools-diff-${kind}-inline`,
          hoverMessage: { value: `${highlight.message} (${highlight.kind})` },
        },
      };
    });
    decorationIdsRef.current = instance.deltaDecorations(decorationIdsRef.current, decorations);
  }, [highlights]);

  const handleMount: OnMount = (instance) => {
    editorRef.current = instance;
    applyHighlights(instance);
  };

  useEffect(() => {
    if (editorRef.current) applyHighlights(editorRef.current);
  }, [applyHighlights]);

  useEffect(() => () => {
    editorRef.current = null;
    decorationIdsRef.current = [];
  }, []);

  return (
    <div className="code-editor" role="region" aria-label={label}>
      <Editor
        value={value}
        language={format === "xml" ? "xml" : format === "json" ? "json" : "plaintext"}
        theme={(theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) ? "worktools-dark" : "worktools-light"}
        onMount={handleMount}
        onChange={(next) => onChange?.(next ?? "")}
        loading={<div className="editor-loading">{t("正在加载本地编辑器…")}</div>}
        options={{
          readOnly,
          automaticLayout: true,
          minimap: { enabled: false },
          fontFamily,
          fontSize,
          lineHeight: Math.round(fontSize * 1.55),
          wordWrap: wordWrap ? "on" : "off",
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          renderLineHighlight: "line",
          bracketPairColorization: { enabled: true },
          folding: true,
          glyphMargin: false,
          padding: { top: 12, bottom: 12 },
          fixedOverflowWidgets: true,
        }}
      />
    </div>
  );
}