import type {
  ExpenseLineInput,
  IncomeLineInput,
  TaxFigures,
  WaterfallInput,
} from "./types";

/**
 * The Maya persona (KWARTAAL-BUILD-PLAN.md locked decision #4) — the
 * canonical golden fixture data. `packages/db/seed.sql` seeds the same
 * numbers into D1 by hand (see its own header comment for the reconciled
 * per-line breakdown); this module is the single TS source the engine's
 * golden tests pin against, so the two can never silently drift without a
 * test failing.
 */

export const MAYA_TAX_FIGURES_2026: TaxFigures = {
  year: 2026,
  // Brackets / Zvw / heffingskorting / arbeidskorting: 2025-based
  // placeholders, not specified by any golden fixture in the plan — see
  // PROGRESS.md Pillar 1, deviation #1.
  brackets: [
    { uptoCents: 3844100, rateBps: 3582 },
    { uptoCents: 7681700, rateBps: 3748 },
    { uptoCents: null, rateBps: 4950 },
  ],
  zelfstandigenaftrekCents: 120000, // €1.200,00 — golden
  startersaftrekCents: 212300, // €2.123,00 — golden
  mkbVrijstellingBps: 1270, // 12,7% — golden
  zvwBps: 526,
  korLimitCents: 2000000, // €20.000,00 — golden
  algemeneHeffingskortingMaxCents: 336200,
  arbeidskortingTable: [
    { fromCents: 0, toCents: 1200000, rateBps: 800 },
    { fromCents: 1200000, toCents: 2500000, rateBps: 3000 },
    { fromCents: 2500000, toCents: null, rateBps: 0 },
  ],
};

/**
 * Q3: income sums to €20.000,00 ex btw / €4.140,00 btw, split rubriek 1a
 * €4.095,00 (21% line) + 1b €45,00 (9% line) — matches locked decision #4's
 * combined "€4.140" figure exactly.
 */
export const MAYA_Q3_INCOME_LINES: IncomeLineInput[] = [
  { amountExVatCents: 1950000, vatRate: 21 }, // €19.500,00 @ 21% -> €4.095,00
  { amountExVatCents: 50000, vatRate: 9 }, // €500,00 @ 9% -> €45,00
];

/** Expenses sum to €610,00 reclaimable btw (rubriek 5b) — golden. */
export const MAYA_Q3_EXPENSE_LINES: ExpenseLineInput[] = [
  { amountExVatCents: 250000, vatRate: 21, vatReclaimable: true }, // €2.500,00 @ 21% -> €525,00
  { amountExVatCents: 94444, vatRate: 9, vatReclaimable: true }, // €944,44 @ 9% -> €85,00
];

/** 62.500 -> 61.300 -> 59.177 -> taxable (golden through 59.177; see waterfall.test.ts for the taxable-figure note). */
export const MAYA_WATERFALL_INPUT: WaterfallInput = {
  profitCents: 6250000, // €62.500,00
  hoursLogged: 1230, // meets the 1.225 urencriterium
  startersaftrekUsedCount: 1, // used 1 of 3
  kvkRegisteredAt: "2026-01-15",
  asOfYear: 2026,
};
