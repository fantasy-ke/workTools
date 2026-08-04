// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../../src/pages/HomePage";
import { useAppStore } from "../../src/store/appStore";

afterEach(cleanup);

describe("HomePage section order", () => {
  it("shows recent workspaces and files before common tools", () => {
    useAppStore.setState({ workspaces: [], recentFiles: [] });
    render(<HomePage onNavigate={vi.fn()} onOpenWorkspace={vi.fn()} />);

    const sectionTitles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

    expect(sectionTitles).toEqual(["\u6700\u8fd1\u5de5\u4f5c\u533a", "\u6700\u8fd1\u6587\u4ef6", "\u5e38\u7528\u5de5\u5177"]);
  });
});
