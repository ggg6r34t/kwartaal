# Rounding convention

Money is integer cents everywhere in Kwartaal — never a float, never persisted
as one. This document is the single place that says how a fractional-cent
result gets to an integer, so every engine function in `packages/core/src/tax`
follows the same rule instead of each inventing its own.

## The rule: half rounds up, at the smallest unit that appears on a form

Kwartaal rounds **half away from zero** (`Math.round` in JS, which for the
positive amounts this domain deals in is equivalent to commercial rounding —
"rekenkundig afronden" — the convention actually used on Dutch tax forms and
invoices). This is applied via two small helpers in
`packages/core/src/tax/rounding.ts`:

- `vatCentsForRate(amountExVatCents, ratePercent)` — one invoice/expense
  line's VAT, rounded to the nearest cent.
- `bpsOfCents(amountCents, rateBps)` — any basis-points rate applied to a
  cents amount (MKB-winstvrijstelling, Zvw, bracket tax, arbeidskorting
  bands), rounded to the nearest cent.

## Round per line, not per total

The critical rule, and the one that actually matters for correctness:
**VAT is rounded once per line, and rubriek totals are the sum of those
already-rounded per-line amounts** — never re-rounded from an unrounded
sum. This mirrors how a real invoice works (each line shows its own rounded
VAT; the invoice total is just addition) and avoids cumulative rounding
drift between "sum then round" and "round then sum", which can differ by a
cent or two on a quarter with many lines.

`computeQuarter` follows this exactly: `perLineVatCents` holds each line's
already-rounded VAT, and rubriek 1a/1b/5b are sums of those values, not of
raw `amountExVatCents * rate` products.

## Exact-sum splits: compute the residual, don't round independently

Some outputs must sum to an exact total by construction — `splitInvoice`'s
three bands (`yours` + `vat` + `reserve`) must equal the invoice total to the
cent, always (this is a tested property, see `splitter.test.ts`). Rounding
each band independently can't guarantee that. Instead: round the bands that
have a natural rate-based rounding (`vat`, `reserve`), then compute the last
band (`yours`) as the **residual** — `total - vat - reserve` — never its own
independent rounding. The same pattern applies to
`buildDepreciationSchedule`'s final year, which takes whatever remains of
the depreciable base rather than its own rounded share, so the schedule
always sums to exactly `cost - residual`.

## Deduction waterfall and income tax

- `computeWaterfall`'s fixed-amount steps (zelfstandigenaftrek,
  startersaftrek) are already whole-cent constants from the `TaxFigures`
  registry — no rounding needed. The MKB-winstvrijstelling step is a
  basis-points rate applied to whatever remains, via `bpsOfCents`.
- `estimateIncomeTax`'s bracket tax, Zvw, and arbeidskorting bands are each
  `bpsOfCents` on their own cents amount, summed.

## What's *not* pinned by a golden fixture

KWARTAAL-BUILD-PLAN.md's locked decision #4 states the waterfall's taxable
figure as "±€51.660" — the `±` is the plan's own acknowledgment that this
number depends on rounding convention and wasn't meant as an exact pin.
Given the rule above, this implementation computes **€51.661,52** exactly
(5.917.700 cents remaining after the fixed deductions, less 12,7%
MKB-winstvrijstelling of 751.548 cents) — see `waterfall.test.ts`, which
pins this exact figure as the golden value going forward. The three
preceding steps (62.500 → 61.300 → 59.177) are exact golden fixtures with
no rounding ambiguity and are asserted to the cent.
