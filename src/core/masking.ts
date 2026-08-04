import { XMLBuilder } from "fast-xml-parser";
import type { MaskRule, ResolvedFormat } from "../types";
import { parseDocument } from "./document";

export const DEFAULT_MASK_RULES: MaskRule[] = [
  { id: "mask-token", path: "$.token", strategy: "keep-edges", replacement: "***", keepStart: 3, keepEnd: 2, enabled: true },
  { id: "mask-password", path: "$.password", strategy: "replace", replacement: "***", enabled: true },
  { id: "mask-auth", path: "$.headers.Authorization", strategy: "keep-edges", replacement: "***", keepStart: 7, keepEnd: 4, enabled: true },
];

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\\\[\\\*\\\]/g, "\\[\\d+\\]").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

function applies(path: string, rule: MaskRule): boolean {
  return rule.enabled && Boolean(rule.path.trim()) && globToRegExp(rule.path).test(path);
}

function maskValue(value: unknown, rule: MaskRule): unknown {
  if (rule.strategy === "remove") return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (rule.strategy === "replace") return rule.replacement || "***";
  const start = Math.max(0, rule.keepStart ?? 2);
  const end = Math.max(0, rule.keepEnd ?? 2);
  if (text.length <= start + end) return rule.replacement || "***";
  return `${text.slice(0, start)}${rule.replacement || "***"}${end ? text.slice(-end) : ""}`;
}

export function applyMaskRules(data: unknown, rules: MaskRule[], root = "$", maxNodes = 100_000): unknown {
  let visited = 0;
  const walk = (value: unknown, path: string): unknown => {
    visited += 1;
    if (visited > maxNodes) throw new Error(`脱敏节点超过 ${maxNodes} 个限制`);
    const rule = rules.find((candidate) => applies(path, candidate));
    if (rule) return maskValue(value, rule);
    if (Array.isArray(value)) return value.map((item, index) => walk(item, `${path}[${index}]`));
    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        const childPath = `${path}.${key}`;
        const childRule = rules.find((candidate) => applies(childPath, candidate));
        const masked = childRule ? maskValue(child, childRule) : walk(child, childPath);
        if (masked !== undefined) result[key] = masked;
      });
      return result;
    }
    return value;
  };
  return walk(data, root);
}

export function maskDocumentText(text: string, format: ResolvedFormat, rules: MaskRule[]): string {
  if (format === "text") return text;
  const parsed = parseDocument(text, format);
  if (!parsed.valid) throw new Error(parsed.issues[0]?.message ?? "报文无效，无法脱敏");
  const builder = new XMLBuilder({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", cdataPropName: "#cdata", format: true, indentBy: "  " });
  if (format === "xml" && Array.isArray(parsed.data)) {
    return parsed.data.map((block) => builder.build(applyMaskRules(block, rules)).trim()).join("\n|\n");
  }
  const masked = applyMaskRules(parsed.data, rules);
  if (format === "json") return JSON.stringify(masked, null, 2);
  return builder.build(masked).trim();
}
