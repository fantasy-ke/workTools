import { findNodeAtLocation, parse, parseTree, type Node as JsonNode } from "jsonc-parser";
import type { DiffChange, DiffChangeKind, ResolvedFormat } from "../types";

export interface EditorHighlight {
  id: string;
  kind: DiffChangeKind;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  wholeLine: boolean;
  message: string;
}

interface SelectorSegment {
  key?: string;
  value?: string;
  wildcard?: boolean;
}

type PathSegment = string | number | SelectorSegment;
type HighlightRange = Pick<EditorHighlight, "startLineNumber" | "startColumn" | "endLineNumber" | "endColumn" | "wholeLine">;

function parseDiffPath(path: string): PathSegment[] | undefined {
  if (!path.startsWith("$")) return undefined;
  const segments: PathSegment[] = [];
  let index = 1;

  while (index < path.length) {
    if (path[index] === ".") {
      const start = ++index;
      while (index < path.length && path[index] !== "." && path[index] !== "[") index += 1;
      if (index === start) return undefined;
      segments.push(path.slice(start, index));
      continue;
    }
    if (path[index] === "[") {
      const end = path.indexOf("]", index);
      if (end < 0) return undefined;
      const content = path.slice(index + 1, end);
      if (/^\d+$/.test(content)) segments.push(Number(content));
      else if (content === "*") segments.push({ wildcard: true });
      else {
        const separator = content.indexOf("=");
        if (separator < 1) return undefined;
        segments.push({ key: content.slice(0, separator), value: content.slice(separator + 1) });
      }
      index = end + 1;
      continue;
    }
    return undefined;
  }

  return segments;
}

function rangeFromOffset(text: string, offset: number, length: number, wholeLine = false): HighlightRange {
  const positionAt = (target: number) => {
    const before = text.slice(0, Math.max(0, target));
    const lines = before.split(/\r?\n/);
    return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
  };
  const start = positionAt(offset);
  const end = positionAt(offset + Math.max(1, length));
  return {
    startLineNumber: start.line,
    startColumn: wholeLine ? 1 : start.column,
    endLineNumber: end.line,
    endColumn: wholeLine ? 1 : end.column,
    wholeLine,
  };
}

function concreteJsonPath(text: string, segments: PathSegment[]): Array<string | number> | undefined {
  const errors: Array<{ error: number; offset: number; length: number }> = [];
  let current = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length) return undefined;
  const concrete: Array<string | number> = [];

  for (const segment of segments) {
    if (typeof segment === "string" || typeof segment === "number") {
      concrete.push(segment);
      current = current?.[segment];
      continue;
    }
    if (!Array.isArray(current)) return undefined;
    const itemIndex = segment.wildcard
      ? 0
      : current.findIndex((item) => item && typeof item === "object" && String(item[segment.key ?? ""]) === segment.value);
    if (itemIndex < 0) return undefined;
    concrete.push(itemIndex);
    current = current[itemIndex];
  }

  return concrete;
}

function locateJson(text: string, path: string, includeProperty: boolean): HighlightRange | undefined {
  const segments = parseDiffPath(path);
  if (!segments) return undefined;
  const concrete = concreteJsonPath(text, segments);
  if (!concrete) return undefined;
  const root = parseTree(text, [], { allowTrailingComma: true, disallowComments: false });
  if (!root) return undefined;
  const found = findNodeAtLocation(root, concrete);
  if (!found) return undefined;
  const target: JsonNode = includeProperty && found.parent?.type === "property" ? found.parent : found;
  return rangeFromOffset(text, target.offset, target.length);
}

function nthMatch(pattern: RegExp, text: string, occurrence: number): RegExpExecArray | undefined {
  let current = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (current === occurrence) return match;
    current += 1;
  }
  return undefined;
}

function locateXml(text: string, path: string): HighlightRange | undefined {
  const segments = parseDiffPath(path);
  if (!segments) return undefined;
  const strings = segments.filter((segment): segment is string => typeof segment === "string");
  const numeric = [...segments].reverse().find((segment): segment is number => typeof segment === "number");
  const occurrence = numeric ?? 0;
  const final = strings.at(-1);
  const tag = [...strings].reverse().find((segment) => !segment.startsWith("@") && !segment.startsWith("#"));
  if (!final || !tag) return undefined;
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (final.startsWith("@")) {
    const attribute = final.slice(1).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tagMatch = nthMatch(new RegExp(`<${escapedTag}\\b[^>]*>`, "gi"), text, occurrence);
    if (!tagMatch) return undefined;
    const attributeMatch = new RegExp(`\\b${attribute}\\s*=\\s*(["'])[^"']*\\1`, "i").exec(tagMatch[0]);
    if (!attributeMatch) return rangeFromOffset(text, tagMatch.index, tagMatch[0].length);
    return rangeFromOffset(text, tagMatch.index + attributeMatch.index, attributeMatch[0].length);
  }

  if (final === "#text") {
    const elementMatch = nthMatch(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}\\s*>`, "gi"), text, occurrence);
    if (!elementMatch) return undefined;
    const rawValue = elementMatch[1] ?? "";
    const leadingWhitespace = rawValue.length - rawValue.trimStart().length;
    const value = rawValue.trim();
    if (!value) return rangeFromOffset(text, elementMatch.index, elementMatch[0].length);
    const valueOffset = elementMatch.index + elementMatch[0].indexOf(rawValue) + leadingWhitespace;
    return rangeFromOffset(text, valueOffset, value.length);
  }

  const tagMatch = nthMatch(new RegExp(`<${escapedTag}\\b[^>]*>`, "gi"), text, occurrence);
  return tagMatch ? rangeFromOffset(text, tagMatch.index, tagMatch[0].length) : undefined;
}

function locateTextLine(text: string, path: string): HighlightRange | undefined {
  const match = /^\u884c\s+(\d+)$/.exec(path);
  if (!match) return undefined;
  const line = Number(match[1]);
  const lines = text.split(/\r?\n/);
  if (line < 1 || line > lines.length) return undefined;
  return {
    startLineNumber: line,
    startColumn: 1,
    endLineNumber: line,
    endColumn: Math.max(1, lines[line - 1].length + 1),
    wholeLine: true,
  };
}

function locate(text: string, format: ResolvedFormat, change: DiffChange): HighlightRange | undefined {
  if (/^\u884c\s+\d+$/.test(change.path)) return locateTextLine(text, change.path);
  if (format === "json") return locateJson(text, change.path, change.kind === "added" || change.kind === "removed");
  if (format === "xml") return locateXml(text, change.path);
  return undefined;
}

export function buildDiffHighlights(
  leftText: string,
  rightText: string,
  format: ResolvedFormat,
  changes: DiffChange[],
): { left: EditorHighlight[]; right: EditorHighlight[] } {
  const left: EditorHighlight[] = [];
  const right: EditorHighlight[] = [];

  for (const change of changes) {
    if (change.kind !== "added") {
      const range = locate(leftText, format, change);
      if (range) left.push({ id: `${change.id}-left`, kind: change.kind, message: change.message, ...range });
    }
    if (change.kind !== "removed") {
      const range = locate(rightText, format, change);
      if (range) right.push({ id: `${change.id}-right`, kind: change.kind, message: change.message, ...range });
    }
  }

  return { left, right };
}