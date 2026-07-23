import { describe, expect, it } from "vitest";
import { parseTrustedOrigins } from "./origins";

describe("parseTrustedOrigins", () => {
  it("falls back to localhost when nothing is set", () => {
    expect(parseTrustedOrigins(undefined, undefined)).toEqual([
      "http://localhost:5173",
      "http://localhost:8787",
    ]);
  });

  it("splits comma-separated origins and trims whitespace", () => {
    expect(
      parseTrustedOrigins("https://kwartaal.example, https://kwartaal.example.pages.dev"),
    ).toEqual(["https://kwartaal.example", "https://kwartaal.example.pages.dev"]);
  });

  it("merges multiple source vars", () => {
    expect(parseTrustedOrigins("https://a.example", "https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});
