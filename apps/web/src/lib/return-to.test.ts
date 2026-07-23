import { describe, expect, it } from "vitest";
import { sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("accepts a same-origin relative path", () => {
    expect(sanitizeReturnTo("/app/vault")).toBe("/app/vault");
    expect(sanitizeReturnTo("/app/vault?tab=receipts")).toBe("/app/vault?tab=receipts");
  });

  it("falls back for missing/empty input", () => {
    expect(sanitizeReturnTo(null)).toBe("/app");
    expect(sanitizeReturnTo(undefined)).toBe("/app");
    expect(sanitizeReturnTo("")).toBe("/app");
    expect(sanitizeReturnTo(null, "/custom-fallback")).toBe("/custom-fallback");
  });

  it("rejects absolute URLs (open-redirect attempt)", () => {
    expect(sanitizeReturnTo("https://evil.example/phish")).toBe("/app");
    expect(sanitizeReturnTo("http://evil.example")).toBe("/app");
  });

  it("rejects protocol-relative URLs (open-redirect attempt)", () => {
    expect(sanitizeReturnTo("//evil.example/phish")).toBe("/app");
  });

  it("rejects values embedding a scheme past the leading slash", () => {
    expect(sanitizeReturnTo("/redirect?to=https://evil.example")).toBe("/app");
  });

  it("rejects values with whitespace or backslash tricks", () => {
    expect(sanitizeReturnTo("/\\evil.example")).toBe("/app");
    expect(sanitizeReturnTo("/app vault")).toBe("/app");
  });

  it("rejects bare (non-rooted) paths", () => {
    expect(sanitizeReturnTo("app/vault")).toBe("/app");
  });
});
