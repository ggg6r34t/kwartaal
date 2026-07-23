import { describe, expect, it } from "vitest";
import Stripe from "stripe";

/**
 * Exercises the exact SDK call the route makes (constructEventAsync +
 * createSubtleCryptoProvider — the edge-runtime-safe pair, not the
 * Node-crypto sync constructEvent) against Stripe's own test-header
 * generator. Runs under real workerd since Pillar 6 (vitest.config.ts) —
 * that's what caught a real bug in this test: `generateTestHeaderString`'s
 * sync HMAC path only exists because Node's SubtleCryptoProvider has a
 * sync fallback; real workerd's `crypto.subtle` is async-only, so the sync
 * helper throws there and `generateTestHeaderStringAsync` is required —
 * the equivalent of what production already used `constructEventAsync`
 * for. No live Stripe account needed — this is pure crypto.
 */
describe("Stripe webhook signature verification", () => {
  const secret = "whsec_test_secret_for_kwartaal";
  const payload = JSON.stringify({
    id: "evt_test_123",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_test_123" } },
  });

  it("accepts a correctly signed payload", async () => {
    const header = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
    });
    const event = await Stripe.webhooks.constructEventAsync(
      payload,
      header,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
    expect(event.id).toBe("evt_test_123");
    expect(event.type).toBe("customer.subscription.updated");
  });

  it("rejects a payload signed with the wrong secret", async () => {
    const header = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret: "whsec_a_different_secret",
    });
    await expect(
      Stripe.webhooks.constructEventAsync(
        payload,
        header,
        secret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      ),
    ).rejects.toThrow();
  });

  it("rejects a tampered payload even with a validly-formatted header", async () => {
    const header = await Stripe.webhooks.generateTestHeaderStringAsync({
      payload,
      secret,
    });
    const tamperedPayload = payload.replace("sub_test_123", "sub_evil_456");
    await expect(
      Stripe.webhooks.constructEventAsync(
        tamperedPayload,
        header,
        secret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      ),
    ).rejects.toThrow();
  });
});
