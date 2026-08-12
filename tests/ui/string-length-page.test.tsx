// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StringLengthPage } from "../../src/pages/StringLengthPage";

const notifyMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/components/Toast", () => ({
  useToast: () => ({ notify: notifyMock }),
}));

afterEach(() => {
  cleanup();
  notifyMock.mockReset();
  vi.restoreAllMocks();
});

describe("StringLengthPage", () => {
  it("shows live statistics for the example and updates after editing", () => {
    render(<StringLengthPage />);

    expect(screen.getByRole("button", { name: "复制 文本总长1（不含换行）: 24" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制 文本总长2（不含换行，不区分全/半角）: 14" })).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "待计算文本" }), { target: { value: "A\n中" } });

    expect(screen.getByRole("button", { name: "复制 文本总长1（不含换行）: 3" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制 半角字符: 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制 总行数: 2" })).toBeTruthy();
  });

  it("copies a clicked statistic", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<StringLengthPage />);

    fireEvent.click(screen.getByRole("button", { name: "复制 文本总长1（不含换行）: 24" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("24"));
    expect(notifyMock).toHaveBeenCalledWith("结果已复制");
  });
});