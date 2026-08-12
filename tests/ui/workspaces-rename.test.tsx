// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspacesPage } from "../../src/pages/WorkspacesPage";
import { useAppStore } from "../../src/store/appStore";
import type { WorkspaceRecord } from "../../src/types";

const { notifyMock } = vi.hoisted(() => ({ notifyMock: vi.fn() }));

vi.mock("../../src/components/Toast", () => ({
  useToast: () => ({ notify: notifyMock }),
}));

const originalState = useAppStore.getState();
const matchMediaMock = {
  matches: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
const workspace: WorkspaceRecord = {
  id: "workspace-1",
  name: "旧名称",
  type: "format",
  createdAt: "2026-08-11T08:00:00.000Z",
  updatedAt: "2026-08-11T08:00:00.000Z",
  pinned: false,
  sensitiveMode: false,
  snapshot: { kind: "format", text: "{}", format: "json" },
};

describe("WorkspacesPage rename", () => {
  beforeEach(() => {
    notifyMock.mockReset();
    window.matchMedia = vi.fn().mockReturnValue(matchMediaMock) as typeof window.matchMedia;
    useAppStore.setState({
      workspaces: [workspace],
      recycledWorkspaces: [],
      ruleTemplates: [],
      maskTemplates: [],
      baselines: [],
      recentFiles: [],
      settings: { ...originalState.settings, language: "zh-CN" },
      hydrated: true,
      initialize: vi.fn(async () => undefined),
    });
  });

  afterEach(() => {
    cleanup();
    useAppStore.setState(originalState);
    vi.restoreAllMocks();
  });

  it("renames the workspace and reports the updated record", async () => {
    const renamed = { ...workspace, name: "新名称", updatedAt: "2026-08-12T08:00:00.000Z" };
    const renameWorkspace = vi.fn(async () => {
      useAppStore.setState({ workspaces: [renamed] });
      return renamed;
    });
    const onWorkspaceRenamed = vi.fn();
    useAppStore.setState({ renameWorkspace });

    render(<WorkspacesPage onOpen={vi.fn()} onWorkspaceRenamed={onWorkspaceRenamed} />);
    fireEvent.click(screen.getByRole("button", { name: "重命名工作区" }));
    fireEvent.change(screen.getByRole("textbox", { name: "工作区名称" }), { target: { value: "  新名称  " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(renameWorkspace).toHaveBeenCalledWith(workspace.id, "新名称"));
    expect(onWorkspaceRenamed).toHaveBeenCalledWith(renamed);
    expect(screen.getByRole("heading", { name: "新名称" })).toBeTruthy();
    expect(notifyMock).toHaveBeenCalledWith("工作区已重命名");
  });

  it("keeps the rename form open when the new name is blank", () => {
    const renameWorkspace = vi.fn();
    useAppStore.setState({ renameWorkspace });

    render(<WorkspacesPage onOpen={vi.fn()} onWorkspaceRenamed={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "重命名工作区" }));
    fireEvent.change(screen.getByRole("textbox", { name: "工作区名称" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(renameWorkspace).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "工作区名称" })).toBeTruthy();
    expect(notifyMock).toHaveBeenCalledWith("工作区名称不能为空", "error");
  });
});