# Tax figures — the yearly-update procedure

`tax_figures` (`packages/db/src/schema.ts`) is the single source every tax
calculation reads from — brackets, deductions, rates. It's global reference
data (`.global`-only, not org-scoped) with one row per calendar year, keyed
by `year`. **No tax-figure value is ever edited in place.** A new tax year
means a new row; last year's row stays exactly as it was, forever, so a
quarter or return computed under 2026 figures keeps producing the same
numbers if re-viewed in 2028.

## The row

| Column | What it holds |
| --- | --- |
| `year` | Primary key. |
| `brackets_json` | Income-tax brackets: `[{ uptoCents, rateBps }]`, last entry's `uptoCents` is `null` (open-ended top bracket). |
| `zelfstandigenaftrek_cents` | Self-employed deduction, flat amount. |
| `startersaftrek_cents` | Starter's extra deduction, flat amount, usable up to 3 times in the first 5 years. |
| `mkb_vrijstelling_bps` | MKB-winstvrijstelling — basis points knocked off remaining profit after the above deductions. |
| `zvw_bps` | Zorgverzekeringswet contribution rate, basis points. |
| `kor_limit_cents` | KOR (small-business scheme) turnover ceiling. |
| `algemene_heffingskorting_max_cents` | Max general tax credit. |
| `arbeidskorting_table_json` | Labor tax credit bands: `[{ fromCents, toCents, rateBps }]`. |

`packages/core/src/contracts/tax-figures.ts` has the TypeScript shape these
columns deserialize to; `packages/core/src/tax/waterfall.ts` and
`estimate-income-tax.ts` are the only code that reads them.

## Current state: 2026 is a placeholder

`packages/db/seed.sql` seeds a 2026 row using **2025's published rates**
(zvw_bps, algemene_heffingskorting_max_cents) mixed with the plan's locked
figures (zelfstandigenaftrek, startersaftrek, mkb_vrijstelling, KOR limit —
locked decision #4). This was necessary because official 2026 figures
weren't published when this was written. **No golden test depends on the
placeholder values** — `waterfall.test.ts` and the Q3 rubriek goldens pin
inputs and rounding behavior, not the zvw/heffingskorting numbers
specifically (see `docs/rounding.md` for exactly what is and isn't pinned).

Before a real production launch in any tax year, replace this row's
placeholder fields with the Belastingdienst's actually-published figures for
that year.

## Adding a new year (the actual procedure)

1. **Never touch the existing row.** Confirm no migration or seed script
   does an `UPDATE tax_figures SET ... WHERE year = <existing>`.
2. Get the official published figures for the new year (Belastingdienst /
   Rijksoverheid rate tables) — brackets, zelfstandigenaftrek,
   startersaftrek, mkb-vrijstelling, Zvw rate, KOR limit, algemene
   heffingskorting max, arbeidskorting bands.
3. Insert a new row, one INSERT, all columns populated — either a new
   Drizzle migration (for production, so it's tracked and repeatable) or
   `wrangler d1 execute <db> --command "INSERT INTO tax_figures (...) VALUES (...)"`
   for a one-off. Match the JSON shapes in the table above exactly — a
   malformed `brackets_json`/`arbeidskorting_table_json` fails at read time
   in `packages/core`, not at insert time (D1 doesn't validate JSON column
   contents).
4. Every org's `tax_year_profiles` row for that year needs
   `tax_figures_year` pointing at the new row (FK-enforced — inserting a
   `tax_year_profiles` row before the matching `tax_figures` row exists
   fails outright, which is the intended guard rail).
5. Add a golden-fixture test if the plan calls for one that year (it did
   for 2026's Maya waterfall); otherwise the existing `waterfall.test.ts`
   structure (pin inputs, assert exact cents) is the template to copy.
6. Update this file's "Current state" section to describe the new year
   instead of leaving it to rot.

## Why this matters more than a normal reference-data update

Every screen that shows a computed tax number renders its tax-year tag
(Definition of Done: "every computed total renders its tax-year tag") —
that tag is meaningless if the underlying `tax_figures` row for that year
could silently change after the fact. Immutability here is what makes a
screenshot, an exported PDF, or a number a user already typed into Mijn
Belastingdienst stay correct in hindsight.
