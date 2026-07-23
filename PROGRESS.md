# Progress — Kwartaal build

## Pillar 1: Foundations — complete

Full gate green, including a live end-to-end smoke test (real login with the
seeded Maya credentials → real tenant-scoped API response).

### What's done

**Monorepo & tooling**

- npm workspaces (`packages/core`, `packages/db`, `apps/api`, `apps/web`), root
  `tsconfig.base.json` copied per blueprint §1, `.node-version` (22.18.0).
- ESLint 9 flat config (`eslint.config.js`) + Prettier, both passing clean.
- `scripts/token-discipline-check.mjs` — greps `apps/web/src` (excluding
  `theme.css`) for raw color values / `var()`-arbitrary Tailwind classes per
  CLAUDE.md item 7. **0 violations, 0 exceptions.**
- `.github/workflows/ci.yml` — checkout → setup-node → `npm ci` → typecheck →
  test → lint → format:check → token-check → `build:web` →
  `wrangler deploy --dry-run`.

**Cloudflare resources (self-provisioned via authenticated wrangler CLI)**

- D1: `kwartaal` (dev), `kwartaal-staging`, `kwartaal-production` — all real,
  region WEUR.
- R2: `kwartaal-storage`, `kwartaal-backups` — dev only. Staging/production
  buckets are **placeholder names** in `wrangler.toml`
  (`REPLACE_WITH_STAGING_R2_BUCKET` etc.) — create the real ones before
  Pillar 4 (R2 receipt/export use) exercises those environments.
- Queues: `kwartaal-reminders`, `kwartaal-exports` — dev only, same
  placeholder pattern for staging/production, needed before Pillar 3.
- Confirmed the account supports Queues (creation succeeded), resolving the
  Workers-Paid-plan uncertainty flagged in preflight.
- `wrangler.toml` has explicit `[env.staging]` and `[env.production]` blocks
  (non-negotiable — never let staging double as prod) with D1 real, R2/Queues
  placeholder, Browser Rendering and Cron declared in all three environments.

**Data layer**

- `packages/db/src/schema.ts` — all 24 app tables from the plan's data model
  section, plus Better Auth's 4 tables in `auth-schema.ts`. Timestamp split
  documented in a schema banner: instants as integer epoch (`$onUpdate`
  maintained), calendar dates as `text` ISO `YYYY-MM-DD`.
- `packages/db/src/tenant.ts` — `TenantDb`/`forOrg`, `TENANT_TABLE_NAMES`
  registry (20 tables), `.global` escape hatch. A test (`tenant.test.ts`)
  asserts the registry stays in sync with every `org_id`-bearing table in the
  schema, and that the guard throws for unregistered tables (including
  `orgs` itself, the tenant root).
- ESLint rule (`apps/api/src/routes/**`) bans importing raw `Database`/
  `createDb` from `@kwartaal/db` — route modules only ever get a `TenantDb`
  via `c.get("tenantDb")`.
- Migration `0000_shiny_tyger_tiger.sql` generated via `drizzle-kit generate`
  and applied to local D1 — verified.
- `packages/db/seed.sql` — deterministic Maya demo seed, **hand-written SQL**
  rather than the blueprint's TS→SQL generator pipeline. Applied to local D1
  and verified: Q3's rubriek numbers (1a €4.095,00 / 1b €45,00 / 5b €610,00)
  reconcile exactly to locked decision #4's golden figures via `SUM()`
  queries against the seeded income/expense lines.

**API (`apps/api`)**

- Hono composition matching blueprint's middleware order:
  `requestId → secureHeaders → cors → withDb → accessLog → [rateLimit on auth] → csrfGuard → requireSession → requireRole`.
- Better Auth: **open** self-serve signup on both email/password and magic
  link (blueprint's closed-signup inverted per locked decision #1); org +
  BusinessProfile + `users` membership row auto-provisioned via
  `databaseHooks.user.create.after`.
- CORS locked to `APP_ORIGIN`/`BETTER_AUTH_URL` (fixes §11.9, not bare
  `cors()`). CSRF via `hono/csrf` on `/orgs/*`, not on `/api/auth/*`.
- `lib/crypto.ts` (AES-256-GCM, copied per blueprint) + `lib/secrets.ts`
  (upsert-and-encrypt / decrypt, org-scoped via TenantDb).
- `lib/audit.ts` — populates `ip` and `meta` (fixes blueprint's unpopulated
  columns).
- `middleware/rate-limit.ts` — D1 fixed-window factory, wired to
  `/api/auth/*` (20/60s) and (as of Pillar 2) `/calculator/*`.
- `lib/logger.ts` (structured JSON) + `lib/sentry.ts` (minimal hand-rolled
  Store-API reporter, no SDK dependency) — degrades to
  console.error/`wrangler tail` when `SENTRY_DSN` is unset. No DSN provided
  yet.
- `routes/health.ts` (liveness + `SELECT 1` readiness) and `routes/orgs.ts`
  (`GET /orgs/me`, response validated through the Zod `meResponseSchema`).
- `queue.ts` / `scheduled.ts` — handlers exist and ack/log correctly; the
  actual reminder fan-out and export-build logic is Pillar 3/4 (needs
  Deadline materialization first).

**Web (`apps/web`)**

- Vite + React 18 + react-router-dom, self-contained tsconfig (not extending
  base, per blueprint §9).
- `src/theme.css` — the single token source, every value taken from
  `docs/design`'s canonical "Color" component sheet.
- `tailwind.config.js` — every token mapped to a semantic utility.
- App shell (`app/AppShell.tsx`), data-driven nav, `RequireAuth`, `TermChip`,
  `StateSwitcher` (dev-only, `import.meta.env.DEV`-gated).
- Same-origin proxy pair verified matching: `functions/api/[[path]].ts`
  (Pages Function) and `vite.config.ts`'s dev proxy both strip `/api` except
  `/api/auth`.
- Placeholder routes for Today/VAT/Income tax/Money/Vault/Glossary/Settings
  (pixel screens are Pillar 3-5) and a functional `SignIn` page wired to the
  real `better-auth/react` client.

### Gate results

| Check                              | Result                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` (4 workspaces) | ✅                                                                                                                                                                                  |
| `npm test` (32 tests)              | ✅                                                                                                                                                                                  |
| `npm run lint`                     | ✅                                                                                                                                                                                  |
| `npm run format:check`             | ✅                                                                                                                                                                                  |
| `npm run token-check`              | ✅ 0 violations, 0 exceptions                                                                                                                                                       |
| `npm run build:web`                | ✅                                                                                                                                                                                  |
| `wrangler deploy --dry-run` (API)  | ✅                                                                                                                                                                                  |
| Live smoke test                    | ✅ `wrangler dev` boot → `/health` → `/health/ready` → `POST /api/auth/sign-in/email` with seeded Maya credentials → `GET /orgs/me` returns real org/BusinessProfile, tenant-scoped |

Demo login: `maya@kwartaal-demo.example` / `kwartaal-demo-2026`.

### Deviations from a literal reading of the plan

1. **TaxFigures 2026 non-golden fields are placeholders.**
   `zelfstandigenaftrekCents`, `startersaftrekCents`, `mkbVrijstellingBps` are
   locked decision #4's verbatim numbers. Brackets, Zvw rate, algemene
   heffingskorting max, and the arbeidskorting table are **not specified
   anywhere in the plan** — seeded from the best-available published (2025)
   rates as a clearly-commented placeholder. Must be verified against real
   2026 publication before `docs/tax-figures.md` (Pillar 6) or any UI shows a
   tax _owed_ number built from brackets/credits.
2. **The €72.000 turnover / €9.500 costs annual figures are treated as
   Maya's projected full-year onboarding input** — confirmed in Pillar 2:
   `computeWaterfall`'s golden test takes `profitCents: 6250000` directly as
   a standalone input (see `maya-fixtures.ts`), independent of the seeded
   Q1–Q3 quarterly lines (which total €52.000 turnover to date, since Q4
   hasn't happened in the story). This resolved cleanly — no conflict found.
3. **`seed.sql` is hand-written SQL**, not generated via a TS
   `gen-seed-sql.mts` + in-memory-D1-shim pipeline. Satisfies the actual
   requirement (deterministic, committed, diffable, re-applies
   byte-identical) without the extra generator machinery.
4. **Q3 is seeded `in_progress`** with real income/expense lines but NULL
   `rubriek_*_cents` on the `quarters` row — those columns are
   "engine-computed, persisted at close," and Q3 hasn't closed in the story
   yet. Pillar 3 closes it through the real engine + checklist flow.
5. **`apps/web/functions/api/[[path]].ts` is excluded from the TS project
   graph** (Node vite.config.ts vs Workers Pages-Function types conflict).
   Unmodified from the blueprint's proven pattern, 6 lines, low risk.
6. **`apps/web`'s `build` script is a plain `tsc -b && vite build`**, not the
   SSG-prerender pipeline — that machinery is genuinely Pillar 5 work.

---

## Pillar 2: Tax engine — complete

All seven pure functions from the plan's "Tax + deadline engine" section,
golden tests pinned to the Maya fixtures, property tests, `docs/rounding.md`,
the public set-aside calculator endpoint, and the marketing-hero preview
wired to the same function. Full gate green including a live smoke test.

### What's done

**`packages/core/src/tax/`** — all pure, framework-free, exhaustively tested:

- **`rounding.ts`** — `roundHalfUp`, `vatCentsForRate`, `bpsOfCents`. Every
  other function routes its fractional-cent results through these two, so
  the convention lives in one place. Documented in full in `docs/rounding.md`,
  including the "round per line, sum already-rounded amounts" rule and the
  "compute the residual, don't round independently" rule that guarantees
  exact-sum outputs.
- **`dates.ts`** — `amsterdamDateString`, `daysUntilDue`. Derives "today" as
  Amsterdam's own calendar date via `Intl.DateTimeFormat` before doing
  calendar-day (not millisecond) arithmetic, specifically to avoid the
  DST-crossing off-by-one the plan calls out by name. Tested across both
  2026 DST transition days (spring-forward 29 Mar, fall-back 25 Oct).
- **`vat.ts` — `computeQuarter`.** rubriek 1a (21%) / 1b (9%) / 5b
  (voorbelasting) / 5c (owed). **Golden**: Maya's Q3 fixture reproduces
  1a=€4.095,00, 1b=€45,00, 5b=€610,00, 5c=€3.530,00 exactly. Property test:
  5c = 1a+1b−5b holds across 100 randomized line sets. Exempt and 0% lines
  proven to contribute zero VAT on both income and expense sides.
- **`kor.ts` — `korRollingTurnover`.** Calendar-year-to-date sum (matches the
  design's "Rolling turnover · calendar year 2026" framing, not a true
  365-day rolling window). 80%/100% threshold flags tested at the exact
  boundary.
- **`waterfall.ts` — `computeWaterfall`.** **Golden**: 62.500 → 61.300 →
  59.177 exactly (locked decision #4). The final taxable figure is pinned at
  **€51.661,52** — the plan's own "±€51.660" was explicitly approximate; see
  `docs/rounding.md`'s closing section for the reconciliation. Eligibility
  gates tested individually: urencriterium (1.225h), startersaftrek
  (used-count < 3 AND within 5 years of KVK registration, both checked),
  MKB-winstvrijstelling has no gate. Property test: the running total never
  goes negative across 200 randomized inputs including negative profit.
- **`income-tax.ts` — `estimateIncomeTax`.** Per-bracket fill (feeds the
  vessels visual), Zvw, banded arbeidskorting + flat algemene
  heffingskorting, one `setAsideCents`. `payrollWithheldCents` parameter
  present per the locked decision (merge view is a data change, not a
  redesign) and tested to reduce the total correctly. No golden number here
  — the plan doesn't pin one, and the underlying rates are Pillar 1's
  flagged placeholders — so this is tested for shape and non-negativity.
- **`splitter.ts` — `splitInvoice`.** Backs VAT out of a VAT-inclusive
  total, reserve as a share of the ex-vat remainder, `yours` as the
  residual. **Property test**: the three bands sum to exactly the input
  total across 500 randomized totals/rates/reserve-rates (this is what
  guarantees it, not luck — see docs/rounding.md).
- **`depreciation.ts` — `buildDepreciationSchedule`.** 20%/year cap,
  first-year proration by remaining months, final year absorbs the
  remainder. Property test: the schedule always sums to exactly
  `cost − residual` across 200 randomized inputs.
- **`deadlines.ts` — `deadlinesForYear`.** btw quarters, income tax (1 May),
  voorlopige aanslag monthly dates when active, KOR orgs get none. **Year
  rollover tested as a first-class case**: Q4 belongs to `year` but is due
  31 Jan of `year + 1`. Pure calendar math with no `TaxFigures` dependency —
  structurally this is what lets calendar/btw flows keep working for a year
  whose figures aren't seeded yet, while only the annual studio shows
  "figures pending" (that UI surface already exists from Pillar 1's App
  Additions design).
- **`maya-fixtures.ts`** — the canonical TS source for all Maya golden
  numbers (`MAYA_TAX_FIGURES_2026`, `MAYA_Q3_INCOME_LINES`,
  `MAYA_Q3_EXPENSE_LINES`, `MAYA_WATERFALL_INPUT`), so tests and (should it
  ever need regenerating) the seed can't silently drift apart.

**API** — `POST /calculator/set-aside` (`apps/api/src/routes/calculator.ts`):
public, unauthenticated, no DB access, Zod-validated
(`setAsideCalculatorRequestSchema`/`Response` in `packages/core`), mounted
with **two independent rate limiters** (30/60s window + 500/day cap) per the
non-negotiable's "per-IP fixed-window + daily cap" requirement for public
calculator endpoints.

**Web** — `SetAsideCalculator.tsx`, mounted on the Landing placeholder,
computing live via the exact same `splitInvoice` the API calls (client-side
instant preview / API-persisted-result-is-authoritative pattern from the
architecture non-negotiables — there's nothing to persist for a teaser
calculator, so this is the pattern's client-only half). Full pixel-faithful
Home-hero styling is Pillar 5; this is the functional widget.

### Gate results

| Check                                                        | Result                                                                                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` (4 workspaces)                           | ✅                                                                                                                                                                                |
| `npm test` (94 tests total: 71 core + 4 db + 10 api + 9 web) | ✅                                                                                                                                                                                |
| `npm run lint`                                               | ✅                                                                                                                                                                                |
| `npm run format:check`                                       | ✅                                                                                                                                                                                |
| `npm run token-check`                                        | ✅ 0 violations, 0 exceptions                                                                                                                                                     |
| `npm run build:web`                                          | ✅                                                                                                                                                                                |
| `wrangler deploy --dry-run` (API)                            | ✅                                                                                                                                                                                |
| Live smoke test                                              | ✅ `wrangler dev` boot → `POST /calculator/set-aside` with a real invoice split (verified bands sum to total) → same request with an invalid VAT rate correctly rejected with 400 |

### Deviations / notes

1. **`estimateIncomeTax` has no golden fixture** — the plan doesn't pin an
   exact tax-owed number (only the taxable-income figure going in), and the
   underlying brackets/Zvw/credits are Pillar 1's already-flagged 2025
   placeholders. Tested for correctness of shape (bracket fills sum to
   taxable, ordering, non-negativity) rather than an exact number. Revisit
   once real 2026 figures land.
2. **Property tests are hand-rolled randomized loops**, not a dedicated
   library like fast-check (not a current dependency). 100-500 iterations
   per property, deterministic enough to catch real regressions without
   adding new tooling. Worth reconsidering if property-based testing needs
   grow (shrinking, seed reproducibility) in a later pillar.
3. **`buildDepreciationSchedule`'s signature matches the plan literally**
   (no `startYear` parameter) — `year` in each entry is 1-indexed and
   relative to when depreciation starts; the caller (Pillar 4's Vault UI)
   maps offsets to calendar years using the associated expense line's date.
4. The KOR €450 deduct-vs-depreciate threshold rule is a UI-level decision
   (Vault, Pillar 4), not part of `buildDepreciationSchedule` itself — the
   engine builds whatever schedule it's asked for regardless of amount.

## Deferred to their pillar (not gaps — sequencing per the Build order)

- Onboarding flow, VAT cycle, import adapters (Moneybird/Declair/
  e-Boekhouden — `docs/import-formats/` samples still don't exist; user said
  they'll follow), Deadline/Cron/Queue reminder logic (now unblocked — the
  engine and `deadlinesForYear` exist), Today/VAT/Glossary screens →
  **Pillar 3**.
- Income tax studio, Money, Vault screens, R2 receipt uploads, export-zip →
  **Pillar 4**.
- Marketing site (7 new `Kwartaal Site *.dc.html` screens are in
  `docs/design` and confirmed complete — just not built yet), Stripe
  billing, paywall interstitial wiring → **Pillar 5**.
- Playwright e2e, backup rehearsal, production cutover → **Pillar 6**.

## External resources — still needed, none blocking Pillar 3

- **Sentry DSN** — optional; degrades to structured console.error /
  `wrangler tail` today.
- **Stripe test account** — needed for Pillar 5.
- **Resend API key + verified domain** — dev-logs mode covers local testing;
  needed for real sends (Pillar 3) and required before Pillar 6 launch.
- **Custom domain(s)** — Pillar 6 cutover.
- **`docs/import-formats/` sample exports** — needed before Pillar 3 builds
  the named adapters (generic CSV path doesn't need them; named adapters
  ship last within Pillar 3 with a skipped test as the marker).
- Staging/production R2 buckets and Queues — self-provisionable, no user
  action needed; will create them when Pillar 3 (queues) / Pillar 4 (R2)
  actually exercise those environments.

## Next session

Start with: "Read KWARTAAL-BUILD-PLAN.md, CLAUDE.md, and PROGRESS.md,
continue with Pillar 3."
