import { describe, expect, it } from "vitest";
import type { DiffExportInput } from "../../src/core/export";
import { generateDiffExport, generateDocumentHtmlExport, highlightSyntaxLine } from "../../src/core/export";

const input: DiffExportInput = {
  title: "订单报文对比",
  leftName: "请求.json",
  rightName: "响应.json",
  leftText: '{\n  "name": "old",\n  "same": true\n}',
  rightText: '{\n  "name": "new",\n  "same": true\n}',
  result: {
    format: "json",
    mode: "semantic",
    changes: [{
      id: "change-name",
      kind: "changed",
      path: "$.name",
      leftType: "string",
      rightType: "string",
      leftValue: "old",
      rightValue: "new",
      message: "值不同",
    }],
    warnings: [],
    durationMs: 1,
    truncated: false,
    leftValid: true,
    rightValid: true,
  },
  options: {
    mode: "semantic",
    ignoreWhitespace: true,
    ignoreCase: false,
    strictTypes: true,
    missingEqualsNull: false,
    ignorePaths: [],
    includePaths: [],
    arrayMode: "sequence",
    arrayKey: "id",
    maxChanges: 500,
  },
};

describe("generateDiffExport", () => {
  it("在 HTML 报告中输出带行号和颜色类的高亮报文", () => {
    const report = generateDiffExport(input, "html");

    expect(report).toContain("高亮报文");
    expect(report).toContain('class="code-line highlight-changed"');
    expect(report).toContain('class="line-no">2</span>');
    expect(report).toContain("新增</span>");
  });

  it("在 Markdown 报告中用 diff 行标记左右差异", () => {
    const report = generateDiffExport(input, "markdown");

    expect(report).toContain("## 高亮对比");
    expect(report).toContain("```diff");
    expect(report).toContain('-   2 |   "name": "old"');
    expect(report).toContain('+   2 |   "name": "new"');
  });

  it("在 CSV 和 JSON 中保留差异位置元数据", () => {
    const csv = generateDiffExport(input, "csv");
    const json = JSON.parse(generateDiffExport(input, "json"));

    expect(csv).toContain('"左侧位置","右侧位置"');
    expect(csv).toContain('"2:11-2:16"');
    expect(json.highlights.left[0]).toMatchObject({ id: "change-name-left", startLineNumber: 2 });
    expect(json.highlights.right[0]).toMatchObject({ id: "change-name-right", startLineNumber: 2 });
  });
});

describe("syntax highlighted export", () => {
  it("highlights JSON keys, values, numbers, and keywords without exposing HTML", () => {
    const highlighted = highlightSyntaxLine('  "name": "<Admin>", "age": 30, "enabled": true', "json");

    expect(highlighted).toContain('class="syntax-key"');
    expect(highlighted).toContain('class="syntax-string"');
    expect(highlighted).toContain('class="syntax-number"');
    expect(highlighted).toContain('class="syntax-keyword"');
    expect(highlighted).toContain("&lt;Admin&gt;");
    expect(highlighted).not.toContain("<Admin>");
  });

  it("highlights XML tags, attributes, and values", () => {
    const highlighted = highlightSyntaxLine('<room id="DLX">688</room>', "xml");

    expect(highlighted).toContain('class="syntax-tag">room</span>');
    expect(highlighted).toContain('class="syntax-attribute">id</span>');
    expect(highlighted).toContain('class="syntax-string">&quot;DLX&quot;</span>');
  });

  it("generates a standalone highlighted HTML payload report", () => {
    const report = generateDocumentHtmlExport({
      title: "request.json - syntax",
      fileName: "request.json",
      text: '{\n  "requestId": "req-1"\n}',
      format: "json",
    });

    expect(report).toContain("<!doctype html>");
    expect(report).toContain('class="line-no">2</span>');
    expect(report).toContain('class="syntax-key"');
    expect(report).toContain("request.json");
  });
});

