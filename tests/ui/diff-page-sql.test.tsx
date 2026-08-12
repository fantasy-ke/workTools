/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DIFF_OPTIONS } from "../../src/core/diff";
import { useAppStore } from "../../src/store/appStore";
import type { WorkspaceSnapshot } from "../../src/types";

const saveTextFileMock = vi.hoisted(() => vi.fn(async (_fileName: string, _content: string) => true));
const notifyMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/components/CodeEditor", () => ({
  CodeEditor: ({ value, onChange, label, format }: { value: string; onChange: (value: string) => void; label: string; format: string }) => (
    <textarea aria-label={label} data-format={format} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
  ),
}));

vi.mock("../../src/platform/files", () => ({
  openTextFiles: vi.fn(async () => []),
  saveTextFile: saveTextFileMock,
}));

vi.mock("../../src/components/Toast", () => ({
  useToast: () => ({ notify: notifyMock }),
}));

vi.mock("../../src/hooks/useMonacoFindShortcut", () => ({
  useMonacoFindShortcut: vi.fn(),
}));

vi.mock("../../src/hooks/useWorkspaceSaveShortcut", () => ({
  getWorkspaceSaveMessage: vi.fn(() => "saved"),
  saveWorkspaceTarget: vi.fn(),
  useWorkspaceSaveShortcut: vi.fn(),
}));

vi.mock("../../src/i18n", () => ({ translate: (source: string) => source }));

const { DiffPage } = await import("../../src/pages/DiffPage");

afterEach(cleanup);

beforeEach(() => {
  saveTextFileMock.mockClear();
  notifyMock.mockClear();
  const state = useAppStore.getState();
  useAppStore.setState({
    settings: {
      ...state.settings,
      language: "zh-CN",
      theme: "light",
      editorFont: "Consolas",
      fontSize: 14,
      wordWrap: false,
      maxLiveBytes: 1024 * 1024,
      defaultDiffOptions: { ...DEFAULT_DIFF_OPTIONS },
    },
    ruleTemplates: [],
    maskRules: [{ id: "password", path: "$.password", strategy: "replace", replacement: "***", enabled: true }],
  });
});

describe("DiffPage SQL comparison", () => {
  it("auto-detects SQL, shows the fallback warning, and exports invalid SQL as original text", async () => {
    const leftText = "SELECT 'unterminated";
    const rightText = "SELECT 'closed';";
    const snapshot: WorkspaceSnapshot = {
      kind: "diff",
      leftText,
      rightText,
      format: "auto",
      options: { ...DEFAULT_DIFF_OPTIONS },
      leftName: "before.sql",
      rightName: "after.sql",
    };

    render(<DiffPage snapshot={snapshot} />);

    const leftEditor = await screen.findByRole("textbox", { name: "\u5de6\u4fa7\u62a5\u6587" });
    await waitFor(() => expect((leftEditor as HTMLTextAreaElement).value).toBe(leftText));

    expect(screen.getByRole("option", { name: "SQL" })).toBeTruthy();
    expect(leftEditor.getAttribute("data-format")).toBe("sql");
    expect(screen.getByRole("option", { name: "SQL \u683c\u5f0f\u5316\u5bf9\u6bd4" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /\u5f00\u59cb\u5bf9\u6bd4/ }));

    expect(await screen.findByText("\u81f3\u5c11\u4e00\u4fa7 SQL \u65e0\u6cd5\u683c\u5f0f\u5316\uff0c\u5df2\u9000\u56de\u539f\u6587\u5bf9\u6bd4")).toBeTruthy();
    expect(screen.getByText("SQL \u5bfc\u51fa\u4e0d\u8131\u654f")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));

    await waitFor(() => expect(saveTextFileMock).toHaveBeenCalledTimes(1));
    const [, content] = saveTextFileMock.mock.calls[0];
    const report = JSON.parse(content as string);
    expect(report.payload).toEqual({ left: leftText, right: rightText });
  });
});
