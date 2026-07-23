import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { SELF } from "cloudflare:test";
import { authedRequest, signUpAndOnboard } from "./helpers";

const ORIGIN = "http://localhost:5173";

/**
 * Definition of Done / plan text: "security pass (headers, authz probing
 * between two seeded orgs, bookkeeper-role mutation probe, webhook forgery,
 * upload content-type bypass attempt)". Cross-org authz and the bookkeeper
 * mutation probe already have their own dedicated files
 * (tenant-isolation.test.ts, bookkeeper-role.test.ts) — this file covers
 * the remaining three, each as a real HTTP request against the live
 * worker, not a unit test of an internal function.
 */
describe("security headers", () => {
  it("every response carries the hono/secure-headers defaults", async () => {
    const res = await SELF.fetch(`${ORIGIN}/health`);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=");
  });
});

describe("webhook forgery", () => {
  // Matches both wrangler.test.toml's [vars] (what CI uses) and
  // apps/api/.dev.vars (what wins locally, gitignored) — see the comment
  // on wrangler.test.toml's STRIPE_WEBHOOK_SECRET for why they must agree.
  const secret = "whsec_local_smoke_test_secret";
  const payload = JSON.stringify({
    id: "evt_probe_123",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_probe_123" } },
  });

  it("rejects a request with no stripe-signature header at all", async () => {
    const res = await SELF.fetch(`${ORIGIN}/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    expect(res.status).toBe(400);
  });

  it("rejects a garbage signature header", async () => {
    const res = await SELF.fetch(`${ORIGIN}/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "t=1,v1=deadbeef",
      },
      body: payload,
    });
    expect(res.status).toBe(400);
  });

  it("rejects a validly-formatted signature signed with the wrong secret", async () => {
    const forgedHeader = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: "whsec_an_attackers_secret",
    });
    const res = await SELF.fetch(`${ORIGIN}/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": forgedHeader },
      body: payload,
    });
    expect(res.status).toBe(400);
  });

  it("rejects a genuinely-signed payload that was tampered with in transit", async () => {
    const header = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
    });
    const tampered = payload.replace("sub_probe_123", "sub_evil_456");
    const res = await SELF.fetch(`${ORIGIN}/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": header },
      body: tampered,
    });
    expect(res.status).toBe(400);
  });

  it("accepts a genuinely-signed, untampered payload — proves the rejections above are real, not a route that 400s on everything", async () => {
    const header = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
    });
    const res = await SELF.fetch(`${ORIGIN}/webhooks/stripe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": header },
      body: payload,
    });
    expect(res.status).toBe(200);
  });
});

describe("receipt upload content-type bypass attempts", () => {
  it("rejects an executable disguised with no content-type", async () => {
    const org = await signUpAndOnboard("upload-bypass-a@example.com");
    const res = await authedRequest(org.cookie, "/receipts", {
      method: "POST",
      headers: { "Content-Type": "" },
      body: new Uint8Array([0x4d, 0x5a, 0x90, 0x00]), // MZ header, a Windows PE executable
    });
    expect(res.status).toBe(415);
  });

  it("rejects a disallowed but plausible-sounding content-type", async () => {
    const org = await signUpAndOnboard("upload-bypass-b@example.com");
    const res = await authedRequest(org.cookie, "/receipts", {
      method: "POST",
      headers: { "Content-Type": "image/svg+xml" }, // SVG can carry inline script — not on the allow-list
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(415);
  });

  it("rejects a content-type that only superficially matches via parameters", async () => {
    const org = await signUpAndOnboard("upload-bypass-c@example.com");
    const res = await authedRequest(org.cookie, "/receipts", {
      method: "POST",
      headers: { "Content-Type": "image/png; charset=binary" }, // exact-match allow-list, no parameter parsing
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(415);
  });

  it("still accepts a genuinely allow-listed content-type — proves the rejections above are real", async () => {
    const org = await signUpAndOnboard("upload-bypass-d@example.com");
    const res = await authedRequest(org.cookie, "/receipts", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(201);
  });
});
