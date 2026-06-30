import { describe, it, expect } from "vitest";
import { parseChatIdFromCallback, parseTelegramChatId } from "./parse-id.js";

describe("parseTelegramChatId", () => {
  it("accepts negative supergroup ids", () => {
    expect(parseTelegramChatId("-1001234567890")).toBe(BigInt("-1001234567890"));
  });

  it("rejects non-numeric input", () => {
    expect(parseTelegramChatId("dd")).toBeNull();
    expect(parseTelegramChatId("")).toBeNull();
    expect(parseTelegramChatId("abc-100")).toBeNull();
  });
});

describe("parseChatIdFromCallback", () => {
  it("extracts chat id from callback data", () => {
    expect(parseChatIdFromCallback("adm:g:s:-10099", "adm:g:s:")).toBe(BigInt("-10099"));
  });

  it("returns null for invalid suffix", () => {
    expect(parseChatIdFromCallback("adm:g:s:det", "adm:g:s:")).toBeNull();
  });
});