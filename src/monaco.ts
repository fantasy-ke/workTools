import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/editor/contrib/find/browser/findController";
import "monaco-editor/editor/contrib/folding/browser/folding";
import "../node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";

self.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker();
  },
};

function registerLanguage(
  id: string,
  configuration: monaco.languages.LanguageConfiguration,
  language: monaco.languages.IMonarchLanguage,
) {
  if (!monaco.languages.getLanguages().some((item) => item.id === id)) {
    monaco.languages.register({ id });
  }
  monaco.languages.setLanguageConfiguration(id, configuration);
  monaco.languages.setMonarchTokensProvider(id, language);
}

registerLanguage(
  "json",
  {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [
      ["{", "}"],
      ["[", "]"],
    ],
    autoClosingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "{", close: "}" },
      { open: "[", close: "]" },
      { open: '"', close: '"' },
    ],
  },
  {
    defaultToken: "",
    tokenPostfix: ".json",
    tokenizer: {
      root: [
        [/[{}\[\]]/, "delimiter.bracket"],
        [/[:,]/, "delimiter"],
        [/"(?:\\.|[^"\\])*"(?=\s*:)/, "string.key"],
        [/"(?:\\.|[^"\\])*"/, "string.value"],
        [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, "number"],
        [/\b(?:true|false|null)\b/, "keyword"],
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
      ],
      comment: [
        [/[^*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[*/]/, "comment"],
      ],
    },
  },
);

registerLanguage(
  "xml",
  {
    comments: { blockComment: ["<!--", "-->"] },
    brackets: [["<", ">"]],
    autoClosingPairs: [
      { open: "<", close: ">" },
      { open: "'", close: "'" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: "<", close: ">" },
      { open: "'", close: "'" },
      { open: '"', close: '"' },
    ],
  },
  {
    defaultToken: "",
    tokenPostfix: ".xml",
    ignoreCase: true,
    qualifiedName: /(?:[\w.\-]+:)?[\w.\-]+/,
    tokenizer: {
      root: [
        [/[^<&]+/, ""],
        { include: "@whitespace" },
        [/(<)(@qualifiedName)/, [{ token: "delimiter" }, { token: "tag", next: "@tag" }]],
        [
          /(<\/)(@qualifiedName)(\s*)(>)/,
          [{ token: "delimiter" }, { token: "tag" }, "", { token: "delimiter" }],
        ],
        [/(<\?)(@qualifiedName)/, [{ token: "delimiter" }, { token: "metatag", next: "@tag" }]],
        [/(<!)(@qualifiedName)/, [{ token: "delimiter" }, { token: "metatag", next: "@tag" }]],
        [/<!\[CDATA\[/, { token: "delimiter.cdata", next: "@cdata" }],
        [/&\w+;/, "string.escape"],
      ],
      cdata: [
        [/[^\]]+/, ""],
        [/\]\]>/, { token: "delimiter.cdata", next: "@pop" }],
        [/\]/, ""],
      ],
      tag: [
        [/[ \t\r\n]+/, ""],
        [/(@qualifiedName)(\s*=\s*)("[^"]*"|'[^']*')/, ["attribute.name", "", "attribute.value"]],
        [/@qualifiedName/, "attribute.name"],
        [/\?>/, { token: "delimiter", next: "@pop" }],
        [/(\/)(>)/, [{ token: "tag" }, { token: "delimiter", next: "@pop" }]],
        [/>/, { token: "delimiter", next: "@pop" }],
      ],
      whitespace: [
        [/[ \t\r\n]+/, ""],
        [/<!--/, { token: "comment", next: "@comment" }],
      ],
      comment: [
        [/[^<\-]+/, "comment.content"],
        [/-->/, { token: "comment", next: "@pop" }],
        [/<!--/, "comment.content.invalid"],
        [/[<\-]/, "comment.content"],
      ],
    },
  },
);

monaco.editor.defineTheme("worktools-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "string.key.json", foreground: "0550AE", fontStyle: "bold" },
    { token: "string.value.json", foreground: "0A7A45" },
    { token: "number", foreground: "9A3412" },
    { token: "keyword", foreground: "7C3AED" },
    { token: "tag", foreground: "0550AE" },
    { token: "metatag", foreground: "7C3AED" },
    { token: "attribute.name", foreground: "9A3412" },
    { token: "attribute.value", foreground: "0A7A45" },
    { token: "delimiter", foreground: "64748B" },
    { token: "comment", foreground: "6B7280", fontStyle: "italic" },
  ],
  colors: {},
});

monaco.editor.defineTheme("worktools-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "string.key.json", foreground: "9CDCFE", fontStyle: "bold" },
    { token: "string.value.json", foreground: "CE9178" },
    { token: "number", foreground: "B5CEA8" },
    { token: "keyword", foreground: "C586C0" },
    { token: "tag", foreground: "9CDCFE" },
    { token: "metatag", foreground: "C586C0" },
    { token: "attribute.name", foreground: "DCDCAA" },
    { token: "attribute.value", foreground: "CE9178" },
    { token: "delimiter", foreground: "A8B2C1" },
    { token: "comment", foreground: "6A9955", fontStyle: "italic" },
  ],
  colors: {},
});

loader.config({ monaco });

export { monaco };