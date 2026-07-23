import { afterEach, describe, expect, it, vi } from "vitest";
import type { Bindings } from "../bindings";
import { sendEmail } from "./resend";

function makeEnv(overrides: Partial<Bindings>): Bindings {
  return {
    ENVIRONMENT: "production",
    EMAIL_FROM: "Kwartaal <no-reply@send.kwartaal.example>",
    RESEND_API_KEY: "re_test_key",
    ...overrides,
  } as Bindings;
}

/**
 * Environment topology hard rule (PROGRESS.md's "Environment" section):
 * staging runs the real reminder pipeline against real org data but must
 * never deliver email to an address not on EMAIL_ALLOWLIST — production
 * has no such gate. This is the required test proving the staging config
 * genuinely cannot send to a non-allowlisted address, not just a claim.
 */
describe("sendEmail — staging recipient allow-list", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never calls Resend for a staging recipient not on the allow-list", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const env = makeEnv({ ENVIRONMENT: "staging", EMAIL_ALLOWLIST: "owner@example.com" });

    await sendEmail(env, {
      to: "someone-else@example.com",
      subject: "x",
      html: "<p>x</p>",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends for real to a staging recipient that IS on the allow-list (case/whitespace-insensitive)", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const env = makeEnv({
      ENVIRONMENT: "staging",
      EMAIL_ALLOWLIST: "owner@example.com, Other@Example.com ",
    });

    await sendEmail(env, { to: "other@example.com", subject: "x", html: "<p>x</p>" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("staging with no allow-list configured blocks everything — fail closed, not fail open", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const env = makeEnv({ ENVIRONMENT: "staging", EMAIL_ALLOWLIST: undefined });

    await sendEmail(env, { to: "owner@example.com", subject: "x", html: "<p>x</p>" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("production has no allow-list — sends regardless of EMAIL_ALLOWLIST", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    const env = makeEnv({
      ENVIRONMENT: "production",
      EMAIL_ALLOWLIST: "only-this@example.com",
    });

    await sendEmail(env, { to: "anyone@example.com", subject: "x", html: "<p>x</p>" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
