import { useState } from "react";
import { formatCents, parseAmountToCents, splitInvoice } from "@kwartaal/core";

const VAT_RATES = [21, 9, 0] as const;
type VatRate = (typeof VAT_RATES)[number];

/**
 * The marketing-hero set-aside teaser (docs/design's Home hero references
 * this calculator). Computes live, client-side, via the exact same
 * `splitInvoice` the API's POST /calculator/set-aside route calls — the
 * architecture non-negotiable's "instant client-side preview, persisted
 * result is authoritative" pattern, just with nothing to persist here.
 * Full pixel-faithful Home-page styling lands in Pillar 5; this is the
 * functional widget itself.
 */
export function SetAsideCalculator() {
  const [totalInput, setTotalInput] = useState("2.500,00");
  const [vatRate, setVatRate] = useState<VatRate>(21);
  const [reservePct, setReservePct] = useState(30);

  let totalCents = 0;
  try {
    totalCents = parseAmountToCents(totalInput);
  } catch {
    totalCents = 0;
  }

  const split = splitInvoice(totalCents, vatRate, reservePct * 100);

  return (
    <div className="mt-10 rounded-card border border-border bg-surface p-6 text-left shadow-card">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-faint">
        When an invoice is paid, how much should never feel like yours?
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={totalInput}
          onChange={(event) => setTotalInput(event.target.value)}
          aria-label="Invoice total"
          className="w-32 rounded-control border border-border-strong bg-surface px-3 py-2 text-[15px] font-semibold text-ink"
        />
        {VAT_RATES.map((rate) => (
          <button
            key={rate}
            type="button"
            onClick={() => setVatRate(rate)}
            aria-pressed={vatRate === rate}
            className={[
              "rounded-control border px-3 py-2 text-[13px] font-semibold",
              vatRate === rate
                ? "border-ink bg-ink text-white"
                : "border-border-strong text-ink",
            ].join(" ")}
          >
            {rate}%
          </button>
        ))}
        <label className="ml-2 flex items-center gap-2 text-[13px] text-body">
          Reserve
          <input
            type="number"
            min={0}
            max={100}
            value={reservePct}
            onChange={(event) => setReservePct(Number(event.target.value))}
            aria-label="Reserve percentage"
            className="w-16 rounded-control border border-border-strong bg-surface px-2 py-1.5 text-[13px] font-semibold text-ink"
          />
          %
        </label>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-faint">Yours</div>
          <div className="mt-1 text-lg font-semibold text-ink">
            {formatCents(split.yoursCents)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-faint">Btw</div>
          <div className="mt-1 text-lg font-semibold text-accent">
            {formatCents(split.vatCents)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-faint">Reserve</div>
          <div className="mt-1 text-lg font-semibold text-accent">
            {formatCents(split.reserveCents)}
          </div>
        </div>
      </div>
    </div>
  );
}
