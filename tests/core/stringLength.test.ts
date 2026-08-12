import { describe, expect, it } from "vitest";
import { calculateStringLength } from "../../src/core/stringLength";

describe("calculateStringLength", () => {
  it("matches the documented mixed-width example", () => {
    expect(calculateStringLength("Hi:你好！ 猜猜我有多长？")).toEqual({
      weightedLength: 24,
      characterCount: 14,
      chinese: 8,
      letters: 2,
      numbers: 0,
      spaces: 1,
      halfWidth: 4,
      fullWidth: 2,
      lineBreaks: 0,
      lineCount: 1,
    });
  });

  it("normalizes Windows line breaks and excludes them from both total lengths", () => {
    expect(calculateStringLength("A\r\n中\nＢ")).toEqual({
      weightedLength: 5,
      characterCount: 3,
      chinese: 1,
      letters: 1,
      numbers: 0,
      spaces: 0,
      halfWidth: 3,
      fullWidth: 1,
      lineBreaks: 2,
      lineCount: 3,
    });
  });

  it("distinguishes full-width forms from half-width katakana", () => {
    expect(calculateStringLength("Ａｶ　")).toMatchObject({
      weightedLength: 5,
      characterCount: 3,
      spaces: 1,
      halfWidth: 1,
      fullWidth: 2,
    });
  });

  it("treats an empty input as one empty line", () => {
    expect(calculateStringLength("")).toMatchObject({
      weightedLength: 0,
      characterCount: 0,
      halfWidth: 0,
      lineBreaks: 0,
      lineCount: 1,
    });
  });
});