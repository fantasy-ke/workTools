import type {
  DiffChange,
  DiffOptions,
  DiffResult,
  DocumentFormat,
  ResolvedFormat,
  StructureEntry,
} from "../types";
import { detectFormat, inferStructure, parseDocument } from "./document";

export const DEFAULT_DIFF_OPTIONS: DiffOptions = {
  mode: "semantic",
  ignoreWhitespace: true,
  ignoreCase: false,
  strictTypes: true,
  missingEqualsNull: false,
  ignorePaths: [],
  includePaths: [],
  arrayMode: "sequence",
  arrayKey: "id",
  maxChanges: 5_000,
};

function typeOf(value: unknown): string {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function normalizePathPattern(pattern: string): RegExp {
  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\[\\\*\\\]/g, "\\[\\d+\\]")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (!pattern.trim()) return false;
    try {
      return normalizePathPattern(pattern).test(path) || path === pattern;
    } catch {
      return path === pattern;
    }
  });
}

function isPathIncluded(path: string, options: DiffOptions): boolean {
  if (matchesAny(path, options.ignorePaths)) return false;
  if (!options.includePaths.length) return true;
  return options.includePaths.some((pattern) =>
    path.startsWith(pattern.replace(/\*.*$/, "")) || matchesAny(path, [pattern]),
  );
}

function previewValue(value: unknown): unknown {
  if (typeof value === "string" && value.length > 500) return `${value.slice(0, 500)}…`;
  if (Array.isArray(value) && value.length > 20) return [...value.slice(0, 20), `…共 ${value.length} 项`];
  return value;
}

function canonical(value: unknown, ignoreCase: boolean): string {
  if (value === null || typeof value !== "object") {
    const primitive = typeof value === "string" && ignoreCase ? value.toLocaleLowerCase() : value;
    return JSON.stringify(primitive);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item, ignoreCase)).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key], ignoreCase)}`)
    .join(",")}}`;
}

function valuesEqual(left: unknown, right: unknown, options: DiffOptions): boolean {
  if (options.missingEqualsNull && ((left === undefined && right === null) || (left === null && right === undefined))) return true;
  if (!options.strictTypes && left != null && right != null && String(left) === String(right)) return true;
  if (typeof left === "string" && typeof right === "string") {
    const a = options.ignoreWhitespace ? left.trim() : left;
    const b = options.ignoreWhitespace ? right.trim() : right;
    return options.ignoreCase ? a.toLocaleLowerCase() === b.toLocaleLowerCase() : a === b;
  }
  return Object.is(left, right);
}

function makeChange(index: number, change: Omit<DiffChange, "id">): DiffChange {
  return { id: `change-${index}`, ...change };
}

function compareSemanticData(left: unknown, right: unknown, options: DiffOptions): { changes: DiffChange[]; warnings: string[] } {
  const changes: DiffChange[] = [];
  const warnings: string[] = [];
  let sequence = 0;

  const push = (change: Omit<DiffChange, "id">) => {
    if (changes.length >= options.maxChanges) return;
    changes.push(makeChange(sequence++, change));
  };

  const walk = (a: unknown, b: unknown, path: string) => {
    if (!isPathIncluded(path, options) || changes.length >= options.maxChanges) return;
    const leftType = typeOf(a);
    const rightType = typeOf(b);

    if (leftType === "missing") {
      if (options.missingEqualsNull && b === null) return;
      push({ kind: "added", path, rightType, rightValue: previewValue(b), message: "右侧新增" });
      return;
    }
    if (rightType === "missing") {
      if (options.missingEqualsNull && a === null) return;
      push({ kind: "removed", path, leftType, leftValue: previewValue(a), message: "右侧删除" });
      return;
    }
    if (leftType !== rightType) {
      if (!options.strictTypes && valuesEqual(a, b, options)) return;
      push({
        kind: "type-changed",
        path,
        leftType,
        rightType,
        leftValue: previewValue(a),
        rightValue: previewValue(b),
        message: `类型由 ${leftType} 变为 ${rightType}`,
      });
      return;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      if (options.arrayMode === "unordered") {
        const leftSorted = [...a].sort((x, y) => canonical(x, options.ignoreCase).localeCompare(canonical(y, options.ignoreCase)));
        const rightSorted = [...b].sort((x, y) => canonical(x, options.ignoreCase).localeCompare(canonical(y, options.ignoreCase)));
        const max = Math.max(leftSorted.length, rightSorted.length);
        for (let i = 0; i < max; i += 1) walk(leftSorted[i], rightSorted[i], `${path}[${i}]`);
        return;
      }
      if (options.arrayMode === "match-by-key") {
        const key = options.arrayKey.trim();
        if (!key) {
          warnings.push("数组按 Key 匹配已启用，但没有填写 Key；已退回顺序对比");
        } else {
          const buildMap = (items: unknown[], side: string) => {
            const map = new Map<string, unknown>();
            let valid = true;
            for (const item of items) {
              if (!item || typeof item !== "object" || Array.isArray(item) || !(key in item)) {
                warnings.push(`${side}数组存在没有「${key}」字段的元素，已退回顺序对比`);
                valid = false;
                break;
              }
              const id = String((item as Record<string, unknown>)[key]);
              if (map.has(id)) {
                warnings.push(`${side}数组的「${key}」值 ${id} 重复，已退回顺序对比`);
                valid = false;
                break;
              }
              map.set(id, item);
            }
            return valid ? map : undefined;
          };
          const leftMap = buildMap(a, "左侧");
          const rightMap = buildMap(b, "右侧");
          if (leftMap && rightMap) {
            const keys = new Set([...leftMap.keys(), ...rightMap.keys()]);
            keys.forEach((id) => walk(leftMap.get(id), rightMap.get(id), `${path}[${key}=${id}]`));
            return;
          }
        }
      }
      const max = Math.max(a.length, b.length);
      for (let i = 0; i < max; i += 1) walk(a[i], b[i], `${path}[${i}]`);
      return;
    }

    if (a && b && typeof a === "object" && typeof b === "object") {
      const leftObject = a as Record<string, unknown>;
      const rightObject = b as Record<string, unknown>;
      const keys = new Set([...Object.keys(leftObject), ...Object.keys(rightObject)]);
      [...keys].sort().forEach((key) => walk(leftObject[key], rightObject[key], `${path}.${key}`));
      return;
    }

    if (!valuesEqual(a, b, options)) {
      push({
        kind: "changed",
        path,
        leftType,
        rightType,
        leftValue: previewValue(a),
        rightValue: previewValue(b),
        message: "值发生变化",
      });
    }
  };

  walk(left, right, "$");
  return { changes, warnings: [...new Set(warnings)] };
}

function structureMap(entries: StructureEntry[]): Map<string, StructureEntry> {
  return new Map(entries.map((entry) => [entry.path, entry]));
}

function compareStructures(left: unknown, right: unknown, options: DiffOptions): DiffChange[] {
  const leftMap = structureMap(inferStructure(left));
  const rightMap = structureMap(inferStructure(right));
  const paths = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const changes: DiffChange[] = [];
  let index = 0;
  for (const path of [...paths].sort()) {
    if (!isPathIncluded(path, options) || changes.length >= options.maxChanges) continue;
    const a = leftMap.get(path);
    const b = rightMap.get(path);
    if (!a && b) changes.push(makeChange(index++, { kind: "added", path, rightType: b.type, message: "新增结构" }));
    else if (a && !b) changes.push(makeChange(index++, { kind: "removed", path, leftType: a.type, message: "删除结构" }));
    else if (a && b && (a.type !== b.type || a.cardinality !== b.cardinality)) {
      changes.push(makeChange(index++, {
        kind: "type-changed",
        path,
        leftType: `${a.type}${a.cardinality === "many" ? "[]" : ""}`,
        rightType: `${b.type}${b.cardinality === "many" ? "[]" : ""}`,
        message: "字段类型或重复性发生变化",
      }));
    }
  }
  return changes;
}

function compareText(left: string, right: string, options: DiffOptions): DiffChange[] {
  const leftLines = left.split(/\r?\n/);
  const rightLines = right.split(/\r?\n/);
  const normalize = (line: string) => {
    let value = options.ignoreWhitespace ? line.trim().replace(/\s+/g, " ") : line;
    if (options.ignoreCase) value = value.toLocaleLowerCase();
    return value;
  };
  const changes: DiffChange[] = [];
  const max = Math.max(leftLines.length, rightLines.length);
  for (let index = 0; index < max && changes.length < options.maxChanges; index += 1) {
    const a = leftLines[index];
    const b = rightLines[index];
    if (a === undefined) {
      changes.push(makeChange(index, { kind: "added", path: `行 ${index + 1}`, rightValue: b, message: "新增行" }));
    } else if (b === undefined) {
      changes.push(makeChange(index, { kind: "removed", path: `行 ${index + 1}`, leftValue: a, message: "删除行" }));
    } else if (normalize(a) !== normalize(b)) {
      changes.push(makeChange(index, { kind: "changed", path: `行 ${index + 1}`, leftValue: a, rightValue: b, message: "文本行不同" }));
    }
  }
  return changes;
}

function resolveFormat(leftText: string, rightText: string, requested: DocumentFormat): ResolvedFormat {
  if (requested !== "auto") return requested;
  const left = detectFormat(leftText);
  const right = detectFormat(rightText);
  return left === right ? left : "text";
}

function prettyNormalized(data: unknown, format: ResolvedFormat): string | undefined {
  if (format === "json") return JSON.stringify(data, null, 2);
  return undefined;
}

export function compareDocuments(
  leftText: string,
  rightText: string,
  requestedFormat: DocumentFormat,
  providedOptions: Partial<DiffOptions> = {},
): DiffResult {
  const started = performance.now();
  const options = { ...DEFAULT_DIFF_OPTIONS, ...providedOptions };
  const format = resolveFormat(leftText, rightText, requestedFormat);
  const warnings: string[] = [];
  let changes: DiffChange[] = [];
  let leftValid = true;
  let rightValid = true;
  let normalizedLeft: string | undefined;
  let normalizedRight: string | undefined;

  if (options.mode === "text" || format === "text") {
    changes = compareText(leftText, rightText, options);
  } else {
    const left = parseDocument(leftText, format);
    const right = parseDocument(rightText, format);
    leftValid = left.valid;
    rightValid = right.valid;
    if (!left.valid || !right.valid) {
      warnings.push("至少一侧报文无法解析，已退回文本对比");
      changes = compareText(leftText, rightText, options);
    } else if (left.duplicatePaths.length || right.duplicatePaths.length) {
      warnings.push("检测到重复 JSON Key，语义存在歧义；已退回文本对比");
      changes = compareText(leftText, rightText, options);
    } else if (options.mode === "structure") {
      changes = compareStructures(left.data, right.data, options);
    } else {
      const semantic = compareSemanticData(left.data, right.data, options);
      changes = semantic.changes;
      warnings.push(...semantic.warnings);
      normalizedLeft = prettyNormalized(left.data, format);
      normalizedRight = prettyNormalized(right.data, format);
    }
  }

  return {
    format,
    mode: options.mode,
    changes,
    warnings: [...new Set(warnings)],
    durationMs: Math.max(0, performance.now() - started),
    truncated: changes.length >= options.maxChanges,
    leftValid,
    rightValid,
    normalizedLeft,
    normalizedRight,
  };
}