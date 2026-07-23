import { describe, expect, it } from "vitest";
import Stripe from "stripe";

/**
 * Exercises the exact SDK call the route makes (constructEventAsync +
 * createSubtleCryptoProvider — the edge-runtime-safe pair, not the
 * Node-crypto sync constructEvent) against Stripe's own test-header
 * generator. No live Stripe account or DB needed — this is pure crypto,
 * and it's the one piece of the webhook path that doesn't require the D1
 * test harness the rest of the route depends on (see PROGRESS.md).
 */
describe("Stripe webhook signature verification", () => {
  const secret = "whsec_test_secret_for_kwartaal";
  const payload = JSON.stringify({
    id: "evt_test_123",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_test_123" } },
  });

  it("accepts a correctly signed payload", async () => {
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
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
    const header = Stripe.webhooks.generateTestHeaderString({
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
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
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
