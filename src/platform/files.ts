import type { LocalTextFile } from "../types";
import { safeFileName } from "../utils";
import { normalizeDirectoryRelativePath } from "../core/batch";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function browserPickFiles(accept: string, multiple: boolean, directory = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    if (directory) input.setAttribute("webkitdirectory", "");
    input.addEventListener("change", () => resolve(Array.from(input.files ?? [])), { once: true });
    input.addEventListener("cancel", () => resolve([]), { once: true });
    input.click();
  });
}

async function toLocalTextFile(file: File): Promise<LocalTextFile> {
  return { name: file.name, content: await file.text(), size: file.size, relativePath: file.webkitRelativePath || undefined };
}

export async function openTextFiles(multiple = false): Promise<LocalTextFile[]> {
  if (!isTauriRuntime()) {
    return Promise.all((await browserPickFiles(".json,.xml,.sql,.txt,.log,.apiwork,application/json,text/xml,text/plain", multiple)).map(toLocalTextFile));
  }
  const [{ open }, { readTextFile, stat }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
  const selected = await open({ multiple, directory: false, filters: [{ name: "报文文件", extensions: ["json", "xml", "sql", "txt", "log"] }] });
  const paths = selected ? (Array.isArray(selected) ? selected : [selected]) : [];
  return Promise.all(paths.map(async (path) => {
    const info = await stat(path);
    return { name: path.split(/[\\/]/).pop() ?? "未命名", content: await readTextFile(path), size: info.size, path };
  }));
}

export async function openBinaryFile(extension = "apiwork"): Promise<{ name: string; bytes: Uint8Array } | undefined> {
  if (!isTauriRuntime()) {
    const [file] = await browserPickFiles(`.${extension}`, false);
    return file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : undefined;
  }
  const [{ open }, { readFile }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
  const selected = await open({ multiple: false, directory: false, filters: [{ name: "worktools 工作包", extensions: [extension] }] });
  if (!selected || Array.isArray(selected)) return undefined;
  return { name: selected.split(/[\\/]/).pop() ?? `worktools.${extension}`, bytes: await readFile(selected) };
}

export async function openDirectoryTextFiles(): Promise<LocalTextFile[]> {
  if (!isTauriRuntime()) {
    const files = await browserPickFiles(".json,.xml,.sql,.txt,.log", true, true);
    return Promise.all(files.map(async (file) => {
      const local = await toLocalTextFile(file);
      local.relativePath = normalizeDirectoryRelativePath(file.webkitRelativePath || file.name, true);
      return local;
    }));
  }
  const [{ open }, fs] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
  const selected = await open({ multiple: false, directory: true });
  if (!selected || Array.isArray(selected)) return [];
  const output: LocalTextFile[] = [];
  const walk = async (directory: string, relative = "") => {
    const entries = await fs.readDir(directory);
    for (const entry of entries) {
      if (!entry.name || output.length >= 1_000) continue;
      const path = `${directory}${directory.endsWith("\\") || directory.endsWith("/") ? "" : "\\"}${entry.name}`;
      const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory) await walk(path, nextRelative);
      else if (/\.(json|xml|sql|txt|log)$/i.test(entry.name)) {
        const info = await fs.stat(path);
        output.push({ name: entry.name, content: await fs.readTextFile(path), size: info.size, path, relativePath: nextRelative });
      }
    }
  };
  await walk(selected);
  return output;
}

function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFileName(name);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function saveTextFile(name: string, content: string): Promise<boolean> {
  if (!isTauriRuntime()) {
    const type = name.toLocaleLowerCase().endsWith(".html") ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
    downloadBlob(name, new Blob([content], { type }));
    return true;
  }
  const [{ save }, { writeTextFile }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
  const extension = name.split(".").pop() ?? "txt";
  const path = await save({ defaultPath: safeFileName(name), filters: [{ name: "导出文件", extensions: [extension] }] });
  if (!path) return false;
  await writeTextFile(path, content);
  return true;
}

export async function saveBinaryFile(name: string, bytes: Uint8Array): Promise<boolean> {
  if (!isTauriRuntime()) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    downloadBlob(name, new Blob([copy.buffer], { type: "application/octet-stream" }));
    return true;
  }
  const [{ save }, { writeFile }] = await Promise.all([import("@tauri-apps/plugin-dialog"), import("@tauri-apps/plugin-fs")]);
  const extension = name.split(".").pop() ?? "apiwork";
  const path = await save({ defaultPath: safeFileName(name), filters: [{ name: "worktools 工作包", extensions: [extension] }] });
  if (!path) return false;
  await writeFile(path, bytes);
  return true;
}