import type { DiffChangeKind, DiffOptions, DiffResult, MaskRule, ResolvedFormat } from "../types";
import { buildDiffHighlights, type EditorHighlight } from "./diffHighlights";
import { maskDocumentText } from "./masking";

export type DiffExportFormat = "html" | "markdown" | "csv" | "json";

export interface DiffExportInput {
  title: string;
  leftName: string;
  rightName: string;
  leftText: string;
  rightText: string;
  result: DiffResult;
  options: DiffOptions;
  maskRules?: MaskRule[];
  maskEnabled?: boolean;
}

export interface DocumentHtmlExportInput {
  title: string;
  fileName: string;
  text: string;
  format: ResolvedFormat;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}

function syntaxSpan(className: string, value: string): string {
  return '<span class="syntax-' + className + '">' + escapeHtml(value) + '</span>';
}

function highlightJsonLine(line: string): string {
  const tokenPattern = /"(?:\\.|[^"\\])*"|\/\/.*$|\/\*.*?\*\/|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b/g;
  let cursor = 0;
  let output = "";

  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    const token = match[0];
    output += escapeHtml(line.slice(cursor, index));
    if (token.startsWith('"')) {
      const isKey = /^\s*:/.test(line.slice(index + token.length));
      output += syntaxSpan(isKey ? "key" : "string", token);
    } else if (token.startsWith("/")) {
      output += syntaxSpan("comment", token);
    } else if (/^(?:true|false|null)$/.test(token)) {
      output += syntaxSpan("keyword", token);
    } else {
      output += syntaxSpan("number", token);
    }
    cursor = index + token.length;
  }

  return output + escapeHtml(line.slice(cursor));
}

function highlightXmlTag(tag: string): string {
  if (tag.startsWith("<!--")) return syntaxSpan("comment", tag);
  if (tag.startsWith("<![CDATA[")) return syntaxSpan("cdata", tag);
  if (tag.startsWith("<!")) return syntaxSpan("metatag", tag);

  const parts = tag.match(/^(<\/?|<\?)([\w:.-]+)([\s\S]*?)(\/?>|\?>)$/);
  if (!parts) return escapeHtml(tag);

  const [, open, name, attributes, close] = parts;
  const attributePattern = /([\w:.-]+)(\s*=\s*)("[^"]*"|'[^']*')/g;
  let cursor = 0;
  let highlightedAttributes = "";
  for (const match of attributes.matchAll(attributePattern)) {
    const index = match.index ?? 0;
    highlightedAttributes += escapeHtml(attributes.slice(cursor, index));
    highlightedAttributes += syntaxSpan("attribute", match[1]);
    highlightedAttributes += syntaxSpan("delimiter", match[2]);
    highlightedAttributes += syntaxSpan("string", match[3]);
    cursor = index + match[0].length;
  }
  highlightedAttributes += escapeHtml(attributes.slice(cursor));

  return syntaxSpan("delimiter", open) + syntaxSpan("tag", name) + highlightedAttributes + syntaxSpan("delimiter", close);
}

function highlightXmlLine(line: string): string {
  const tokenPattern = /<!--.*?(?:-->|$)|<!\[CDATA\[.*?(?:\]\]>|$)|<\?[^>]*\?>|<![^>]*>|<\/?[\w:.-]+(?:\s+[^<>]*?)?\/?>|&(?:#\d+|#x[\da-fA-F]+|[\w:.-]+);/g;
  let cursor = 0;
  let output = "";

  for (const match of line.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    const token = match[0];
    output += escapeHtml(line.slice(cursor, index));
    output += token.startsWith("<") ? highlightXmlTag(token) : syntaxSpan("entity", token);
    cursor = index + token.length;
  }

  return output + escapeHtml(line.slice(cursor));
}

export function highlightSyntaxLine(line: string, format: ResolvedFormat): string {
  if (format === "json") return highlightJsonLine(line);
  if (format === "xml") return highlightXmlLine(line);
  return escapeHtml(line);
}

const syntaxHighlightStyles = ".syntax-key,.syntax-tag{color:#0550ae;font-weight:650}.syntax-string{color:#087443}.syntax-number{color:#9a3412}.syntax-keyword,.syntax-metatag{color:#7c3aed}.syntax-attribute{color:#a1490a}.syntax-delimiter{color:#64748b}.syntax-comment{color:#6b7280;font-style:italic}.syntax-cdata{color:#0f766e}.syntax-entity{color:#b45309}";


function display(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function csvCell(value: unknown): string {
  return `"${display(value).replace(/"/g, '""')}"`;
}

function exportPayload(input: DiffExportInput): { left: string; right: string } {
  if (!input.maskEnabled || !input.maskRules?.length) return { left: input.leftText, right: input.rightText };
  const format: ResolvedFormat = input.result.format;
  return {
    left: maskDocumentText(input.leftText, format, input.maskRules),
    right: maskDocumentText(input.rightText, format, input.maskRules),
  };
}

const highlightPriority: Record<DiffChangeKind, number> = {
  removed: 5,
  added: 4,
  "type-changed": 3,
  changed: 2,
  moved: 1,
  warning: 0,
};

function highlightAtLine(highlights: EditorHighlight[], lineNumber: number): EditorHighlight | undefined {
  return highlights
    .filter((highlight) => highlight.startLineNumber <= lineNumber && highlight.endLineNumber >= lineNumber)
    .sort((left, right) => highlightPriority[right.kind] - highlightPriority[left.kind])[0];
}

function rangeLabel(highlight: EditorHighlight | undefined): string {
  if (!highlight) return "";
  const start = `${highlight.startLineNumber}:${highlight.startColumn}`;
  const end = `${highlight.endLineNumber}:${highlight.endColumn}`;
  return start === end ? start : `${start}-${end}`;
}

function changeRange(highlights: EditorHighlight[], changeId: string, side: "left" | "right"): string {
  return rangeLabel(highlights.find((highlight) => highlight.id === `${changeId}-${side}`));
}

function renderHighlightedHtml(text: string, highlights: EditorHighlight[], format: ResolvedFormat): string {
  return text.split(/\r?\n/).map((line, index) => {
    const lineNumber = index + 1;
    const highlight = highlightAtLine(highlights, lineNumber);
    const className = highlight ? ` highlight-${highlight.kind}` : "";
    const title = highlight ? ` title="${escapeHtml(highlight.message)}"` : "";
    return `<span class="code-line${className}"${title}><span class="line-no">${lineNumber}</span><span class="line-text">${highlightSyntaxLine(line, format) || "&nbsp;"}</span></span>`;
  }).join("");
}

function renderHighlightedMarkdown(text: string, highlights: EditorHighlight[], side: "left" | "right"): string {
  return text.split(/\r?\n/).map((line, index) => {
    const highlight = highlightAtLine(highlights, index + 1);
    const marker = highlight ? (side === "left" ? "-" : "+") : " ";
    return `${marker}${String(index + 1).padStart(4, " ")} | ${line}`;
  }).join("\n");
}

export function generateDocumentHtmlExport(input: DocumentHtmlExportInput): string {
  const generatedAt = new Date().toISOString();
  const code = input.text.split(/\r?\n/).map((line, index) => '<span class="code-line"><span class="line-no">' + (index + 1) + '</span><span class="line-text">' + (highlightSyntaxLine(line, input.format) || '&nbsp;') + '</span></span>').join("");

  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + escapeHtml(input.title) + '</title><style>' +
    'body{margin:0;background:#f5f7fb;color:#172033;font:14px/1.55 Inter,Segoe UI,sans-serif}.page{max-width:1180px;margin:0 auto;padding:32px}.hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:16px}.hero h1{margin:0 0 5px;font-size:24px}.meta{color:#64748b;font-size:12px}.card{overflow:hidden;border:1px solid #dfe5ed;border-radius:14px;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.06)}.code-block{display:block;max-height:78vh;overflow:auto;margin:0;padding:10px 0;background:#fbfcfe;font:13px/1.62 Cascadia Code,Consolas,monospace;white-space:pre}.code-line{display:grid;grid-template-columns:58px minmax(max-content,1fr);min-height:21px}.line-no{padding:0 13px 0 6px;color:#9aa6b2;text-align:right;user-select:none;background:#f4f7fa}.line-text{padding:0 14px}' + syntaxHighlightStyles +
    '@media(max-width:720px){.page{padding:12px}.hero{align-items:flex-start;flex-direction:column}.code-line{grid-template-columns:46px minmax(max-content,1fr)}}</style></head><body><main class="page"><header class="hero"><div><h1>' + escapeHtml(input.title) + '</h1><div class="meta">' + escapeHtml(input.fileName) + ' \u00b7 ' + escapeHtml(input.format.toUpperCase()) + '</div></div><div class="meta">\u751f\u6210\u65f6\u95f4\uff1a' + escapeHtml(generatedAt) + '</div></header><section class="card"><pre class="code-block">' + code + '</pre></section></main></body></html>';
}

export function generateDiffExport(input: DiffExportInput, format: DiffExportFormat): string {
  const payload = exportPayload(input);
  const highlights = buildDiffHighlights(payload.left, payload.right, input.result.format, input.result.changes);
  const generatedAt = new Date().toISOString();

  if (format === "json") {
    return JSON.stringify({
      title: input.title,
      generatedAt,
      leftName: input.leftName,
      rightName: input.rightName,
      payload,
      highlights,
      result: input.result,
      options: input.options,
    }, null, 2);
  }

  if (format === "csv") {
    const rows = [
      ["类型", "路径", "说明", "左值", "右值", "左侧位置", "右侧位置"].map(csvCell).join(","),
      ...input.result.changes.map((change) => [
        change.kind,
        change.path,
        change.message,
        change.leftValue,
        change.rightValue,
        changeRange(highlights.left, change.id, "left"),
        changeRange(highlights.right, change.id, "right"),
      ].map(csvCell).join(",")),
    ];
    return `\uFEFF${rows.join("\r\n")}`;
  }

  if (format === "markdown") {
    const rows = input.result.changes.map((change) => `| ${change.kind} | \`${change.path.replace(/\|/g, "\\|")}\` | ${change.message.replace(/\|/g, "\\|")} | ${display(change.leftValue).replace(/\|/g, "\\|").replace(/\n/g, "<br>")} | ${display(change.rightValue).replace(/\|/g, "\\|").replace(/\n/g, "<br>")} |`);
    const leftHighlighted = renderHighlightedMarkdown(payload.left, highlights.left, "left");
    const rightHighlighted = renderHighlightedMarkdown(payload.right, highlights.right, "right");
    return `# ${input.title}\n\n- 生成时间：${generatedAt}\n- 左侧：${input.leftName}\n- 右侧：${input.rightName}\n- 格式：${input.result.format}\n- 模式：${input.result.mode}\n- 差异数：${input.result.changes.length}${input.result.truncated ? "（已截断）" : ""}\n\n| 类型 | 路径 | 说明 | 左值 | 右值 |\n|---|---|---|---|---|\n${rows.join("\n") || "| - | - | 无差异 | - | - |"}\n\n## 高亮对比\n\n> 行首 \`-\` 表示左侧差异，\`+\` 表示右侧差异；数字为原报文行号。\n\n### ${input.leftName}${input.maskEnabled ? "（已脱敏）" : ""}\n\n\`\`\`diff\n${leftHighlighted}\n\`\`\`\n\n### ${input.rightName}${input.maskEnabled ? "（已脱敏）" : ""}\n\n\`\`\`diff\n${rightHighlighted}\n\`\`\`\n`;
  }

  const rows = input.result.changes.map((change) => `<tr><td><span class="kind kind-${escapeHtml(change.kind)}">${escapeHtml(change.kind)}</span></td><td><code>${escapeHtml(change.path)}</code></td><td>${escapeHtml(change.message)}</td><td><pre>${escapeHtml(display(change.leftValue))}</pre></td><td><pre>${escapeHtml(display(change.rightValue))}</pre></td></tr>`).join("");
  const leftHighlighted = renderHighlightedHtml(payload.left, highlights.left, input.result.format);
  const rightHighlighted = renderHighlightedHtml(payload.right, highlights.right, input.result.format);

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.title)}</title><style>
body{margin:0;background:#f5f7fb;color:#172033;font:14px/1.5 Inter,Segoe UI,sans-serif}.page{max-width:1380px;margin:0 auto;padding:32px}.hero{background:linear-gradient(135deg,#172033,#254a68);color:#fff;border-radius:16px;padding:24px;margin-bottom:20px}.hero h1{margin:0 0 10px}.meta{display:flex;gap:18px;flex-wrap:wrap;opacity:.85}.card{background:#fff;border:1px solid #dfe5ed;border-radius:12px;margin-top:16px;overflow:hidden}.card h2{font-size:16px;margin:0;padding:16px;border-bottom:1px solid #e8edf3}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #edf1f5}th{background:#f8fafc}code,pre{font-family:Cascadia Code,Consolas,monospace}td pre{white-space:pre-wrap;word-break:break-word;margin:0;max-width:420px}.kind{padding:2px 7px;border-radius:99px;background:#e9eff5}.kind-added{background:#dcfce7;color:#166534}.kind-removed{background:#fee2e2;color:#991b1b}.kind-changed,.kind-type-changed{background:#fef3c7;color:#92400e}.kind-moved{background:#dbeafe;color:#1d4ed8}.legend{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:11px 16px;border-bottom:1px solid #e8edf3;background:#fbfcfe;color:#526074}.legend span{display:inline-flex;align-items:center;gap:6px}.legend i{width:9px;height:9px;border-radius:3px}.legend .added i{background:#22c55e}.legend .removed i{background:#ef4444}.legend .changed i{background:#f59e0b}.legend .moved i{background:#3b82f6}.payload{display:grid;grid-template-columns:1fr 1fr}.payload section{min-width:0}.payload section+section{border-left:1px solid #e8edf3}.payload h3{margin:0;padding:12px 16px;border-bottom:1px solid #edf1f5;font-size:13px}.code-block{display:block;max-width:none;max-height:650px;overflow:auto;margin:0;padding:10px 0;background:#fbfcfe;white-space:pre}.code-line{display:grid;grid-template-columns:52px minmax(max-content,1fr);min-height:21px;border-left:3px solid transparent}.line-no{padding:1px 12px 1px 6px;color:#9aa6b2;text-align:right;user-select:none;background:#f4f7fa}.line-text{padding:1px 12px}.highlight-added{background:#dcfce7;border-left-color:#22c55e}.highlight-removed{background:#fee2e2;border-left-color:#ef4444}.highlight-changed,.highlight-type-changed{background:#fef3c7;border-left-color:#f59e0b}.highlight-moved{background:#dbeafe;border-left-color:#3b82f6}.highlight-warning{background:#f1f5f9;border-left-color:#64748b}.highlight-added .line-no{background:#ccf6d9}.highlight-removed .line-no{background:#fbd5d5}.highlight-changed .line-no,.highlight-type-changed .line-no{background:#fce9a9}.highlight-moved .line-no{background:#cfe3fb}${syntaxHighlightStyles}@media(max-width:760px){.page{padding:12px}.payload{grid-template-columns:1fr}.payload section+section{border-left:0;border-top:1px solid #e8edf3}}
</style></head><body><main class="page"><section class="hero"><h1>${escapeHtml(input.title)}</h1><div class="meta"><span>${escapeHtml(input.leftName)} ↔ ${escapeHtml(input.rightName)}</span><span>${escapeHtml(input.result.format)} / ${escapeHtml(input.result.mode)}</span><span>${input.result.changes.length} 处差异${input.result.truncated ? "（已截断）" : ""}</span><span>${escapeHtml(generatedAt)}</span></div></section><section class="card"><h2>差异明细</h2><table><thead><tr><th>类型</th><th>路径</th><th>说明</th><th>左值</th><th>右值</th></tr></thead><tbody>${rows || '<tr><td colspan="5">无差异</td></tr>'}</tbody></table></section><section class="card"><h2>高亮报文${input.maskEnabled ? "（已脱敏）" : ""}</h2><div class="legend"><span class="added"><i></i>新增</span><span class="removed"><i></i>删除</span><span class="changed"><i></i>修改 / 类型变化</span><span class="moved"><i></i>移动</span></div><div class="payload"><section><h3>${escapeHtml(input.leftName)}</h3><pre class="code-block">${leftHighlighted}</pre></section><section><h3>${escapeHtml(input.rightName)}</h3><pre class="code-block">${rightHighlighted}</pre></section></div></section></main></body></html>`;
}