import { useState } from "react";
import type { BillingInterval, CheckoutSessionResponse } from "@kwartaal/core";
import { apiFetch, ApiError } from "../lib/api";

/**
 * Reactive, not preemptive: fires on any 402 from requireProForMutations
 * (see lib/api.ts's onEntitlementRequired hook and AppShell.tsx's wiring),
 * matching the design's "no urgency mechanics" rule — it appears when a
 * gated action is actually attempted, never as a countdown or a blocked
 * button. Ported from docs/design's "Paywall interstitial" (Kwartaal App
 * Additions.dc.html) — copy adapted to be state-generic rather than
 * hard-coding "Q3", since this can fire on any gated mutation after the
 * trial closes, not only the drawer-close moment itself.
 */
export function PaywallInterstitial({ onDismiss }: { onDismiss: () => void }) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("annual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueWithPro() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<CheckoutSessionResponse>(
        "/billing/checkout-session",
        {
          method: "POST",
          body: JSON.stringify({ interval: billingInterval }),
        },
      );
      window.location.href = url;
    } catch (err) {
      if (err instanceof ApiError && err.code === "billing-not-configured") {
        setError("Billing isn't set up yet — check back soon.");
      } else {
        setError("Couldn't start checkout. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Continue with Kwartaal Pro"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay-scrim px-4 py-12"
    >
      <div className="animate-drawer-settle w-full max-w-[560px] rounded-card border border-border bg-paper p-9 shadow-dialog">
        <div className="mb-5 flex items-center gap-3.5">
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-state-settled text-white">
            ✓
          </span>
          <div>
            <div className="text-xl font-semibold tracking-tight">
              Your free quarter is complete.
            </div>
            <div className="mt-0.5 text-[13px] text-body">
              That trial covered one full VAT loop, start to finish.
            </div>
          </div>
        </div>
        <p className="mb-5 font-explainer text-[15.5px] italic leading-relaxed text-body">
          That feeling — knowing exactly what you owed and why — is what Kwartaal is for.
          Here's what keeps going on Pro:
        </p>
        <div className="mb-5 flex flex-col gap-2.5 text-sm">
          <PaywallPoint title="The next quarter's checklist">
            Same guided 25 minutes, every quarter
          </PaywallPoint>
          <PaywallPoint title="The annual studio">
            Your income tax, walked through before the deadline
          </PaywallPoint>
          <PaywallPoint title="The Vault">
            Receipts checked and kept, quarter after quarter
          </PaywallPoint>
        </div>

        <div className="mb-5 rounded-card border border-border bg-surface p-5">
          <div className="mb-3 flex gap-1.5">
            <button
              type="button"
              onClick={() => setBillingInterval("annual")}
              className={`rounded-control px-3 py-1.5 text-[12.5px] font-semibold ${
                billingInterval === "annual"
                  ? "bg-ink text-white"
                  : "border border-border-strong text-ink"
              }`}
            >
              Yearly
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("monthly")}
              className={`rounded-control px-3 py-1.5 text-[12.5px] font-semibold ${
                billingInterval === "monthly"
                  ? "bg-ink text-white"
                  : "border border-border-strong text-ink"
              }`}
            >
              Monthly
            </button>
          </div>
          {billingInterval === "annual" ? (
            <div className="flex items-baseline gap-2.5">
              <span className="text-[30px] font-semibold tracking-tight">€10</span>
              <span className="text-[13px] text-body">/month · billed yearly (€120)</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2.5">
              <span className="text-[30px] font-semibold tracking-tight">€12</span>
              <span className="text-[13px] text-body">/month, cancel any time</span>
            </div>
          )}
          <div className="mt-1 text-xs text-faint">
            Deductible, btw reclaimable — most ZZP'ers effectively pay around €6–7/mo.
          </div>
        </div>

        <button
          type="button"
          onClick={() => void continueWithPro()}
          disabled={busy}
          className="w-full rounded-control bg-accent py-3.5 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Continue with Pro
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2.5 w-full rounded-control border border-border-strong py-3 text-sm font-semibold text-ink hover:bg-wash"
        >
          Not now — keep my calendar and reminders free
        </button>
        {error && <p className="mt-3 text-center text-xs text-state-overdue">{error}</p>}
        <p className="mt-3.5 text-center text-xs leading-relaxed text-faint">
          Either way, everything from your trial stays readable and exportable, always.
        </p>
      </div>
    </div>
  );
}

function PaywallPoint({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span aria-hidden="true" className="font-bold text-state-settled">
        ✓
      </span>
      <span>
        <strong>{title}</strong> <span className="text-body">— {children}</span>
      </span>
    </div>
  );
}
