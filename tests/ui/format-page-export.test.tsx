/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceSnapshot } from "../../src/types";
import { useAppStore } from "../../src/store/appStore";

const saveTextFileMock = vi.hoisted(() => vi.fn(async () => true));

vi.mock("../../src/components/CodeEditor", () => ({
  CodeEditor: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) => (
    <textarea aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
  ),
}));

vi.mock("../../src/platform/files", () => ({
  openTextFiles: vi.fn(async () => []),
  saveTextFile: saveTextFileMock,
}));

vi.mock("../../src/i18n", () => ({ translate: (source: string) => source }));

const { FormatPage } = await import("../../src/pages/FormatPage");

afterEach(cleanup);

beforeEach(() => {
  saveTextFileMock.mockClear();
  const state = useAppStore.getState();
  useAppStore.setState({
    settings: { ...state.settings, language: "zh-CN", theme: "light", editorFont: "Consolas", fontSize: 14, wordWrap: false, maxLiveBytes: 1024 * 1024 },
    baselines: [],
    maskRules: [],
  });
});

describe("FormatPage export menu", () => {
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
});
