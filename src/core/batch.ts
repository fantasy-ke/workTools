import type { BatchPair, LocalTextFile } from "../types";
import { createId } from "../utils";

export function normalizeDirectoryRelativePath(path: string, stripRootDirectory = false): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!stripRootDirectory) return normalized;
  const parts = normalized.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : normalized;
}

function pairKey(file: LocalTextFile): string {
  return normalizeDirectoryRelativePath(file.relativePath || file.name).toLocaleLowerCase();
}

export function pairDirectoryFiles(left: LocalTextFile[], right: LocalTextFile[]): BatchPair[] {
  const leftMap = new Map(left.map((file) => [pairKey(file), file]));
  const rightMap = new Map(right.map((file) => [pairKey(file), file]));
  return [...new Set([...leftMap.keys(), ...rightMap.keys()])]
    .sort()
    .map((key) => ({ id: createId("pair"), name: key, left: leftMap.get(key), right: rightMap.get(key) }));
}
