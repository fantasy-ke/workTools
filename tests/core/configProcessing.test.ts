import { describe, expect, it } from "vitest";
import { apolloToJson, createDelimiterHighlights, jsonToApollo, parseApolloConfig, replaceDelimiter } from "../../src/core/configProcessing";

const APOLLO_SAMPLE = "CITHotelSell:PushOrderWorkStatusUrl = https://b2b-manage-api-test.huitravel.com/v1/workorder/UpdateHopWorkOrderNotify CITHotelSell:PushOrderWorkReplayUrl = https://b2b-manage-api-test.huitravel.com/v1/workorder/HopWorkOrderReplayNotify CITHotelSell:PushOrderWorkReplayDeleteUrl = https://b2b-manage-api-test.huitravel.com/v1/workorder/DeleteHopWorkOrderReplayNotify CITHotelSell:UseNewOrderWorkPushSign = 1";

describe("config processing core", () => {
  it("converts consecutive Apollo assignments into nested JSON", () => {
    const result = apolloToJson(APOLLO_SAMPLE);

    expect(result.entryCount).toBe(4);
    expect(JSON.parse(result.text)).toEqual({
      CITHotelSell: {
        PushOrderWorkStatusUrl: "https://b2b-manage-api-test.huitravel.com/v1/workorder/UpdateHopWorkOrderNotify",
        PushOrderWorkReplayUrl: "https://b2b-manage-api-test.huitravel.com/v1/workorder/HopWorkOrderReplayNotify",
        PushOrderWorkReplayDeleteUrl: "https://b2b-manage-api-test.huitravel.com/v1/workorder/DeleteHopWorkOrderReplayNotify",
        UseNewOrderWorkPushSign: 1,
      },
    });
  });

  it("supports line-based, dotted and colon-value formats with safe type inference", () => {
    expect(parseApolloConfig("Feature.Enabled=true\nFeature.Ratio = 1.5\nFeature.Code = 0012").data).toEqual({ Feature: { Enabled: true, Ratio: 1.5, Code: "0012" } });
    expect(parseApolloConfig("Enabled: false\nName: work tools").data).toEqual({ Enabled: false, Name: "work tools" });
    expect(parseApolloConfig("Url: https://example.test/path?a=1").data).toEqual({ Url: "https://example.test/path?a=1" });
  });

  it("converts nested JSON arrays into indexed Apollo paths", () => {
    const input = JSON.stringify({
      Pkfare: {
        SearchPriceTimeout: 2500,
        PreCheckTimeout: 5000,
        SupplierBookingMinTime: 120000,
        Accounts: [
          {
            SaleChannel: 239,
            ApiKey: "test-api-key=",
            Secret: "test-secret",
            Version: "1",
            Currency: "USD",
          },
          {
            SaleChannel: 491,
            ApiKey: "test-api-key=",
            Secret: "test-secret",
            Version: "1",
            Currency: "USD",
          },
        ],
      },
    });

    const result = jsonToApollo(input, ":");

    expect(result.text).toBe([
      "Pkfare:SearchPriceTimeout=2500",
      "Pkfare:PreCheckTimeout=5000",
      "Pkfare:SupplierBookingMinTime=120000",
      "Pkfare:Accounts:0:SaleChannel=239",
      "Pkfare:Accounts:0:ApiKey=test-api-key=",
      "Pkfare:Accounts:0:Secret=test-secret",
      "Pkfare:Accounts:0:Version=1",
      "Pkfare:Accounts:0:Currency=USD",
      "Pkfare:Accounts:1:SaleChannel=491",
      "Pkfare:Accounts:1:ApiKey=test-api-key=",
      "Pkfare:Accounts:1:Secret=test-secret",
      "Pkfare:Accounts:1:Version=1",
      "Pkfare:Accounts:1:Currency=USD",
    ].join("\n"));
    expect(result.entryCount).toBe(13);
    expect(apolloToJson(result.text).data).toEqual({
      Pkfare: {
        SearchPriceTimeout: 2500,
        PreCheckTimeout: 5000,
        SupplierBookingMinTime: 120000,
        Accounts: [
          {
            SaleChannel: 239,
            ApiKey: "test-api-key=",
            Secret: "test-secret",
            Version: 1,
            Currency: "USD",
          },
          {
            SaleChannel: 491,
            ApiKey: "test-api-key=",
            Secret: "test-secret",
            Version: 1,
            Currency: "USD",
          },
        ],
      },
    });
  });

  it("supports dotted paths and preserves structured-looking strings", () => {
    expect(jsonToApollo('{"A":{"B":1}}', ".").text).toBe("A.B=1");
    expect(jsonToApollo('{"Value":"[1,2]"}').text).toBe('Value="[1,2]"');
    expect(() => jsonToApollo('{"A:B":1}')).toThrow("JSON 字段名包含层级分隔符");
    expect(() => jsonToApollo('{"A.B":1}')).toThrow("JSON 字段名包含层级分隔符");
  });

  it("rejects duplicate and conflicting paths", () => {
    expect(() => apolloToJson("A:B = 1\nA:B = 2")).toThrow("配置键重复");
    expect(() => apolloToJson("A = 1\nA:B = 2")).toThrow("配置路径发生冲突");
  });

  it("replaces delimiters and reports highlight ranges", () => {
    const result = replaceDelimiter("250_0,268_0,354_0", ",", "|");
    expect(result).toMatchObject({ text: "250_0|268_0|354_0", count: 2, source: ",", target: "|" });

    const highlights = createDelimiterHighlights("250_0,268_0,354_0", ",", "待替换符号");
    expect(highlights).toHaveLength(2);
    expect(highlights[0]).toMatchObject({ startLineNumber: 1, startColumn: 6, endColumn: 7, wholeLine: false });
  });

  it("supports visible newline, tab and space tokens", () => {
    expect(replaceDelimiter("a;b", ";", "\\n").text).toBe("a\nb");
    expect(replaceDelimiter("a\tb", "\\t", ",").text).toBe("a,b");
    expect(replaceDelimiter("a b", "space", "|").text).toBe("a|b");
  });
});
