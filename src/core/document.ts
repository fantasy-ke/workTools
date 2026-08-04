import {
  applyEdits,
  format as formatJsonEdits,
  type Node as JsonNode,
  parse,
  parseTree,
  ParseError,
  printParseErrorCode,
} from "jsonc-parser";
import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser";
import type {
  ParsedDocument,
  ResolvedFormat,
  StructureEntry,
  ValidationIssue,
} from "../types";

const XML_SECURITY_PATTERN = /<!DOCTYPE|<!ENTITY/i;
const MAX_XML_DEPTH = 256;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  commentPropName: "#comment",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  allowBooleanAttributes: true,
  processEntities: false,
});

const xmlOrderedParser = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  commentPropName: "#comment",
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  allowBooleanAttributes: true,
  processEntities: false,
});

function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, offset));
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function issue(
  text: string,
  severity: ValidationIssue["severity"],
  message: string,
  offset = 0,
  length = 1,
  path?: string,
): ValidationIssue {
  return { severity, message, offset, length, ...lineColumnAt(text, offset), path };
}

export function detectFormat(text: string): ResolvedFormat {
  const trimmed = text.trimStart();
  if (!trimmed) return "text";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  if (trimmed.startsWith("<")) return "xml";
  return "text";
}

function collectDuplicateKeys(text: string, root?: JsonNode): ValidationIssue[] {
  if (!root) return [];
  const result: ValidationIssue[] = [];

  const walk = (node: JsonNode, path: Array<string | number>) => {
    if (node.type === "object") {
      const seen = new Map<string, JsonNode>();
      for (const property of node.children ?? []) {
        const keyNode = property.children?.[0];
        const valueNode = property.children?.[1];
        const key = String(keyNode?.value ?? "");
        if (keyNode && seen.has(key)) {
          const duplicatePath = [...path, key].reduce<string>((acc, part) =>
            typeof part === "number" ? `${acc}[${part}]` : `${acc}.${part}`, "$",
          );
          result.push(issue(text, "warning", `检测到重复 Key「${key}」，语义结果可能有歧义`, keyNode.offset, keyNode.length, duplicatePath));
        } else if (keyNode) {
          seen.set(key, keyNode);
        }
        if (valueNode) walk(valueNode, [...path, key]);
      }
      return;
    }
    if (node.type === "array") {
      (node.children ?? []).forEach((child, index) => walk(child, [...path, index]));
    }
  };

  walk(root, []);
  return result;
}

export function parseJsonDocument(text: string): ParsedDocument {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false });
  const issues = errors.map((error) =>
    issue(text, "error", printParseErrorCode(error.error), error.offset, error.length),
  );
  const duplicateIssues = collectDuplicateKeys(text, root);
  const data = errors.length === 0 ? parse(text, [], { allowTrailingComma: true, disallowComments: false }) : undefined;
  return {
    format: "json",
    valid: errors.length === 0,
    data,
    issues: [...issues, ...duplicateIssues],
    duplicatePaths: duplicateIssues.map((item) => item.path ?? "$"),
  };
}

function xmlDepth(text: string): number {
  const tags = text.match(/<\/?[A-Za-z_][^>]*>/g) ?? [];
  let depth = 0;
  let max = 0;
  for (const tag of tags) {
    if (tag.startsWith("</")) depth = Math.max(0, depth - 1);
    else if (!tag.endsWith("/>") && !tag.startsWith("<?") && !tag.startsWith("<!")) {
      depth += 1;
      max = Math.max(max, depth);
    }
  }
  return max;
}

function parseSingleXmlDocument(text: string): ParsedDocument {
  if (XML_SECURITY_PATTERN.test(text)) {
    return {
      format: "xml",
      valid: false,
      issues: [issue(text, "error", "出于安全考虑，不允许 DOCTYPE 或 ENTITY 声明", Math.max(0, text.search(XML_SECURITY_PATTERN)), 8)],
      duplicatePaths: [],
    };
  }
  if (xmlDepth(text) > MAX_XML_DEPTH) {
    return {
      format: "xml",
      valid: false,
      issues: [issue(text, "error", `XML 嵌套深度超过 ${MAX_XML_DEPTH} 层限制`)],
      duplicatePaths: [],
    };
  }
  const validation = XMLValidator.validate(text, { allowBooleanAttributes: true });
  if (validation !== true) {
    const line = Math.max(1, validation.err.line ?? 1);
    const column = Math.max(1, validation.err.col ?? 1);
    const lines = text.split(/\r?\n/);
    const offset = lines.slice(0, line - 1).reduce((sum, value) => sum + value.length + 1, 0) + column - 1;
    return {
      format: "xml",
      valid: false,
      issues: [{ severity: "error", message: validation.err.msg, offset, length: 1, line, column }],
      duplicatePaths: [],
    };
  }
  try {
    return { format: "xml", valid: true, data: xmlParser.parse(text), issues: [], duplicatePaths: [] };
  } catch (error) {
    return {
      format: "xml",
      valid: false,
      issues: [issue(text, "error", error instanceof Error ? error.message : "XML 解析失败")],
      duplicatePaths: [],
    };
  }
}

interface PipeSeparatedXmlDocuments {
  blocks: string[];
  parsed: ParsedDocument;
}

function parsePipeSeparatedXmlDocuments(text: string): PipeSeparatedXmlDocuments | undefined {
  if (!text.includes("|")) return undefined;

  const fragments = text.split("|");
  const blocks: string[] = [];
  const parsedBlocks: ParsedDocument[] = [];
  let current = fragments[0] ?? "";

  for (let index = 1; index < fragments.length; index += 1) {
    const candidate = current.trim();
    const parsed = candidate ? parseSingleXmlDocument(candidate) : undefined;
    if (parsed?.valid) {
      blocks.push(candidate);
      parsedBlocks.push(parsed);
      current = fragments[index];
    } else {
      current += `|${fragments[index]}`;
    }
  }

  const lastBlock = current.trim();
  const lastParsed = lastBlock ? parseSingleXmlDocument(lastBlock) : undefined;
  if (!lastParsed?.valid || blocks.length === 0) return undefined;

  blocks.push(lastBlock);
  parsedBlocks.push(lastParsed);
  return {
    blocks,
    parsed: {
      format: "xml",
      valid: true,
      data: parsedBlocks.map((item) => item.data),
      issues: [],
      duplicatePaths: [],
    },
  };
}

export function parseXmlDocument(text: string): ParsedDocument {
  return parsePipeSeparatedXmlDocuments(text)?.parsed ?? parseSingleXmlDocument(text);
}

export function parseDocument(text: string, requested: ResolvedFormat): ParsedDocument {
  if (requested === "json") return parseJsonDocument(text);
  if (requested === "xml") return parseXmlDocument(text);
  return { format: "text", valid: true, data: text, issues: [], duplicatePaths: [] };
}

export function formatJson(text: string): { text: string; parsed: ParsedDocument } {
  const parsed = parseJsonDocument(text);
  if (!parsed.valid) return { text, parsed };
  const edits = formatJsonEdits(text, undefined, { insertSpaces: true, tabSize: 2, eol: "\n", keepLines: false });
  return { text: applyEdits(text, edits), parsed };
}

export function minifyJson(text: string): { text: string; parsed: ParsedDocument } {
  const parsed = parseJsonDocument(text);
  if (!parsed.valid) return { text, parsed };
  return { text: JSON.stringify(parsed.data), parsed };
}

function isXmlIndentationNode(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length === 1
    && entries[0][0] === "#text"
    && typeof entries[0][1] === "string"
    && /[\r\n]/.test(entries[0][1])
    && /^[\s]+$/.test(entries[0][1]);
}

function stripXmlFormattingWhitespace(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !isXmlIndentationNode(item))
      .map(stripXmlFormattingWhitespace);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, stripXmlFormattingWhitespace(child)]),
    );
  }
  return value;
}

function formatSingleXml(text: string, minify = false): { text: string; parsed: ParsedDocument } {
  const parsed = parseSingleXmlDocument(text);
  if (!parsed.valid) return { text, parsed };
  try {
    const ordered = stripXmlFormattingWhitespace(xmlOrderedParser.parse(text));
    const builder = new XMLBuilder({
      preserveOrder: true,
      ignoreAttributes: false,
      attributeNamePrefix: "@",
      textNodeName: "#text",
      cdataPropName: "#cdata",
      commentPropName: "#comment",
      format: !minify,
      indentBy: "  ",
      suppressEmptyNode: false,
      processEntities: false,
    });
    const built = builder.build(ordered);
    return { text: minify ? built.replace(/>\s+</g, "><").trim() : built.trim(), parsed };
  } catch (error) {
    return {
      text,
      parsed: {
        ...parsed,
        valid: false,
        issues: [issue(text, "error", error instanceof Error ? error.message : "XML 格式化失败")],
      },
    };
  }
}

export function formatXml(text: string, minify = false): { text: string; parsed: ParsedDocument } {
  const separated = parsePipeSeparatedXmlDocuments(text);
  if (!separated) return formatSingleXml(text, minify);

  const formattedBlocks = separated.blocks.map((block) => formatSingleXml(block, minify));
  const failed = formattedBlocks.find((result) => !result.parsed.valid);
  if (failed) return { text, parsed: failed.parsed };

  return {
    text: formattedBlocks.map((result) => result.text).join(minify ? "|" : "\n|\n"),
    parsed: separated.parsed,
  };
}

export function formatDocument(text: string, format: ResolvedFormat, minify = false) {
  if (format === "json") return minify ? minifyJson(text) : formatJson(text);
  if (format === "xml") return formatXml(text, minify);
  return { text, parsed: parseDocument(text, "text") };
}

const JSON_ESCAPE_PATTERN = /\\(u[0-9a-fA-F]{4}|["\\/bfnrt])/g;

export function escapeText(text: string): string {
  return JSON.stringify(text).slice(1, -1);
}

export function unescapeText(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const decoded = JSON.parse(trimmed);
      if (typeof decoded === "string") return decoded;
    } catch {
      // Fall through and decode any valid escape sequences that are present.
    }
  }

  return text.replace(JSON_ESCAPE_PATTERN, (_match, escape: string) => {
    if (escape.startsWith("u")) return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    const controls: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
    return controls[escape] ?? escape;
  });
}

export function removeEscapes(text: string): string {
  return text.replace(/\\(?=["\\/])/g, "");
}

function valueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export function inferStructure(data: unknown, root = "$", maxEntries = 20_000): StructureEntry[] {
  const entries: StructureEntry[] = [];
  const seen = new Set<string>();

  const add = (path: string, name: string, type: string, depth: number, cardinality?: "one" | "many") => {
    const key = `${path}|${type}|${cardinality ?? ""}`;
    if (seen.has(key) || entries.length >= maxEntries) return;
    seen.add(key);
    entries.push({ path, name, type, depth, cardinality });
  };

  const walk = (value: unknown, path: string, name: string, depth: number) => {
    const type = valueType(value);
    add(path, name, type, depth, Array.isArray(value) ? "many" : "one");
    if (Array.isArray(value)) {
      value.slice(0, 100).forEach((item) => walk(item, `${path}[*]`, "[*]", depth + 1));
      return;
    }
    if (value && typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        const childPath = key.startsWith("@") ? `${path}.${key}` : `${path}.${key}`;
        walk(child, childPath, key, depth + 1);
      });
    }
  };

  walk(data, root, root, 0);
  return entries;
}
