/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceSnapshot } from "../../src/types";
import { useAppStore } from "../../src/store/appStore";

const saveTextFileMock = vi.hoisted(() => vi.fn(async () => true));
const notifyMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/components/CodeEditor", () => ({
  CodeEditor: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => (
    <textarea aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
  ),
}));

vi.mock("../../src/platform/files", () => ({
  openTextFiles: vi.fn(async () => []),
  saveTextFile: saveTextFileMock,
}));

vi.mock("../../src/components/Toast", () => ({
  useToast: () => ({ notify: notifyMock }),
}));

vi.mock("../../src/i18n", () => ({ translate: (source: string) => source }));

const { FormatPage } = await import("../../src/pages/FormatPage");

afterEach(cleanup);

beforeEach(() => {
  saveTextFileMock.mockClear();
  notifyMock.mockClear();
  const state = useAppStore.getState();
  useAppStore.setState({
    settings: { ...state.settings, language: "zh-CN", theme: "light", editorFont: "Consolas", fontSize: 14, wordWrap: false, maxLiveBytes: 1024 * 1024 },
    baselines: [],
    maskRules: [],
  });
});

describe("FormatPage format errors and export menu", () => {
  it("shows the friendly format error while keeping the parser detail", async () => {
    const payload = '{"token":"abc"}\n{"token":"def"}';
    const snapshot: WorkspaceSnapshot = { kind: "format", text: payload, format: "json", sourceName: "demo.json" };

    render(<FormatPage snapshot={snapshot} />);
    await waitFor(() => expect((screen.getByRole("textbox", { name: /报文编辑器/ }) as HTMLTextAreaElement).value).toBe(payload));

    fireEvent.click(screen.getByRole("button", { name: "格式化" }));

    expect(notifyMock).toHaveBeenCalledWith("格式有问题 好好检查一下 老表", "error");
    expect(screen.getByText("EndOfFileExpected")).toBeTruthy();
  });

  it("supports exporting the current payload as a TXT file", async () => {
    const payload = '{"token":"abc"}';
    const snapshot: WorkspaceSnapshot = { kind: "format", text: payload, format: "json", sourceName: "demo.json" };

    render(<FormatPage snapshot={snapshot} />);
    await screen.findByDisplayValue(payload);

    fireEvent.click(screen.getByRole("checkbox", { name: /导出时脱敏/ }));
    fireEvent.click(screen.getByText("导出报文"));
    fireEvent.click(screen.getByRole("menuitem", { name: /导出 TXT 文件/, hidden: true }));

    await waitFor(() => expect(saveTextFileMock).toHaveBeenCalledWith("worktools-message.txt", payload));
    expect(saveTextFileMock).toHaveBeenCalledTimes(1);
  });

  it("exports JSON with EndOfFileExpected as the original message", async () => {
    const payload = '{"token":"abc"}\n{"token":"def"}';
    const snapshot: WorkspaceSnapshot = { kind: "format", text: payload, format: "json", sourceName: "demo.json" };

    render(<FormatPage snapshot={snapshot} />);
    await waitFor(() => expect((screen.getByRole("textbox", { name: /报文编辑器/ }) as HTMLTextAreaElement).value).toBe(payload));

    fireEvent.click(screen.getByText("导出报文"));
    fireEvent.click(screen.getByRole("menuitem", { name: /导出报文文件/, hidden: true }));

    await waitFor(() => expect(saveTextFileMock).toHaveBeenCalledWith("worktools-message.json", payload));
    expect(saveTextFileMock).toHaveBeenCalledTimes(1);
    expect(notifyMock).toHaveBeenCalledWith("格式有问题 好好检查一下 老表", "info");
  });

  it("exports JSON with EndOfFileExpected even when masking is enabled", async () => {
    const payload = '{"token":"abc"}\n{"token":"def"}';
    const state = useAppStore.getState();
    useAppStore.setState({
      ...state,
      maskRules: [{ id: "token", path: "$.token", strategy: "replace", replacement: "***", enabled: true }],
    });
    const snapshot: WorkspaceSnapshot = { kind: "format", text: payload, format: "json", sourceName: "demo.json" };

    render(<FormatPage snapshot={snapshot} />);
    await waitFor(() => expect((screen.getByRole("textbox", { name: /报文编辑器/ }) as HTMLTextAreaElement).value).toBe(payload));

    fireEvent.click(screen.getByText("导出报文"));
    fireEvent.click(screen.getByRole("menuitem", { name: /导出报文文件/, hidden: true }));

    await waitFor(() => expect(saveTextFileMock).toHaveBeenCalledWith("worktools-message.json", payload));
    expect(saveTextFileMock).toHaveBeenCalledTimes(1);
  });
});
