// @vitest-environment jsdom

import type { editor as MonacoEditor } from "monaco-editor";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

let monaco: typeof import("../src/monaco").monaco;
let host: HTMLDivElement | null = null;
let editor: MonacoEditor.IStandaloneCodeEditor | null = null;

beforeAll(async () => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    writable: true,
    value: () => null,
  });
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  ({ monaco } = await import("../src/monaco"));
});

afterEach(() => {
  const model = editor?.getModel();
  editor?.dispose();
  model?.dispose();
  host?.remove();
  editor = null;
  host = null;
});

describe("Monaco find contribution", () => {
  it("registers the actions.find command used by the in-editor Ctrl+F shortcut", () => {
    host = document.createElement("div");
    document.body.append(host);
    editor = monaco.editor.create(host, {
      automaticLayout: false,
      language: "json",
      value: "{\"ok\": true}",
    });

    expect(editor.getAction("actions.find")).not.toBeNull();
  });
});