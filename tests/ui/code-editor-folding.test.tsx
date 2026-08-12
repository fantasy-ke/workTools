/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const editorProps: Array<Record<string, unknown>> = [];

vi.mock("@monaco-editor/react", () => ({
  default: (props: Record<string, unknown>) => {
    editorProps.push(props);
    return <div data-testid="monaco-editor-mock" />;
  },
}));

vi.mock("../../src/monaco", () => ({}));
vi.mock("../../src/i18n", () => ({ translate: (source: string) => source }));

const { CodeEditor } = await import("../../src/components/CodeEditor");

afterEach(() => {
  cleanup();
  editorProps.length = 0;
});

describe("CodeEditor folding controls", () => {
  it("keeps Monaco folding controls visible for JSON/XML nodes", () => {
    render(
      <CodeEditor
        value={JSON.stringify({ hotel: { name: "example hotel" } })}
        format="json"
        theme="light"
        fontFamily="Arial"
        fontSize={14}
        wordWrap={false}
        label="editor"
      />,
    );

    expect(editorProps).toHaveLength(1);
    expect(editorProps[0]).toMatchObject({
      options: expect.objectContaining({
        folding: true,
        showFoldingControls: "always",
        lineDecorationsWidth: 24,
        glyphMargin: false,
      }),
    });
  });

  it("uses the SQL language for SQL comparison editors", () => {
    render(
      <CodeEditor
        value="SELECT id FROM users;"
        format="sql"
        theme="light"
        fontFamily="Arial"
        fontSize={14}
        wordWrap={false}
        label="sql editor"
      />,
    );

    expect(editorProps[0]).toMatchObject({ language: "sql" });
  });
});
