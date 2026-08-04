import type { EditorHighlight } from "./diffHighlights";

export type ConfigPathSeparator = ":" | ".";

export interface ApolloParseResult {
  data: Record<string, unknown>;
  entryCount: number;
  detectedSeparator: ConfigPathSeparator;
}

export interface DelimiterPreset {
  id: "comma-to-pipe" | "pipe-to-comma" | "semicolon-to-newline" | "newline-to-comma" | "tab-to-comma" | "underscore-to-hyphen";
  from: string;
  to: string;
}

export const delimiterPresets: DelimiterPreset[] = [
  { id: "comma-to-pipe", from: ",", to: "|" },
  { id: "pipe-to-comma", from: "|", to: "," },
  { id: "semicolon-to-newline", from: ";", to: "\n" },
  { id: "newline-to-comma", from: "\n", to: "," },
  { id: "tab-to-comma", from: "\t", to: "," },
  { id: "underscore-to-hyphen", from: "_", to: "-" },
];

interface Assignment {
  key: string;
  value: string;
}

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function isLineBreak(character: string) {
  return character === "\n" || character === "\r";
}

function skipWhitespaceAndComments(text: string, start: number) {
  let index = start;
  while (index < text.length) {
    while (index < text.length && /\s|;/.test(text[index])) index += 1;
    if (text[index] === "#" || (text[index] === "/" && text[index + 1] === "/")) {
      while (index < text.length && !isLineBreak(text[index])) index += 1;
      continue;
    }
    break;
  }
  return index;
}

function assignmentStartAt(text: string, start: number) {
  const match = /^[^\s=;]+\s*=/.exec(text.slice(start));
  return match?.[0].length;
}

function readEqualsAssignments(text: string): Assignment[] {
  const assignments: Assignment[] = [];
  let cursor = skipWhitespaceAndComments(text, 0);

  while (cursor < text.length) {
    const keyMatch = /^[^\s=;]+/.exec(text.slice(cursor));
    if (!keyMatch) throw new Error("无法识别 Apollo 配置键");
    const key = keyMatch[0].trim();
    cursor += keyMatch[0].length;
    while (cursor < text.length && /[ \t]/.test(text[cursor])) cursor += 1;
    if (text[cursor] !== "=") throw new Error(`配置项 ${key} 缺少等号`);
    cursor += 1;
    while (cursor < text.length && /[ \t]/.test(text[cursor])) cursor += 1;

    const valueStart = cursor;
    let quote = "";
    let escaped = false;
    let depth = 0;

    while (cursor < text.length) {
      const character = text[cursor];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = "";
        cursor += 1;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        cursor += 1;
        continue;
      }
      if (character === "{" || character === "[") depth += 1;
      else if ((character === "}" || character === "]") && depth > 0) depth -= 1;

      if (depth === 0 && isLineBreak(character)) break;
      if (depth === 0 && character === ";") {
        const next = skipWhitespaceAndComments(text, cursor + 1);
        if (assignmentStartAt(text, next)) break;
      }
      if (depth === 0 && /[ \t]/.test(character)) {
        let next = cursor;
        while (next < text.length && /[ \t]/.test(text[next])) next += 1;
        if (assignmentStartAt(text, next)) break;
      }
      cursor += 1;
    }

    assignments.push({ key, value: text.slice(valueStart, cursor).trim() });
    cursor = skipWhitespaceAndComments(text, cursor);
  }

  return assignments;
}

function readColonAssignments(text: string): Assignment[] {
  return text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return [];
    const match = /^([^:]+?)\s*:\s+(.+)$/.exec(trimmed);
    if (!match) throw new Error(`无法识别配置行：${trimmed}`);
    return [{ key: match[1].trim(), value: match[2].trim() }];
  });
}

function parseValue(source: string): unknown {
  const value = source.trim();
  if (!value) return "";
  if (value.startsWith('"') && value.endsWith('"')) {
    try { return JSON.parse(value); } catch { throw new Error(`字符串值格式无效：${value}`); }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)) {
    const number = Number(value);
    if (Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number))) return number;
  }
  if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith("{") && value.endsWith("}"))) {
    try { return JSON.parse(value); } catch { /* 普通字符串继续按原值处理。 */ }
  }
  return value;
}

function splitPath(key: string): { segments: string[]; separator: ConfigPathSeparator } {
  const separator: ConfigPathSeparator = key.includes(":") ? ":" : ".";
  const segments = key.split(separator).map((segment) => segment.trim());
  if (segments.some((segment) => !segment)) throw new Error(`配置键路径无效：${key}`);
  if (segments.some((segment) => FORBIDDEN_SEGMENTS.has(segment))) throw new Error(`配置键包含不安全路径：${key}`);
  return { segments, separator };
}

function assignPath(target: Record<string, unknown>, key: string, value: unknown) {
  const { segments } = splitPath(key);
  let current = target;

  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (last) {
      if (Object.prototype.hasOwnProperty.call(current, segment)) throw new Error(`配置键重复：${key}`);
      current[segment] = value;
      return;
    }

    const existing = current[segment];
    if (existing === undefined) {
      const child: Record<string, unknown> = {};
      current[segment] = child;
      current = child;
      return;
    }
    if (!existing || typeof existing !== "object" || Array.isArray(existing)) throw new Error(`配置路径发生冲突：${key}`);
    current = existing as Record<string, unknown>;
  });
}

export function parseApolloConfig(text: string): ApolloParseResult {
  if (!text.trim()) throw new Error("请输入 Apollo 配置");
  const firstEntry = skipWhitespaceAndComments(text, 0);
  const assignments = assignmentStartAt(text, firstEntry) ? readEqualsAssignments(text) : readColonAssignments(text);
  if (!assignments.length) throw new Error("未找到可转换的配置项");

  const data: Record<string, unknown> = {};
  let colonCount = 0;
  let dotCount = 0;
  assignments.forEach(({ key, value }) => {
    const path = splitPath(key);
    if (path.separator === ":" && key.includes(":")) colonCount += 1;
    if (path.separator === "." && key.includes(".")) dotCount += 1;
    assignPath(data, key, parseValue(value));
  });

  return {
    data,
    entryCount: assignments.length,
    detectedSeparator: colonCount >= dotCount ? ":" : ".",
  };
}

export function apolloToJson(text: string) {
  const parsed = parseApolloConfig(text);
  return { ...parsed, text: JSON.stringify(parsed.data, null, 2) };
}

function flattenJson(value: unknown, path: string[], separator: ConfigPathSeparator, output: Assignment[]) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length && path.length) output.push({ key: path.join(separator), value: "{}" });
    entries.forEach(([key, child]) => {
      if (FORBIDDEN_SEGMENTS.has(key)) throw new Error(`JSON 包含不安全路径：${key}`);
      if (key.includes(":") || key.includes(".")) throw new Error(`JSON 字段名包含层级分隔符：${key}`);
      flattenJson(child, [...path, key], separator, output);
    });
    return;
  }
  if (!path.length) throw new Error("JSON 根节点必须是对象");
  output.push({ key: path.join(separator), value: serializeApolloValue(value) });
}

function serializeApolloValue(value: unknown) {
  if (typeof value === "string") {
    let structured = false;
    if (value.startsWith("{") || value.startsWith("[")) {
      try { structured = typeof JSON.parse(value) === "object"; } catch { /* 普通字符串无需额外处理。 */ }
    }
    if (!value || /^\s|\s$/.test(value) || /[\r\n]|\s+=|^["']|["']$|^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(value) || structured) return JSON.stringify(value);
    return value;
  }
  if (value === null || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function jsonToApollo(text: string, separator: ConfigPathSeparator = ":") {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("JSON 格式无效"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON 根节点必须是对象");
  const assignments: Assignment[] = [];
  flattenJson(value, [], separator, assignments);
  return { text: assignments.map(({ key, value: item }) => `${key} = ${item}`).join("\n"), entryCount: assignments.length };
}

export function decodeDelimiterToken(value: string) {
  if (value === "\\n" || value.toLocaleLowerCase() === "newline") return "\n";
  if (value === "\\t" || value.toLocaleLowerCase() === "tab") return "\t";
  if (value.toLocaleLowerCase() === "space") return " ";
  return value;
}

export function replaceDelimiter(text: string, from: string, to: string) {
  const source = decodeDelimiterToken(from);
  const target = decodeDelimiterToken(to);
  if (!source) throw new Error("来源符号不能为空");
  const count = text.split(source).length - 1;
  return { text: text.split(source).join(target), count, source, target };
}

function positionAt(text: string, offset: number) {
  const lines = text.slice(0, offset).split(/\r?\n/);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function createDelimiterHighlights(text: string, token: string, message: string, kind: "changed" | "added" = "changed"): EditorHighlight[] {
  if (!token) return [];
  const highlights: EditorHighlight[] = [];
  let offset = text.indexOf(token);
  let index = 0;
  while (offset >= 0) {
    const start = positionAt(text, offset);
    const end = positionAt(text, offset + token.length);
    highlights.push({
      id: `delimiter-${kind}-${index}`,
      kind,
      startLineNumber: start.line,
      startColumn: token === "\n" ? 1 : start.column,
      endLineNumber: end.line,
      endColumn: end.column,
      wholeLine: token === "\n",
      message,
    });
    index += 1;
    offset = text.indexOf(token, offset + token.length);
  }
  return highlights;
}
