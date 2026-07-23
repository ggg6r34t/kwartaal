import Stripe from "stripe";
import type { Bindings } from "../bindings";

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("STRIPE_SECRET_KEY is not configured — billing is unavailable");
  }
}

/**
 * No safe fallback exists for a payments secret (unlike BETTER_AUTH_SECRET's
 * dev-insecure default) — a missing key means billing routes degrade to a
 * typed 503, never a fake Stripe client. No live Stripe account exists yet
 * (see PROGRESS.md, BLOCKED); every call site must handle this.
 */
export function getStripeClient(env: Bindings): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new BillingNotConfiguredError();
  // apiVersion omitted deliberately — defaults to the installed SDK's own
  // pinned version rather than a hand-typed string that could drift from it.
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}
