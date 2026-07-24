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

---

## Pillar 3: VAT cycle + reminders — complete

The biggest pillar so far: onboarding end to end, the full VAT checklist
(income → expenses → mirror → handoff → filed/paid → drawer-close) with a
KOR variant, deadline materialization, an hourly cron fan-out into a
reminder queue with idempotent sends, the generic-CSV import path, and the
Today/Glossary screens live on real data.

### What's done

**Schema additions** (migration `0001_organic_shriek.sql`):
`business_profiles.reminder_cadence` (`calm`|`persistent`) and
`business_profiles.onboarded_at` (drives the onboarding-wizard redirect) —
neither was in the plan's literal data model; both were needed to make the
onboarding design's reminder-cadence step and "has this org finished
onboarding" concept representable at all.

**Engine additions** (`packages/core/src/tax/`):

- `quarterPeriodEnd(year, quarter)` / `quarterForDate(date)` — a quarter's
  work-period end (distinct from its filing due date), used to decide which
  quarters predate signup.
- `reminders.ts` — `dueReminderStage(daysUntilDue, cadence)`. **Found and
  fixed a real design gap while building this**: the plan's "overdue
  repeats weekly, max 3" can't be expressed as a single `"overdue"` stage
  under `reminder_logs`' `unique(org_id, deadline_id, stage)` index (one row
  per stage, ever) — so overdue is `overdue_1`/`overdue_2`/`overdue_3`,
  three distinct stage values, one per weekly repeat. That same unique
  index is what makes the queue consumer's idempotency free (a duplicate
  insert simply conflicts).
- **Fixed a real inconsistency from Pillar 2**: `korRollingTurnover`'s
  warning threshold was implemented at 80% without checking it against the
  actual design copy. The onboarding screen's own text is explicit — "cross
  €18.000 on the KOR and we warn you before the limit does" — which is 90%
  of the €20.000 limit, not 80%. Fixed the engine (and its test) to 90%
  before this pillar shipped; the VAT screen's KOR variant already said
  "90%" correctly, so this was a real latent inconsistency between engine
  and copy, not a copy typo.
- Cadence mapping (calm vs. persistent → which stages fire) is this
  pillar's own interpretation, not literally specified: the design's
  onboarding copy says calm is "14 and 3 days before"; the plan's fixed
  five-stage vocabulary doesn't have a T-3, so calm uses the existing T-14
  and T-2 stages plus one overdue notice (never fully silent about a missed
  legal deadline even on the quiet setting) — persistent uses all five
  stages, expanded to seven counting the three overdue repeats.

**Import adapters** (`packages/core/src/import/`): a dependency-free
RFC4180-ish CSV parser, a fully-implemented generic manual-column-mapping
path (`parseGenericIncomeCsv`/`parseGenericExpenseCsv`, atomic — any
row-level error rejects the whole batch with every problem identified, none
partially imported), and the three named adapters (Moneybird, Declair,
e-Boekhouden) registered but `detect() → false` / `parse() → throws`, each
with an `it.skip` test file named after the exact sample fixture path it's
blocked on, per the standing instruction.

**API routes**:

- `POST /onboarding/complete` — updates BusinessProfile; on first
  completion only (gated on `onboardedAt` being null, so "change something"
  later never re-materializes over real data), creates Quarter rows
  (skipped entirely for KOR orgs) with past-period quarters defaulting to
  `handled_elsewhere` and the rest `open`, plus their Deadline rows via
  `deadlinesForYear`. KOR eligibility is re-validated server-side, never
  trusting the client's gating. A year without seeded TaxFigures degrades
  gracefully (KOR limit falls back to €20.000; TaxYearProfile creation is
  best-effort and simply skipped, not a hard failure).
- `GET/POST /quarters/*` — list, detail (with lines), add income/expense
  lines (auto-flips `open` → `in_progress`), CSV import preview/commit,
  `file` (computes and persists rubriek 1a/1b/5b/5c via `computeQuarter`),
  `pay`, `reopen`. **`pay` is where locked decision #5 actually lives**:
  sets `firstQuarterClosedAt` if and only if it's still null, on the
  filed→paid transition of a real quarter — `handled_elsewhere` quarters
  never reach this handler, so they structurally can't trigger it; no
  separate exclusion logic was needed.
- `GET /deadlines`, `GET /glossary` — straightforward reads.
- Fixed a **real contract/schema mismatch left over from Pillar 1**:
  `lines.ts`'s `source` field was a single enum mixing "how" (manual/import)
  with "which adapter" (moneybird/declair/...), but the DB has always had
  two separate columns. Split into `lineSourceSchema` +
  `importAdapterSchema` to match the schema exactly — caught before it ever
  shipped a route, but worth naming since Pillar 1's PROGRESS.md flagged the
  mismatch and then didn't actually fix it.

**Cron + queue**: `scheduled.ts`'s hourly tick does a `.global` fan-out
across every org's deadlines, skips `handled_elsewhere`/`paid` quarters and
dismissed deadlines, computes `dueReminderStage` via the DST-safe
`daysUntilDue`, and enqueues a message for any stage not already in
`reminder_logs` (a cheap pre-check, not the real guarantee). `queue.ts`'s
consumer inserts the `reminder_logs` row **before** sending the email
(`onConflictDoNothing`, checks the returned row count) — that insert is the
actual idempotency guarantee, live-verified structurally even though no
`RESEND_API_KEY` exists yet to send a real message (dev-logs mode is what
fires). Five email templates (`reminder-templates.ts`, seven counting the
overdue repeats) follow the design's own voice rules (state the fact and
the time it takes, never manufacture urgency; overdue copy always names a
recovery action, never a bare warning; "compliant" never appears — tested).

**Web**:

- `Onboarding.tsx` — the full 6-step wizard (welcome, business/KVK-year,
  btw/KOR, money/reserve with a live `splitInvoice`-powered demo split,
  reminders, done), calling `POST /onboarding/complete` and redirecting
  into the app. `RequireOnboarded` routes anyone without `onboardedAt` here
  before they can reach `/app/*`.
- `Today.tsx` — real hero card (welcome/mid/due/overdue framing driven by
  live `daysUntilDue`), the year timeline (`YearTimeline.tsx`, all six
  visual states including the `handled_elsewhere` neutral node from
  Pillar 1's App Additions design), and a click-to-reopen affordance on
  `handled_elsewhere` nodes wired to `POST /quarters/:id/reopen` — "Log this
  quarter in Kwartaal instead," live.
- `Vat.tsx` — the full checklist (income confirm → expense confirm → the
  mirror with a "why these numbers?" expander → the handoff card laid out
  as the real rubriek form → filed/paid as two independently-gated acts) all
  computing live via the shared `computeQuarter`, plus the KOR variant
  (serene screen, live rolling-turnover bar via `korRollingTurnover`
  aggregated across the year's quarters) and a `drawer-settle` animated
  closed-quarter card with reduced-motion respected (the animation is a CSS
  class gated by the `prefers-reduced-motion` media query already in
  `theme.css` from Pillar 1 — nothing new needed here).
- `Glossary.tsx` — searchable list of the 9 seeded terms.

### Gate results

| Check                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck` (4 workspaces)                                       | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm test` (122 tests total: 93 core + 4 db + 16 api + 9 web, 3 skipped) | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run lint`                                                           | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run format:check`                                                   | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `npm run token-check`                                                    | ✅ 0 violations, 0 exceptions                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `npm run build:web`                                                      | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `wrangler deploy --dry-run` (API)                                        | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Live API smoke test                                                      | ✅ Full walkthrough on a **fresh signup**, live `wrangler dev`: sign-up → `/onboarding/complete` (mid-year signup on the real current date correctly defaults Q1/Q2 to `handled_elsewhere`, Q3/Q4 `open`) → add income/expense lines → `file` (rubriek numbers computed correctly) → `pay` (`firstQuarterJustClosed: true`, `firstQuarterClosedAt` set on the profile) → `reopen` a `handled_elsewhere` quarter (→ `open`) → CSV import preview correctly rejects a bad row atomically → glossary read |
| Frontend verification                                                    | ⚠️ **No browser automation tool is available in this environment.** Verified: production build succeeds, every new module (including `Vat.tsx`, the largest) transforms cleanly through Vite with no syntax/type errors, and all 9 web unit tests pass. **Not verified**: actual interactive rendering, click-through behavior, or visual fidelity in a real browser. Flagging per the standing instruction rather than claiming a golden-path browser test that didn't happen.                        |

### Deviations / notes

1. **CSV import has no frontend UI yet.** The backend (parser, preview,
   commit, atomic row-level validation) is fully built and tested; `Vat.tsx`
   only wires manual single-line entry, not an upload-and-map-columns
   widget. Rather than ship a rushed file-upload UI, this is left for a
   follow-up — the design's "Import CSV" buttons in the income/expense
   steps are the visual target when it's built.
2. **The mid-year `handled_elsewhere` review is a Today-screen affordance,
   not a dedicated onboarding step.** The App Additions design shows the
   behavior twice — a standalone onboarding review screen, and a
   timeline-node hover/click interaction. Built the timeline version only:
   it's the more useful, persistent location (available any time, not just
   at signup), and the backend doesn't need a separate parameter to support
   it since defaulting-to-`handled_elsewhere` already happens automatically.
   The onboarding wizard's 6 steps match `Kwartaal Onboarding.dc.html`'s
   literal steps exactly (0-5); no extra step was inserted.
3. **No push notification channel** — email only. The onboarding design's
   "Persistent: Email + push" is aspirational; there's no push
   infrastructure in this stack. Reminder cadence still behaves as
   designed, just over one channel.
4. **`estimateIncomeTax`'s underlying figures remain Pillar 1's flagged
   2025 placeholders** — unrelated to this pillar's work, still open.
5. **Reminder emails have never been sent for real** — no `RESEND_API_KEY`
   configured, so every send in dev/test goes through the dev-logs path.
   The composition, idempotency, and cron/queue wiring are all live-verified
   at the database level (the `reminder_logs` row really gets written,
   exactly once); the actual Resend HTTP call is untested. Needs a key and
   one real send before trusting delivery end to end.

## Pillar 4: Annual studio + Money + Vault — complete

Income tax studio, Money, and Vault all live against the real engine and a
real data model; R2 receipt capture with the six-element checklist;
start-up costs with live depreciation schedules; the account-wide
export-zip and the annual bookkeeper-summary PDF, both properly queued
through `ExportJob` rather than built inline in a request handler. Full
gate green including a live smoke test; the Browser Rendering path is
verified to fail gracefully (not crash) where it can't be exercised
locally.

### What's done

**Schema additions** (migration `0002_odd_network.sql`): `export_jobs`
gained `kind` (`"data" | "bookkeeper_summary"`, default `"data"`) and a
nullable `year` — the two together are how one `ExportJob`/`ExportQueueMessage`
pair now serves both the full-account zip and the annual PDF, instead of
adding a parallel job table.

**Engine wiring** (no new pure functions this pillar — Pillar 2's engine
already covered everything needed):

- `buildDepreciationSchedule` is now actually called from
  `POST /quarters/:id/expense-lines` when `deductionMode: "depreciate"`,
  persisting a `DepreciationSchedule` row (`annualCents` derived from the
  computed schedule's year-2 entry, falling back to year-1 for a
  single-year schedule).
- `apps/api/src/lib/income-tax-aggregate.ts` — one `aggregateIncomeTaxYear`
  function shared by `GET /income-tax/:year` and the bookkeeper-summary PDF
  builder, so the screen and the handoff document can never show different
  numbers for the same year.

**API routes** (all new this pillar):

- `GET /income-tax/:year` — profit built live from every quarter's lines
  regardless of status ("so far" is honest about a partial year), hours
  from `HoursEntry`, `computeWaterfall` + `estimateIncomeTax` run against
  the seeded `TaxFigures` row. No row for the year → `figuresPending: true`
  with every figures-dependent field null, calendar data still populated
  (Pillar 1's App Additions "figures pending" surface is now real).
- `GET/POST /hours-entries`, `GET/POST /km-entries` (km is the literal
  stub the plan calls for — no route/mileage computation, just a logged
  row).
- `GET/POST /money/pots`, `PATCH /money/pots/:id` (the "manual monthly
  review ritual" — no bank connection, the user types what's in each pot).
- `GET/POST /money/set-aside-entries` — persists a per-invoice
  `splitInvoice` result.
- `GET /money/voorlopige-aanslag/:year`, `PUT /money/voorlopige-aanslag` —
  upserts the year's row, then **rematerializes only that year's
  `voorlopige_aanslag`-kind deadlines** (delete-then-insert via
  `deadlinesForYear`), leaving the `btw_q`/`income_tax` rows from
  onboarding untouched. Live-verified: activating produces exactly the
  monthly deadline rows the schedule preview promises.
- `GET/POST /receipts`, `GET /receipts/:id/file`,
  `PATCH /receipts/:id/checklist` — content-type allow-list (jpeg/png/
  webp/pdf), 8 MB cap, a **per-org** daily upload cap (distinct from the
  IP-keyed rate-limit middleware, which can't express "per org"), six
  checklist elements initialized unconfirmed, `missingCount` recomputed on
  every PATCH. Live-verified round-trip through R2 including the actual
  file bytes.
- `GET /startup-costs` — cross-quarter by design (start-up costs predate
  registration, they don't belong to one quarter's checklist); depreciated
  lines get their full year-by-year schedule recomputed live from
  `buildDepreciationSchedule`, never re-read from a stored breakdown (only
  the inputs are persisted).
- `GET/POST /export-jobs`, `GET /export-jobs/:id/file` — enqueues onto
  `EXPORT_QUEUE`, never builds inline (the plan's async rule explicitly
  names export-zip builds; the annual PDF gets the same treatment for the
  same reason — Browser Rendering cold-starts are not request-handler
  material).
- `queue.ts`'s export consumer — `kind: "data"` zips every tenant table as
  JSON plus the actual receipt files fetched from R2; `kind:
"bookkeeper_summary"` renders `aggregateIncomeTaxYear`'s output to HTML
  and prints it via `@cloudflare/puppeteer` + the `BROWSER` binding. Both
  paths flip the `ExportJob` to `completed`/`failed` and audit either way.

**Web** (`apps/web/src/routes/`):

- `IncomeTax.tsx` — profit bars, the deduction-stack cards (waterfall,
  each step's eligibility/reason from the engine, not hardcoded), the
  bracket vessels, credits/Zvw lines, the hatched "estimated tax to set
  aside" card, and a figures-pending variant matching the App Additions
  design (dashed borders, no numbers claimed that depend on unpublished
  rates). The handoff section's "Export this summary for my bookkeeper"
  button drives the full enqueue → poll → download flow against the new
  `bookkeeper_summary` export-job kind.
- `Money.tsx` — the invoice splitter (same `splitInvoice` the engine golden-
  tests, persists via `set-aside-entries` when given an invoice reference),
  a pots grid with inline "tap to review" editing and the hatched
  not-yours treatment on any pot literally named Taxes/Belasting, and the
  voorlopige aanslag decision card with a live schedule preview.
- `Vault.tsx` — search + year filter, receipt capture (file picker → R2
  upload → live six-element checklist), the urencriterium ring fed by
  `GET /income-tax/:year`'s `hoursLogged`/`hoursTarget` (one aggregation,
  reused rather than re-derived), a recent-records table merging receipts
  and km entries, the start-up costs corner with the €450 rule applied
  automatically at add-time and the live depreciation-schedule visual, and
  the account-wide "Export everything for my bookkeeper (.zip)" button.

### Gate results

| Check                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run typecheck` (4 workspaces)                                       | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm test` (128 tests total: 93 core + 4 db + 19 api + 9 web, 3 skipped) | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run lint`                                                           | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run format:check`                                                   | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `npm run token-check`                                                    | ✅ 0 violations, 0 exceptions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `npm run build:web`                                                      | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `wrangler deploy --dry-run` (API)                                        | ✅ (2.96 MB / 524 KB gzip — the size jump is `@cloudflare/puppeteer`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Live API smoke test                                                      | ✅ Fresh signup on live `wrangler dev`: onboarding → depreciated expense line (verified the `DepreciationSchedule` row's `annualCents` matches `buildDepreciationSchedule`'s output exactly) → two start-up costs, one over/one under €450 (verified `GET /startup-costs` auto-buckets correctly with a live year-by-year schedule) → hours/km entries → pot create + review PATCH → set-aside-entry (bands verified) → voorlopige aanslag activate (verified the exact monthly deadline rows) → receipt upload → checklist PATCH → file round-trip through R2 (byte-identical) → `GET /income-tax/2026` (waterfall/brackets render, ineligibility reasons correct for un-met urencriterium) → `POST /export-jobs {kind:"data"}` → queue-consumed to `completed` → downloaded zip contains all 10 JSON tables plus the real receipt file → `POST /export-jobs {kind:"bookkeeper_summary"}` → queue-consumed to `failed` (Browser Rendering unavailable in local `wrangler dev`, exactly as expected — confirms the failure path doesn't crash the worker or leave a job stuck) |
| Frontend verification                                                    | ⚠️ **No browser automation tool is available in this environment** (same standing limitation as Pillars 1 and 3). Verified: production build succeeds, all three new screens (`IncomeTax.tsx`, `Money.tsx`, `Vault.tsx`) transform cleanly through Vite with no syntax/type errors, all unit tests pass. **Not verified**: actual interactive rendering, click-through behavior, or visual fidelity in a real browser.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Deviations / notes

1. **Corrected my own design mistake before it shipped**: I initially built
   the bookkeeper-summary PDF as a per-quarter rubriek handoff document
   (`quarterId`-scoped), reading the plan's Pillar-3-area VAT handoff
   section too literally. Re-checking the plan's actual feature inventory
   (line ~231: "handoff checklist incl. DigiD/eHerkenning note, extension
   path, bookkeeper summary export") and the docs/design Income-tax-studio
   screen (its own "Export this summary for my bookkeeper" button) showed
   the summary is the **annual** income-tax handoff, not a quarter's VAT
   mirror. Fixed before generating the first migration against a live DB —
   `export_jobs` targets `year`, not `quarterId`, and the PDF renders the
   same `aggregateIncomeTaxYear` output the screen shows.
2. **No dedicated design mockup exists for the bookkeeper-summary PDF
   itself** (docs/design has the screen button, not the printed document).
   `bookkeeper-summary.ts` builds a plain, functional table layout rather
   than a pixel-matched export — flagging per the standing instruction
   rather than silently presenting it as a design-faithful artifact.
3. **The €450 start-up-cost deduct-vs-depreciate threshold is applied
   automatically** at add-time in `Vault.tsx` (over €450 ex-VAT → 5-year
   depreciation, `residualCents: 0`, `startMonth` from the entry's own
   date) rather than exposing raw depreciation parameters to the user —
   matches the design's framing of this as a rule the product applies, not
   a decision the user makes line by line. `buildDepreciationSchedule`
   itself stays generic (Pillar 2 already noted the threshold is a UI-level
   decision, not an engine one).
4. **Start-up costs attach to the org's earliest quarter**, since
   `expense_lines.quarter_id` is `NOT NULL` and start-up costs by
   definition predate any quarter's filing period — the line's own `date`
   preserves the real (pre-registration) date; only the FK target is
   borrowed. This is a schema-shape consequence, not a plan requirement,
   and worth revisiting if a future pillar wants start-up costs to be
   fully quarter-independent.
5. **The Vault's "Recent records" table shows receipts and km entries
   only**, not invoice/expense lines from VAT quarters (the design mockup
   shows both). Income/expense lines live inside quarters with no existing
   "all lines for a year across quarters" endpoint; adding one felt like
   scope creep for a table that's secondary to the checklist/depreciation
   work this pillar's gate cares about. Flagging as a known gap rather
   than silently shipping a subset without saying so.
6. **Only one new unit test file this pillar**
   (`lib/bookkeeper-summary.test.ts`, 3 tests including an XSS-escaping
   check on the PDF's HTML input) — every new API route depends on
   `TenantDb`/D1 and there's no test-DB harness yet (Pillar 1-3 didn't
   build one either; `calculator.test.ts` is the only existing route test,
   and it works precisely because that route is public/DB-free). The new
   routes are wiring over Pillar 2's already-golden-tested engine
   functions (`buildDepreciationSchedule`, `splitInvoice`,
   `computeWaterfall`, `estimateIncomeTax`), and were exercised end-to-end
   in the live smoke test above, but that's not the same guarantee as
   automated coverage. A D1-backed route-test harness would close this gap
   and is worth prioritizing before Pillar 5 adds Stripe webhooks on top.
7. **`@cloudflare/puppeteer` and `fflate` are the two new dependencies**
   this pillar adds (both flagged in the preflight's "starter kit" list as
   expected Pillar 4 additions), no others.

## Pillar 5: Billing + marketing site — complete

Stripe Checkout + Customer Portal + a signature-verified, idempotent
webhook; the entitlement gate wired across every mutation route; the
bookkeeper-invite flow (a real design constraint solved, not stubbed);
account deletion request/cancel; the full public marketing site
(Home/Pricing/How it works/Guide/About/Companion + four legal pages) with
real SSG prerender, sitemap, robots.txt, and generated OG images. **No
Stripe account exists** (BLOCKED, flagged since Pillar 1's external
resources list) — every billing code path is built and live-tested against
its documented degraded behavior, but live Checkout/Portal/webhook-from-
real-Stripe have never run against a real account. Full gate green
including a live smoke test that exercises the entire trial → gate →
subscribe → gate-reopens lifecycle with a cryptographically real (test-key)
webhook signature.

### What's done

**Schema additions** (migration `0003_loose_invaders.sql`): `invites`
(pending bookkeeper seats — see the invite-flow note below for why this
couldn't just be a `users` row with `status: "invited"`), `webhook_events`
(global, Stripe-event-id-keyed idempotency ledger, same insert-before-
process pattern as `reminder_logs`), and `orgs.deletionRequestedAt`.

**Entitlement** (`packages/core/src/entitlement.ts`'s `hasProAccess` already
existed from Pillar 1 — this pillar is where it actually gets called):

- `apps/api/src/lib/entitlement.ts`'s `computeEntitlement(tenantDb)` is the
  one place `hasProAccess` gets real inputs from (`businessProfiles` +
  `subscriptions`), used by `GET /orgs/me`, onboarding's response,
  `GET /billing/status`, and the gate itself — so the gate, the Settings
  screen, and the nav badge can never disagree about whether an org is
  entitled.
- `apps/api/src/middleware/entitlement.ts`'s `requireProForMutations` is a
  no-op on every `GET` (Free tier keeps read access to everything, per
  locked decision #5's "the gate blocks new work, not access to your own
  records") and 402s every other method when `hasProAccess` is false.
  Mounted once per gated router group in `index.ts` — `quarters`,
  `hours-entries`, `km-entries`, `money`, `receipts`, `export-jobs`, and
  `invites` (the bookkeeper seat itself is the Pro feature being gated, not
  the org's own calendar/glossary/deadlines/income-tax reads, which stay
  ungated).
- Live-verified the exact trial mechanics: with `firstQuarterClosedAt`
  null, mutations pass; forcing it non-null (simulating a closed first
  quarter) flips `GET /billing/status` to `hasProAccess: false` and the
  very next `POST /hours-entries` returns 402 — while the same org's `GET
/quarters` keeps returning 200 throughout, proving reads never gate.

**Billing** (`apps/api/src/lib/stripe.ts`, `routes/billing.ts`,
`routes/billing-webhook.ts`, `lib/stripe-webhook.ts`):

- `getStripeClient` throws a typed `BillingNotConfiguredError` when
  `STRIPE_SECRET_KEY` is absent — no dev-fallback exists for a payments
  secret (unlike `BETTER_AUTH_SECRET`'s insecure-but-functional local
  default), so every billing route degrades to a clear 503
  `billing-not-configured` rather than crashing or faking a client.
  Live-verified: both `POST /billing/checkout-session` and
  `POST /billing/portal-session` return exactly that with no key configured
  (the actual state of this environment).
- `POST /billing/checkout-session` — creates/reuses a Stripe Customer,
  starts a subscription-mode Checkout Session for the requested interval,
  carries `orgId` through as `client_reference_id` **and**
  `subscription_data.metadata.orgId` (the second one is what the webhook
  actually reads, since a `customer.subscription.*` event's own object is
  what carries the org link, not the checkout session).
- `POST /billing/portal-session` — 404s `no-subscription` if the org has
  never had a Stripe customer (correct: Portal manages an existing
  relationship, Checkout starts one).
- `POST /webhooks/stripe` — mounted with **no** `csrfGuard`/`requireSession`
  (a webhook has no session and Stripe never sends a matching Origin;
  see `index.ts`'s comment on why this is deliberate, not an oversight).
  Verifies via `Stripe.webhooks.constructEventAsync` +
  `Stripe.createSubtleCryptoProvider()` — the edge-runtime-safe pair, not
  the Node-crypto-dependent sync `constructEvent`, since Workers has no
  Node crypto. The DB-touching half lives in `lib/stripe-webhook.ts`, not
  the route file, because the route lives under `apps/api/src/routes/**`
  and the no-raw-database ESLint rule bans importing `createDb` there —
  same reason `queue.ts`'s reminder/export handlers live outside `routes/`.
  Idempotent via `webhook_events` insert-before-process
  (`onConflictDoNothing`); a replayed event is a no-op, verified live (see
  gate table).
- Handles `customer.subscription.created|updated|deleted` — these three
  alone are the source of truth for plan/status/currentPeriodEnd (Stripe
  fires one on every state change including the first), so
  `checkout.session.completed` isn't needed at all and isn't handled.

**Bookkeeper invite** (`routes/invites.ts`, `routes/invite-preview.ts`,
`lib/consume-invite.ts`, `auth/index.ts`'s hook, `routes/AcceptInvite.tsx`):
the real design problem here — Better Auth's `user.create.after` hook
**always** auto-provisions a brand-new org for any new authUser (that's how
open self-serve signup works), so a naive invite link would just create the
bookkeeper their own separate org instead of attaching them to the
inviter's. Fixed by checking a pending `invites` row (matched by email,
global scan — email isn't independently indexed and this table is small by
nature) **before** falling back to `provisionOrgForNewUser`, so invite
consumption and normal signup are mutually exclusive outcomes of the exact
same hook, not two different code paths that could drift. `users.auth_
user_id` being globally unique (from Pillar 1) means one person can only
ever belong to one org, ever — so an email that already has an account
can't be invited into a second one; `POST /invites` checks for this and
409s `email-already-has-account` rather than silently creating an invite
that could never be consumed. Live-verified end to end: invited email
signs up fresh → lands in the **inviter's** org with `role: "bookkeeper"`
(not their own new org) → the invite row is gone from the owner's list →
the bookkeeper's own mutation attempt 403s (`requireRole("owner")` was
already correctly applied to every mutation route in Pillars 3-4, so
"mutation-blocked server-side" needed no new enforcement, just this
end-to-end proof) → the bookkeeper's read still 200s.

**Account deletion** (`POST /orgs/deletion-request`,
`POST /orgs/deletion-cancel`): sets `deletionRequestedAt` and immediately
enqueues a `kind: "data"` `ExportJob` (reusing Pillar 4's export machinery
verbatim), so the plan's "30-day grace **export**" exists from day one of
the grace period, not generated at the last minute. **The actual 30-days-
later hard cascade delete is deferred** — it's a weekly-cron sweep, the
same cron surface as the Pillar-6-deferred backup dump (`scheduled.ts`
already has a stub for `"0 3 * * 0"`), so bundling both into that one
future cron implementation is more coherent than building a second,
unrelated weekly sweep now. Flagged explicitly below, not silently left
unfinished.

**Web — paywall + Settings**:

- `lib/api.ts`'s `onEntitlementRequired` hook fires `PaywallInterstitial`
  on any 402, the same reactive pattern the existing (if never-wired)
  `onUnauthenticated` hook established — matches the design's own "no
  urgency mechanics, fires when a gated action is attempted" rule better
  than a preemptively-disabled button would.
  `PaywallInterstitial.tsx` is ported from `Kwartaal App Additions.dc.html`'s
  paywall interstitial, with copy adapted to be state-generic ("Your free
  quarter is complete" rather than hard-coding "Q3") since this can fire on
  any gated mutation after the trial closes, not only the exact
  drawer-close moment.
- `Settings.tsx` is fully real: profile/KOR/role summary, a reminder-
  cadence editor (reuses `POST /onboarding/complete`'s idempotent-after-
  first-run update path rather than adding a parallel endpoint), plan/
  billing (checkout with an interval toggle, or "Manage billing" once
  subscribed), the bookkeeper invite form + pending-invite list + revoke,
  the account-wide data export (extracted into a shared
  `DataExportButton.tsx`, now used by both Vault and Settings), and account
  deletion request/cancel with the 30-day framing stated plainly.
- `AppShell.tsx` gained a Trial/Free/Pro badge next to the org name —
  deliberately distinct from a raw `hasProAccess` boolean, since showing
  "Pro" during the free trial would misstate what happens at the gate.

**Marketing site** (`apps/web/src/marketing/`): Home, Pricing (live
interval toggle + FAQ accordion), How it works (Maya's full six-step
walkthrough), Guide (the expat tax guide's first real article), About,
Companion (the "works alongside your bookkeeping tool" positioning page,
verbatim to the plan's required framing — never a feature-matrix
comparison), and four legal pages (Privacy/Terms/DPA/Impressum) sharing one
`LegalPage.tsx` template per docs/design's own "shared by all four" note,
written with real content describing what the product actually does
(data minimization, EU processors, export/deletion self-service) rather
than lorem-ipsum placeholders. A product-voice 404 page
(`marketing/NotFound.tsx`) replaces the old catch-all
redirect-to-`/`. `MarketingLayout.tsx` is the one shared nav+footer,
matching `Kwartaal Site Patterns.dc.html`'s "nav and footer live on every
site page" note.

**SSG prerender + sitemap + OG images** (`apps/web/src/entry-server.tsx`,
`scripts/build-static.mjs`): a genuinely separate SSR entry that renders
**only** the ten public marketing/legal pages directly (never the full
`<App/>` route tree), specifically so prerendering never touches Better
Auth's `useSession` or any hook that assumes a browser — those live
exclusively in the authenticated app routes, untouched by this. `vite
build --ssr` produces a Node-runnable bundle; a plain Node script then
`renderToString`s each route into the built `index.html` shell, injects
per-page `<title>`/description/canonical/OG meta, and writes
`sitemap.xml` + `robots.txt` + a real `404.html`. OG images are genuinely
rendered, not stubbed: an SVG built from the same design template
(`Kwartaal Site Patterns.dc.html`'s wordmark + headline + timeline-strip
motif) is rasterized to PNG at build time via `@resvg/resvg-js` — one real
1200×630 PNG per page, verified visually (see gate table). Added
`public/_redirects` because adding a real `404.html` silently broke
Cloudflare Pages' implicit "no 404.html → fall back to index.html for
everything" SPA behavior the app (`/app/*`, `/signin`, `/onboarding`,
`/accept-invite/*`) was relying on — caught before it shipped, not after.
**Simplification, stated plainly**: the client does a fresh `createRoot`
render on top of the prerendered HTML rather than `hydrateRoot`-based
hydration, since there's no browser available in this environment to
verify a hydration match against. The prerendered HTML is real and correct
for crawlers/first-paint either way; this only affects whether the very
first client paint is a diff-free hydration or a fast full re-render.

### Gate results

| Check                                                                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` (4 workspaces)                                       | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm test` (128 tests total: 93 core + 4 db + 22 api + 9 web, 3 skipped) | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run lint`                                                           | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run format:check`                                                   | ✅                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `npm run token-check`                                                    | ✅ 0 violations, 0 exceptions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `npm run build:web` (tsc → vite build → vite SSR build → prerender)      | ✅ 10 prerendered pages verified with real body text (`grep`-checked), 10 real OG PNGs (visually verified — see below), sitemap.xml + robots.txt + 404.html generated                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `wrangler deploy --dry-run` (API)                                        | ✅ (3.67 MB / 604 KB gzip)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Live API smoke test                                                      | ✅ Fresh owner signup on live `wrangler dev`: onboarding → `hasProAccess: true` during trial → forced `firstQuarterClosedAt` non-null in D1 → `GET /quarters` still 200, `POST /hours-entries` now 402, `GET /billing/status` shows `hasProAccess: false` → `POST /billing/checkout-session` and `/portal-session` both correctly 503 with no Stripe key → built a **real, cryptographically signed** `customer.subscription.created` webhook payload with Stripe's own `generateTestHeaderString` and POSTed it → subscription row created, `hasProAccess` flips back to `true`, the same `POST /hours-entries` that 402'd now succeeds (201) → replayed the identical webhook event → still 200, exactly one subscription row (idempotency proven, not just asserted) → `POST /invites` → invited email signs up fresh → lands in the **inviter's org** as `role: "bookkeeper"` (not a new org) → invite gone from the owner's list → bookkeeper's mutation 403s, read 200s → `POST /orgs/deletion-request` → `deletionRequestedAt` set, `ExportJob` auto-created and completed → `POST /orgs/deletion-cancel` clears it |
| Frontend verification                                                    | ⚠️ **No browser automation tool is available in this environment** (same standing limitation as Pillars 1, 3, and 4). Verified: production build succeeds, all 18 new modules transform cleanly through Vite, all unit tests pass, and — new this pillar — the prerendered HTML output was verified to contain real per-page body text and the generated OG images were visually inspected and confirmed correctly rendered (not garbled/blank). **Not verified**: actual interactive rendering, click-through behavior, or visual fidelity of the live (non-prerendered) app in a real browser.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### Deviations / notes

1. **No Stripe account exists — BLOCKED, exactly as flagged since Pillar 1's
   external-resources list.** Every billing code path (`lib/stripe.ts`,
   `routes/billing.ts`, the webhook handler) is fully built and live-tested
   against its documented degraded behavior (503 when unconfigured,
   idempotent + signature-verified webhook processing proven with a real
   test-key-signed payload). What has **never** run: an actual Checkout
   redirect completing against Stripe's real servers, an actual Customer
   Portal session, or a webhook Stripe itself sent. `STRIPE_PRICE_MONTHLY`/
   `STRIPE_PRICE_ANNUAL`/`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are all
   `REPLACE_WITH_*` placeholders or unset secrets in `wrangler.toml`. This
   is the single largest remaining risk before launch — the first real
   Stripe test-mode subscription needs to be walked through by hand once a
   Stripe account exists, ideally before Pillar 6's hardening pass.
2. **`checkout.session.completed` is deliberately unhandled.** Early in
   this pillar I wired the checkout route to set `subscription_data.
metadata.orgId` specifically so `customer.subscription.created` (which
   fires immediately after checkout completes, with the full Subscription
   object) is sufficient on its own — handling `checkout.session.completed`
   too would mean two event types racing to write the same row for no
   benefit. Documented here rather than left as a silent gap someone might
   assume was an oversight.
3. **The 30-day hard-delete sweep is deferred to Pillar 6**, bundled with
   the already-deferred weekly backup dump (see Pillar 1's `scheduled.ts`
   stub) since both are the same weekly-cron surface. The immediate,
   real part — request/cancel + the grace-period export — is fully live.
4. **A D1-backed route-test harness still doesn't exist** (Pillar 4's
   deviation #6, unresolved). This pillar adds one more real unit test
   (`lib/stripe-webhook.test.ts`, 3 tests) covering the one piece of the
   webhook path that's genuinely pure crypto and needs no DB — signature
   acceptance, wrong-secret rejection, and tampered-payload rejection,
   using Stripe's own `generateTestHeaderString` rather than hand-rolled
   HMAC. Every other new route (billing, invites, entitlement gate) is
   verified only by the live smoke test above, not automated coverage.
   Still worth prioritizing before Pillar 6.
5. **Reminder-cadence editing in Settings reuses `POST /onboarding/
complete`** rather than a new dedicated endpoint — that route was
   already idempotent-after-first-completion (a second call only updates
   preferences, never re-materializes quarters), so it doubles as a general
   "update these business-profile settings" endpoint without new server
   code. The Settings form re-submits the full onboarding payload
   (hardcoding the non-editable fields to their current values) to change
   just the cadence; a more surgical `PATCH /orgs/business-profile` would
   be cleaner if Settings grows more editable fields later.
6. **SSG prerender does client-side `createRoot`, not `hydrateRoot`**, a
   simplification stated plainly in the "What's done" section above rather
   than silently presented as full SSR hydration — the right fix (switch
   `main.tsx` to `hydrateRoot` and verify no mismatch warnings) needs an
   actual browser to verify against, which this environment doesn't have.
7. **OG images are code-generated SVG→PNG, not pixel-matched to a Claude
   Design export** — no such per-page raster asset exists in docs/design
   (only the shared template's markup does). The template's structure
   (wordmark, headline, italic subheadline, timeline-strip motif, quarter-
   circle accent) is ported faithfully; exact typography (a generic
   sans-serif rather than Inter, since embedding font files in a build-time
   Node rasterizer felt like scope beyond what a social-preview image
   needs) is the one acknowledged gap from pixel-fidelity.
8. **`@resvg/resvg-js` and `stripe` are the two new dependencies** this
   pillar adds (one per the plan's Stripe requirement, one a pragmatic
   build-time choice for real OG images rather than shipping none) — no
   others.
9. **Deleted `Landing.tsx` and `PlaceholderScreen.tsx`** — both were
   explicitly documented as Pillar-5-and-later placeholders in their own
   Pillar 1 docstrings, and are now fully superseded (Home.tsx replaces
   Landing; every placeholder route now has a real screen). `StateSwitcher.
tsx` was left in place despite losing its only caller — it's a real,
   tested, reusable component, and the plan's "state switcher retained as
   a dev-only tool behind a flag" note (Pillar 3) was never actually wired
   into Today.tsx in the first place, a pre-existing gap from Pillar 3 that
   this pillar didn't introduce and isn't the right place to fix.
10. **Corrected after initial review — Stripe Tax was missing from the
    checkout session.** The plan's line item is literally "Stripe products/
    prices, Checkout, Customer Portal, **Stripe Tax config**, webhook
    handler," and the first pass of this pillar built Checkout without it.
    Fixed in `routes/billing.ts`: `automatic_tax: { enabled: true }`,
    `billing_address_collection: "required"` (Stripe Tax needs a customer
    location), `customer_update: { address: "auto", name: "auto" }` (the
    Customer is created with no address, so Checkout must be allowed to
    write the collected one back), and `tax_id_collection: { enabled: true
}` (lets a ZZP'er enter their own btw-id for EU B2B reverse-charge).
    Still blocked on the same missing Stripe account as everything else in
    billing — Stripe Tax additionally requires the Tax product to be
    enabled and jurisdictions registered in the Dashboard, which is only
    possible once an account exists — but the application-side wiring is
    now correct and will work the moment it does.
11. **Stripe receipt-email copy (the deductibility/voorbelasting-5b line
    the plan asks for) is Dashboard-side, not application code** — Stripe
    generates subscription receipt emails from account-level Branding
    settings and invoice line-item descriptions, not from anything this
    pillar's API calls control directly. Blocked on the same missing
    Stripe account; needs to be set once the account exists, and is worth
    an explicit checklist item before launch rather than assumed-done.
12. **Sitemap/prerender/OG-image tooling was built bespoke, not copied
    from STACK-BLUEPRINT.md's existing pattern** — the blueprint documents
    an almost-identical, already-audited setup (`scripts/generate-
sitemap.mjs` run before the client build, a separate `vite build --ssr
src/entry-prerender.tsx --outDir dist-server` + `scripts/prerender.mjs`
    pass, and a standalone `og` script for `scripts/generate-og.mts` run
    independently of `build` rather than every time). This pillar's
    `entry-server.tsx` / `dist-ssr` / single `build-static.mjs` doing
    prerender+sitemap+OG together is functionally equivalent — real
    prerendered HTML, real sitemap, real OG PNGs, all live-verified — and
    folding OG generation into every build (rather than a separate manual
    step) is arguably safer for this project specifically (resvg is fast
    enough here that "never stale" beats "not on every build"). But it's a
    process deviation from the plan's explicit "(copy blueprint scripts)"
    parenthetical and from STACK-BLUEPRINT §11(a)'s "copy nearly verbatim"
    guidance, caught on a second look rather than during the original
    build, and left as-is rather than risking a rename/restructure of
    already-verified-working code for naming parity alone. Flagged here so
    the deviation is a documented choice, not a silent one.

## Deferred to their pillar (not gaps — sequencing per the Build order)

- CSV import UI (upload + column-mapping widget) and the named import
  adapters (blocked on `docs/import-formats/` samples, which still don't
  exist) → follow-up within **Pillar 3's** scope, not yet done.
- Vault's "Recent records" table doesn't yet include invoice/expense lines
  from VAT quarters (see Pillar 4 deviation #5) → natural follow-up
  whenever a cross-quarter lines endpoint is built, no fixed pillar.
- A D1-backed route-test harness, to close the automated-coverage gap
  flagged in Pillar 4 deviation #6 and restated in Pillar 5 deviation #4
  → worth doing **before Pillar 6's hardening pass**, not after — Pillar 6
  is explicitly a testing/security pillar and shouldn't build its e2e
  layer on top of zero route-level integration coverage underneath it.
- The 30-day hard-cascade-delete sweep (Pillar 5 deviation #3) → **Pillar
  6**, bundled with the already-deferred weekly backup dump on the same
  cron surface.
- SSG prerender uses client-side `createRoot` rather than `hydrateRoot`
  (Pillar 5 deviation #6) → revisit once real browser verification is
  possible.
- Playwright e2e (Pillars 3, 4, and 5's frontend work has never been
  browser-tested — see the gate tables above), backup rehearsal, the first
  real Stripe test-mode walkthrough (Pillar 5 deviation #1 — the single
  largest remaining pre-launch risk), production cutover → **Pillar 6**.

## External resources — still needed, none blocking Pillar 6

- **Stripe test account** — still BLOCKED (Pillar 5 deviations #1, #10,
  #11). Every billing code path is built and live-tested against its
  degraded behavior, but Checkout/Portal/a-real-Stripe-webhook have never
  run against an actual account. Once it exists, three things need doing,
  not just testing: enable Stripe Tax and register jurisdictions
  (application-side `automatic_tax` wiring is done, the account-level
  config isn't), set receipt-email Branding copy to include the
  deductibility/voorbelasting-5b line, and create the real monthly/annual
  Prices to replace `STRIPE_PRICE_MONTHLY`/`STRIPE_PRICE_ANNUAL`'s
  placeholders in `wrangler.toml`. Needed before Pillar 6 can consider
  billing hardened; ideally obtained and walked through by hand before
  Pillar 6 starts, not during it.
- **Sentry DSN** — optional; degrades to structured console.error /
  `wrangler tail` today.
- **Resend API key + verified domain** — dev-logs mode covers local testing;
  a real key is needed before trusting actual reminder delivery, and
  required before Pillar 6 launch.
- **Custom domain(s)** — Pillar 6 cutover.
- **`docs/import-formats/` sample exports** — needed to build the three
  named import adapters (generic CSV path doesn't need them; still blocked,
  three `it.skip` markers waiting).
- **Browser Rendering access, confirmed against a real deployed
  environment** — the local-dev failure path is verified graceful
  (job → `failed`, no crash), but the actual PDF has never been generated
  for real; verify `[browser]` access and the rendered output the first
  time staging is exercised.
- Staging/production R2 buckets and Queues — self-provisionable, no user
  action needed; still placeholder names in `wrangler.toml`, to be created
  when Pillar 6 actually exercises those environments.
- **A real browser-testing capability** (Playwright, or manual click-through
  access) — Pillars 3, 4, and 5 together have shipped a large amount of
  frontend code verified only at the build/transform/unit-test level,
  never rendered. This is precisely what Pillar 6's Playwright e2e stage
  exists to close.

## Pillar 6: Hardening & launch — mostly complete (staging/production cutover BLOCKED)

The single biggest development this pillar: **real browser automation is
available in this environment** — contradicting every prior pillar's stated
"no browser automation tool available" limitation. Verified directly
(`npx playwright install chromium` — a real download — then a live
`chromium.launch()` round-trip) before relying on it. This closed the
standing frontend-verification gap Pillars 3, 4, and 5 all flagged.

### What's done

**D1-backed integration test harness (new capability, not just new tests)**

- `@cloudflare/vitest-pool-workers@0.12.0` (pinned — 0.13.0+ needs vitest
  ^4.1.0, this repo is on ^3.2.7) wired into `apps/api`: real D1/R2/Queues
  bindings under actual workerd, not Node mocks. `wrangler.test.toml`
  (test-only, omits `[browser]` — no local Miniflare simulation for it),
  `vitest.config.ts`, `vitest.setup.ts` (runs real migrations),
  `vitest-env.d.ts` (types `env` via `ProvidedEnv` module augmentation).
- Windows-specific reliability fixes, both verified by running the full
  suite twice in a row after each: `poolOptions.workers.singleWorker: true`
  (one Miniflare/workerd instance for the whole run — one-per-file-in-
  parallel intermittently refused loopback connections on Windows) and
  `isolatedStorage: false` (per-test storage snapshot/restore hit a
  Windows file-locking race — "EBUSY... unlink...sqlite" — specifically
  whenever a test deleted an R2 object; see the hard-delete-sweep tests
  below). Turning isolation off means D1/R2 state persists across every
  test in the run, which is safe everywhere except the IP-keyed rate
  limiter — `vitest.setup.ts` now clears `rate_limits` in a global
  `beforeEach` so accumulated sign-ups across unrelated tests don't start
  429-ing real ones partway through the suite.
- `src/integration/helpers.ts`: real sign-up/sign-in/onboard/invite helpers
  driving the actual HTTP surface (`SELF.fetch`), not shortcuts through
  directly-seeded session rows.

**Tests added, all real HTTP/D1/R2/Queue/Cron, not unit tests of internal functions**

- `tenant-isolation.test.ts` — two real orgs, real data, every cross-org
  read/list asserted 404/empty/unchanged. Satisfies the Definition of
  Done's "tenant isolation proven by a test running real requests as two
  orgs asserting zero crossover."
- `bookkeeper-role.test.ts` — exhaustive mutation-route enumeration (built
  by grepping every `.post`/`.patch`/`.put`/`.delete` across
  `routes/*.ts`), 17 mutation probes all asserted 403 for a bookkeeper,
  plus reads asserted 200. **Writing this test caught a real, previously
  unnoticed security gap**: `POST /onboarding/complete` had no
  `requireRole("owner")` guard — every other mutation route already did.
  Fixed in the same commit as the test that caught it, before the test was
  ever run green.
- `reminder-idempotency.test.ts` — two layers proven separately: the
  cron's pre-check (skips re-enqueueing once a log exists) and the actual
  guarantee (the consumer's `reminder_logs` unique-index insert, proven by
  feeding the consumer the identical message twice and asserting exactly
  one row).
- `year-rollover.test.ts` — real time-travel via
  `createScheduledController({ scheduledTime })`: Q4's deadline lands on
  31 Jan of the following year; `/income-tax/<next-year>` degrades to
  `figuresPending: true` with no fabricated number; a cron tick fired at a
  January instant computes days-until-due against that instant, not real
  wall-clock time (required refactoring `scheduled.ts`'s `fanOutReminders`
  to take `now: Date` from `event.scheduledTime` instead of calling
  `new Date()` internally — production-behavior-neutral).
- `backup-and-deletion.test.ts` — the weekly backup (see below) round-
  tripped through real R2 (a fresh org's row is really in the zip,
  including Better Auth's own `user` table, which isn't in `schema.ts`'s
  registry — discovered via `PRAGMA table_list`, not a hardcoded name
  list), pruning caps at 8; the hard-delete sweep (see below) proven to
  actually delete D1 rows, R2 objects, and cascade the auth session
  (post-sweep request with the old cookie: 401) for an org past the grace
  period, and to leave a too-recent one untouched.
- `security-probes.test.ts` — security headers present on every response;
  webhook forgery via live HTTP (no signature, garbage signature,
  wrong-secret signature, tampered payload all 400; a genuinely-signed
  payload 200, proving the rejections are real); receipt upload
  content-type bypass attempts (executable-disguised-as-no-content-type,
  disallowed-but-plausible `image/svg+xml`, parameterized
  `image/png; charset=binary` all 415; a real `image/png` 201).
- `load-reminder-fanout.test.ts` — 1,000 orgs seeded directly via chunked
  D1 inserts (D1 caps bound params at 100/statement, discovered by hitting
  it), one real cron tick: **~3.3s to scan and enqueue for all 1,000**
  (`reminder-fan-out-complete` logged `scanned:1000, enqueued:1000`),
  well under a generous 30s budget. Cleans up its own seeded orgs in a
  `finally` (isolatedStorage is off — leaving 1,000 rows behind would slow
  every later test in the suite, which is exactly what happened before the
  cleanup was added).
- `lib/stripe-webhook.test.ts` (Pillar 5) updated to use
  `generateTestHeaderStringAsync` — running under real workerd this pillar
  is what caught that the sync `generateTestHeaderString` needs a sync
  HMAC path only Node's polyfilled crypto has; real workerd's
  `crypto.subtle` is async-only. Confirms production code
  (`constructEventAsync` + `createSubtleCryptoProvider`) was already right.

**Weekly backup export + 30-day hard-cascade-delete sweep (`src/lib/backup.ts`)**

- `runWeeklyBackup`: enumerates every real D1 table via `PRAGMA table_list`
  (not a direct `sqlite_master` query — D1's authorizer rejects that,
  since it would expose Cloudflare's own internal bookkeeping tables),
  dumps each to its own JSON file, zips to
  `weekly/<iso-timestamp>.zip` in `BACKUPS`, prunes to the 8 most recent.
  Routed through Drizzle's `db.all(sql...)` rather than a raw
  `env.DB.prepare()` call — the latter hit a Miniflare-under-test bug
  (`D1DatabaseSessionAlwaysPrimary` / "_cf_METADATA.key is prohibited")
  that Drizzle's own query path doesn't.
- `sweepExpiredDeletions`: deletes every org past
  `deletionRequestedAt + 30 days` — R2 objects first (`RECEIPTS.list` by
  `${orgId}/` prefix, one `delete` at a time, not batched — a batch delete
  hit the same Windows R2 file-locking issue the isolatedStorage fix
  above addresses), then the `orgs` row (cascades every org-scoped table
  via the schema's own `onDelete: "cascade"` FKs), then the Better Auth
  `user` row explicitly (not reachable by that cascade — cascades run
  from `users.auth_user_id` → `user`, not the other way).
- Both run sequentially in one `ctx.waitUntil`, not two parallel ones — the
  backup should capture pre-sweep state, and running them concurrently is
  what caused the Windows file-locking issue above in the first place.
- The 30-day sweep was Pillar 5's own deferred deviation #3; it's now live.

**Backup restore — rehearsed locally, a real finding, not a rubber stamp**

A full disaster-recovery drill against the real local dev D1 (not staging —
no staging Cloudflare credentials exist in this environment): confirmed
real seeded data, `wrangler d1 export`'d it, backed up the D1 state
directory, deleted it (`rm -rf`) to simulate total loss, confirmed the
simulated loss, then attempted restore — which **failed twice** for two
different real reasons (pre-applying migrations before importing a full
export double-creates `d1_migrations`; `wrangler d1 execute --file`
against local D1 doesn't execute a multi-table file as one ordered batch,
so an FK-referencing INSERT can run before its target table's CREATE
TABLE). Restored the local dev D1 from the filesystem backup and verified
original row counts came back exactly — the dev environment was left
exactly as found. Full narrative and the corrected restore procedure (this
app's own per-table JSON backup, dependency-ordered) are in
`docs/deploy-runbook.md`. Restoring against **real** (non-local) D1 via
`--remote` goes through Cloudflare's actual import API, not local
Miniflare's batching, and remains the untested path — BLOCKED on staging
credentials, same as everything else in the cutover checklist.

**Playwright e2e — set up for real, three primary flows, plus a full visual pass**

- `e2e/` is a new workspace (`@kwartaal/e2e`), `playwright.config.ts` starts
  a real `wrangler dev` (via `apps/api/wrangler.e2e.toml` — a dev-only
  mirror of the default env omitting `[browser]`, because this wrangler
  version hard-fails `wrangler dev` startup entirely when Browser
  Rendering is declared and unavailable locally, not just the one route
  that uses it) and a real `vite dev`, then drives both with actual
  Chromium.
- **Flow 1** (`core-quarter-flow.spec.ts`): real onboarding wizard
  click-through (sign-up itself via the API — the UI is magic-link-only,
  no password field to drive headlessly) → Q3 income + expense lines via
  the real form → the mirror shows the correct computed owe amount → file
  → pay → `firstQuarterJustClosed: true` captured from the real response
  → VAT screen has genuinely moved on to Q4's fresh checklist. **Not
  covered**: "gates drop at next quarter → trial read-only → subscribe →
  gates reopen" — no time-travel exists for a live `wrangler dev` process
  (only the vitest-pool-workers harness has that, see
  `year-rollover.test.ts` above, which already proves the gate-drop logic
  itself), and the subscribe step needs a real Stripe account (BLOCKED).
- **Flow 2** (`receipt-vault-export.spec.ts`): real file upload via a
  hidden `<input type=file>`, checklist toggling, full account export
  enqueued and **actually processed by wrangler dev's real local Queues
  simulation** (auto-consumes, unlike the vitest harness which needs
  manual draining), downloaded zip verified as real non-trivial content.
  **Caught a real product bug**: `Vault.tsx`'s `RecentRecords` never
  refetched after a new receipt was captured (its `useEffect` only
  depended on `year`, fetched once on mount) — invisible to every prior
  API-level test since none of them looked at what the screen actually
  showed after an upload. Fixed with a `recordsVersion` counter bumped on
  capture, threaded through as a new effect dependency.
- **Flow 3** (`reminder-email.spec.ts`): a deadline seeded (via the real
  `wrangler` CLI against the same local D1 the dev server uses — SQL
  written to a temp file and passed via `--file`, not `--command`, since
  `execFileSync`'s `shell:true` word-splits an unquoted multi-word command
  string on Windows) exactly 7 real days out, cron fired via wrangler
  dev's own `--test-scheduled` local trigger endpoint, `reminder_logs`
  polled until a `t7` row appears. No time-travel needed — the deadline is
  genuinely 7 days from actual today.
- **Visual pass** (`visual-pass.spec.ts`): 19 screens screenshotted and
  asserted error-free — 11 marketing pages, 7 authenticated app screens (as
  the seeded Maya demo account, so real mid-October 2026 data renders, not
  an empty state), the onboarding welcome screen. Closes the standing gap
  every prior pillar's PROGRESS.md flagged. Screenshots spot-checked by
  hand (Today, Home, Vault) — render correctly, match the design system,
  no blank/broken states. One benign observation, not a bug: a screenshot
  taken immediately after the main heading appears can catch the
  account-menu widget still showing "Loading…" — real but sub-second.
- All 22 e2e tests (3 flows + 19 visual) pass together, run twice
  consecutively for reliability.

**Security pass**

Headers, webhook forgery, and upload content-type bypass covered by
`security-probes.test.ts` above; authz cross-org and the bookkeeper
mutation probe by `tenant-isolation.test.ts` / `bookkeeper-role.test.ts`.

**Docs**

`README.md` (repo root, didn't exist before this pillar), `docs/env.md`
(every var/secret, purpose, degraded-mode-when-absent), `docs/tax-figures.md`
(the yearly-update procedure — new year is always a new row, the existing
row is never edited; documents that the current 2026 row is a placeholder
mixing locked-decision figures with 2025 published rates, pending official
2026 publication), `docs/deploy-runbook.md` (deploy steps, the backup/
restore rehearsal narrative above, the staging→production cutover
checklist as concrete unchecked items, not vague prose).

### Gate results

| Check                                                                                                                                    | Result                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck` (5 workspaces incl. new `e2e`)                                                                                       | ✅                                                                                                                                                                                                               |
| `npm test` (154 tests: 93 core + 4 db + 48 api + 9 web, 3 skipped)                                                                       | ✅                                                                                                                                                                                                               |
| `npm run lint`                                                                                                                           | ✅                                                                                                                                                                                                               |
| `npm run format:check`                                                                                                                   | ✅ (one pre-existing untracked file, `VERIFICATION-PROTOCOL.md`, not part of this pillar's work, left untouched and unstaged)                                                                                    |
| `npm run token-check`                                                                                                                    | ✅ 0 violations, 0 exceptions                                                                                                                                                                                    |
| `npm run brand-check`                                                                                                                    | ✅ 0 violations (outside the two exempt files — see the brand-hygiene sweep note below)                                                                                                                          |
| `npm run build:web`                                                                                                                      | ✅                                                                                                                                                                                                               |
| `wrangler deploy --dry-run` (API)                                                                                                        | ✅ (3.68 MB / 605 KB gzip)                                                                                                                                                                                       |
| `apps/api` integration suite (real D1/R2/Queues/Cron under workerd)                                                                      | ✅ 13 files / 44 tests, run twice consecutively for reliability                                                                                                                                                  |
| e2e (real Chromium against real `wrangler dev` + `vite dev`)                                                                             | ✅ 22 tests (3 flows + 19-screen visual pass), run twice consecutively                                                                                                                                           |
| Backup restore rehearsal                                                                                                                 | ✅ performed locally (real disaster-recovery drill, two real failures found and documented, dev environment restored exactly) — **staging rehearsal BLOCKED**, no staging credentials                            |
| Load pass (1,000 orgs, one cron tick)                                                                                                    | ✅ ~3.3s scan+enqueue                                                                                                                                                                                            |
| Engine golden tests                                                                                                                      | ✅ (part of the 93 core tests above — unchanged from Pillar 2)                                                                                                                                                   |
| Accessibility scan (axe-core, `npm run test:a11y`)                                                                                       | ✅ self-contained CI step added, 10/10 marketing pages, 0 critical/serious — see the brand-hygiene sweep note below                                                                                              |
| Production cutover (custom domain, live Stripe/Resend/Sentry, TaxFigures 2026 real figures, uptime monitor, cron verified in production) | ❌ BLOCKED — no real Cloudflare/Stripe/Resend/Sentry credentials; this is a hard-to-reverse, shared-infrastructure action not taken unilaterally without explicit user authorization even if credentials existed |

### Deviations / notes

1. **Staging → production cutover is entirely BLOCKED**, not partially
   done — every item (custom domain, live Stripe keys + webhook, Resend
   domain verification, Sentry DSN, TaxFigures 2026 real published
   figures, uptime monitor, cron verified firing in production) needs
   real external credentials this environment doesn't have. Listed as a
   concrete checklist in `docs/deploy-runbook.md` rather than left vague.
2. **Accessibility scan was originally planned against an external sibling-
   product tool** — since resolved with a self-contained axe-core CI step
   added directly to this repo (see the brand-hygiene sweep note further
   below); no longer a dependency on anything outside this repo.
3. **The Stripe test-mode round-trip remains simulated, not real** (same
   BLOCKED status as Pillar 5) — flow 1's e2e deliberately stops before
   the subscribe step rather than faking a Stripe response.
4. **`apps/api`'s local D1/R2 test isolation runs with
   `isolatedStorage: false`**, a deliberate trade documented in
   `vitest.config.ts`'s own comment — every test creates its own
   uniquely-emailed org, so shared state across tests is safe except for
   the rate limiter, which is explicitly reset. This is a testing-harness
   choice, not a production behavior change.
5. **`e2e/tests/receipt-vault-export.spec.ts` fixed a real product bug**
   in `apps/web/src/routes/Vault.tsx` mid-pillar (see "What's done" above)
   — flagged here rather than left implicit, since it's exactly the kind
   of gap only real browser interaction (not API-level testing) can catch.
6. **The wrangler version in use (3.114.17) is several majors behind
   current (4.x)** — surfaced concretely by the backup-restore rehearsal's
   `wrangler d1 execute --file` ordering bug. Not upgraded this pillar
   (out of scope, and the workaround — this app's own per-table restore
   procedure — sidesteps it entirely for the path that actually matters,
   `--remote` against real D1). Worth a deliberate upgrade pass before
   relying on local `wrangler dev`/`d1` more heavily.
7. **`apps/api/wrangler.e2e.toml` is a third wrangler config**, alongside
   the real `wrangler.toml` and the vitest-only `wrangler.test.toml` — all
   three share the same D1 `database_id`/R2 bucket names for local dev
   (so `wrangler d1 execute` from anywhere resolves the same local file)
   but the vitest one uses differently-suffixed resource names
   (`kwartaal-test`) to stay isolated from real local dev data, while the
   e2e one deliberately shares the real dev resources — e2e-created test
   orgs accumulate in the same local D1 a human developer uses (harmless,
   same as any other local dev usage, and easily cleared with
   `npm run db:local:reset`).

### Brand-hygiene sweep

Housekeeping pass before certification: Kwartaal and the sibling product
this account also runs are separate products, and this repo needed to stand
alone — every "provata" mention (case-insensitive), whole repo, found via a
recursive grep and resolved so the underlying reasoning survived, only the
name dropped.

**Hits found and resolved** (18 total, across 4 tracked files —
`STACK-BLUEPRINT.md` never actually contained the word, so its stated
exemption turned out to be moot rather than needed; the one "sibling
product" attribution in `KWARTAAL-BUILD-PLAN.md`'s header that was
explicitly meant to stay turned out to be about a different product,
Hackiwi, and was never a Provata mention in the first place):

| File                     | Hits | Resolution                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KWARTAAL-BUILD-PLAN.md` | 5    | Genericized to "a sibling product in this account" / "the sibling product's cron" etc. across the Better Auth decision, the tenant-guard ESLint rule, the self-accessibility section (also replaced the Provata-scan dependency with a self-contained axe-core CI run), the Pillar 6 scope list, and the Definition of Done. |
| `PROGRESS.md`            | ~11  | Genericized throughout: gate-results table, deviations list, the Environment section's access-unblock narrative, the D1/R2/Queues comparison, the cron-limit finding, the DLQ note, and the Next-session note.                                                                                                               |
| `docs/deploy-runbook.md` | 1    | "the account's existing per-environment layout, used by a sibling product in the same account."                                                                                                                                                                                                                              |
| `apps/api/wrangler.toml` | 1    | Comment: "Mirrors the account's existing per-environment layout (see docs/deploy-runbook.md)."                                                                                                                                                                                                                               |

**User-facing surfaces** (marketing copy, legal pages, error messages,
email templates, test names, seed data): **zero hits** — nothing to
resolve there, so no High-severity findings.

**Tooling dependency removed**: the plan's self-accessibility check
originally called out to the sibling product's own scanning tool. Replaced
with a real, self-contained `@axe-core/playwright` scan
(`e2e/tests/accessibility.spec.ts`, `e2e/playwright.a11y.config.ts`) that
builds the marketing site (`npm run build:web`), serves it via `vite
preview`, and runs axe against all 10 marketing routes (`/`, `/pricing`,
`/how-it-works`, `/guide`, `/about`, `/companion`, `/privacy`, `/terms`,
`/dpa`, `/impressum`) tagged `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`/
`wcag22aa`, failing on any `critical`/`serious`-impact violation. Wired
into CI (`.github/workflows/ci.yml`) as its own step, after
`build:web` and a scoped `playwright install --with-deps chromium`, with no
dependency on any external product or account. `npm run test:a11y` runs it
locally.

Implementing the real scan surfaced **3 genuine, previously-unknown WCAG AA
contrast failures** in `apps/web/src/theme.css` — not caused by this sweep,
caught by finally running a real automated check instead of relying on the
(external, now-removed) tool: `--color-faint` at 2.36:1 against
`--color-wash` (well under the 4.5:1 bar — this token backs real deadline-
state information, not just decoration), `--color-body` at 4.02:1 (just
under the bar, caught on the footer's "Privacy & terms" link), and
`--color-accent` as small text on `--color-accent-tint` at 4.22:1 (caught
on the "Read this first" / "Not tax advice" disclaimer labels and two
similar callouts). Fixed by darkening `--color-faint` and `--color-body` in
place, and adding a new `--color-accent-ink` token (following the existing
`-ink` naming convention) for text-on-tint rather than darkening the shared
`--color-accent` brand color globally — that would have far wider blast
radius (buttons, links, icons) for a color CLAUDE.md documents as "deep
NL-orange, sparingly." Wired into `tailwind.config.js` as `accent.ink` and
applied at the three usage sites: `LegalPage.tsx`, `Guide.tsx`,
`Pricing.tsx`. All 10 pages now pass with 0 critical/serious violations.

**Guard added**: `scripts/brand-hygiene-check.mjs` — walks every
git-tracked file (`git ls-files`, so `node_modules`/`.wrangler`/build
output are naturally excluded without a separate ignore list) and fails on
any case-insensitive "provata" match outside two exempt files:
`STACK-BLUEPRINT.md` (external input document) and this file, `PROGRESS.md`
(the build log has to be able to name what a brand-hygiene sweep found and
fixed — the same reason a security report names the vulnerability it
closed — without permanently tripping its own guard). Wired into CI as its
own step (`npm run brand-check`), immediately after the existing
token-discipline check. Currently: **0 violations** outside the two exempt
files.

**Full gate re-run after the sweep + the axe-core contrast fixes**: all
green (see updated Gate results table above; typecheck/test/lint/format/
token-check/brand-check/build/a11y/dry-run all pass). One unrelated finding
surfaced and closed out along the way, documented for completeness: a full
sequential local e2e run intermittently 429'd on Maya sign-in
(`rate-limited`) after many back-to-back manual test invocations during
this session. Root-caused (not a regression from this sweep) to the `auth`
rate-limit bucket in `apps/api/src/middleware/rate-limit.ts` being keyed by
`cf-connecting-ip`, which local Miniflare never sets — so every local
request collapses onto one shared `auth:unknown` counter, and it persists
in the local D1 SQLite file across separate `wrangler dev` process
restarts. Confirmed by inspecting the local `rate_limits` table directly
(counts of 12–18 already accumulated in the 60s window from this session's
own repeated diagnostic runs) and by re-running the full suite from a
cleared table: **22/22 pass.** Not a product bug and not a CI risk — CI
always starts from an empty local D1, so a single clean run's own auth
traffic doesn't approach the limit of 20/60s. No code change made for this;
noted here rather than silently worked around.

## Environment

Topology decision (user-supplied, mirroring the account's existing
per-environment layout, already proven out by a sibling product in the same
account), now **fully live**, not just a plan — staging and production are
real, deployed, and verified end to end.

- **Pages**: `kwartaal-staging` (real project, deployed) →
  `staging.kwartaal.app` (custom domain **not yet attached** — dashboard-
  only, see below); `kwartaal-production` (real project, deployed) →
  `kwartaal.app` (same). No Git connection on either — deploys are manual,
  via `wrangler pages deploy`, triggered on green, never automatic on push.
- **Workers**: `kwartaal-api-staging` (deployed) → its `workers.dev`
  hostname; `kwartaal-api-production` (deployed) → `api.kwartaal.app`,
  attached as a real Worker custom domain (`routes = [{ pattern =
"api.kwartaal.app", custom_domain = true }]` in `[env.production]`) and
  verified live. Either way, the browser never calls the API domain
  directly — only the Pages project's same-origin proxy Function does
  (`apps/web/functions/api/[[path]].ts`). The `API` Fetcher service
  binding (which Worker each Pages project proxies to) is now **committed
  config**, not a manual per-deploy flag: `apps/web/deploy/
wrangler.staging.toml` and `wrangler.production.toml`. This wrangler
  version rejects `pages deploy --config <path>` outright ("Pages does not
  support custom paths for the Wrangler configuration file"), and Pages
  Functions auto-detection needs `functions/` as a literal sibling of
  wherever `wrangler.toml` lives — so the real deploy procedure is: copy
  the right per-env file to `apps/web/wrangler.toml` (gitignored,
  transient), run `wrangler pages deploy dist --branch=main` from
  `apps/web`, then remove it. Documented in both files' own comments and
  in `docs/deploy-runbook.md`.
- **Per-env resources — all real now**: D1 (already was, since Pillar 1),
  R2 buckets (`kwartaal-storage-staging`/`-backups-staging` and the
  `-production` pair), and Queues (`kwartaal-reminders-staging`/
  `-exports-staging` and the `-production` pair) all created for real via
  `wrangler r2 bucket create` / `wrangler queues create`. Never shared
  across environments.
- **HARD RULE — staging email safety**: unchanged from the original
  decision — staging runs the full cron/queue
  reminder pipeline against real org data but must never deliver email to
  an arbitrary address. `EMAIL_ALLOWLIST` (comma-separated, plain var, not
  secret) gates every send in `email/resend.ts`'s `isAllowedRecipient`: in
  staging, a recipient not on the list is logged, not sent — the same
  dev-logs treatment local dev already gets. Production reads no
  allow-list at all — the gate function returns `true` immediately for any
  non-staging environment. An **unset or empty** `EMAIL_ALLOWLIST` in
  staging denies every recipient (fail closed), not "allow everything" —
  tested explicitly (`email/resend.test.ts`'s fourth case), since the
  opposite default would silently reopen the exact hole this rule exists
  to close. `resend.test.ts` (4 tests, all passing) is the required proof:
  a non-allowlisted staging recipient never reaches `fetch`; an
  allowlisted one does (case/whitespace-insensitive match); an empty
  allow-list blocks everything; production sends regardless of what
  `EMAIL_ALLOWLIST` contains. **Still a placeholder in the real deployed
  staging Worker right now** — `EMAIL_ALLOWLIST` is `REPLACE_WITH_STAGING_
EMAIL_ALLOWLIST`, meaning staging currently blocks _every_ send (the
  safe failure mode, but not yet configured with real addresses).

### Access unblock — both parts resolved

Two separate issues, not one:

1. **`d1`/`r2 bucket`/`queues` listing** — wrangler's own account
   auto-discovery failing under a scoped token, not a permissions gap.
   Fixed by pinning `account_id = "147db6fed4f442dd3eb80aae7701ce8a"` at
   the top of `wrangler.toml`.
2. **`pages project list` / `pages deploy`** — a **different** mechanism:
   Pages subcommands don't read `wrangler.toml`'s `account_id` field at
   all; they need `CLOUDFLARE_ACCOUNT_ID` set as an actual environment
   variable. Once set, `wrangler pages project list` immediately worked
   and showed the sibling product's real projects (its staging and
   production Pages projects — confirming "No Git connection" matches the
   topology description exactly) — the token already had the Cloudflare
   Pages permission the whole time; it was never a permissions problem.

Re-tested after pinning `account_id` (before the `CLOUDFLARE_ACCOUNT_ID`
fix was found):

| Command                       | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `wrangler d1 list`            | ✅ works — confirms `kwartaal` / `kwartaal-staging` / `kwartaal-production` (all real, matching the IDs already in `wrangler.toml`), and shows the sibling product's own staging/production D1s exist alongside them in the same account.                                                                                                                                                                                                                                                                                                                                                                                      |
| `wrangler r2 bucket list`     | ✅ works — confirms `kwartaal-storage` / `kwartaal-backups` (dev) exist; **no staging/production Kwartaal buckets exist yet**. The sibling product's real R2 buckets follow a `<product>-<resource>-<env>` convention (one "assets" bucket per env) — Kwartaal's own R2 bindings are already named `RECEIPTS`/`BACKUPS` (two buckets, not one "assets" bucket), so this doesn't map 1:1 — `wrangler.toml` currently uses `kwartaal-storage-staging`/`kwartaal-backups-staging` (and the `-production` pair), consistent with Kwartaal's own two-bucket shape rather than force-fitting the other product's single-bucket name. |
| `wrangler queues list`        | ✅ works — confirms `kwartaal-reminders` / `kwartaal-exports` (dev, unsuffixed) exist; **no staging/production Kwartaal queues exist yet**. The sibling product uses one queue per env plus an explicit dead-letter queue; Kwartaal's `wrangler.toml` doesn't declare DLQs for `REMINDER_QUEUE`/`EXPORT_QUEUE` in any environment, dev included. Worth a deliberate follow-up decision (not made unilaterally here), not a name-mirroring gap.                                                                                                                                                                                 |
| `wrangler pages project list` | ❌ failed at this point — resolved moments later by setting `CLOUDFLARE_ACCOUNT_ID` (see above), not by a permission grant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

### What got provisioned and deployed, in order

1. Four R2 buckets created (`kwartaal-storage-staging`, `kwartaal-backups-
staging`, `kwartaal-storage-production`, `kwartaal-backups-production`).
2. Four queues created. **Real finding**: this wrangler version's default
   `message_retention_period` (345600s / 4 days) exceeds the live API's
   current max (86400s / 1 day) — `wrangler queues create` fails with
   "invalid settings" against the default; every queue needed
   `--message-retention-period-secs 86400` explicitly.
3. Both Pages projects created (`kwartaal-staging`, `kwartaal-production`).
4. Staging D1: migrations applied + the Maya demo seed loaded for real
   (120 rows, 31 tables) — staging is meant to be exercised, not empty.
5. `kwartaal-api-staging` deployed. **Real finding #1**: the live Cloudflare
   API rejects cron day-of-week `0` (Sunday) — `"0 3 * * 0"` fails with
   "invalid cron string" even though it's standard Unix cron syntax and
   passed every local `--dry-run` throughout Pillar 6 (dry-run never
   validates cron syntax against the real endpoint). Cloudflare requires
   `1-7` (`7` = Sunday), not `0-6`. Fixed to `"0 3 * * 7"` everywhere it
   appeared: all three `wrangler.toml` blocks, `wrangler.test.toml`,
   `wrangler.e2e.toml`, `backup-and-deletion.test.ts`, and
   `docs/deploy-runbook.md`. **First pass missed `scheduled.ts`'s own
   dispatch check** (`if (event.cron === "0 3 * * 0")`) — since the
   deployed trigger now sent `"0 3 * * 7"`, the string comparison never
   matched, meaning the weekly backup + hard-delete sweep would **never
   have fired**, silently, in any real environment. Caught by running the
   full test gate before considering the work done (two
   `backup-and-deletion.test.ts` cases failed — "expected 0 to be greater
   than 0" for the backup zip, org row not deleted for the sweep) — not
   caught by manual spot-checking. Fixed, both staging and production
   Workers redeployed afterward since the bug was live in both.
6. Staging Pages deployed with the `API` service binding wired.
   **Real finding #2**: `functions/api/[[path]].ts`'s
   `new Request(url, context.request)` silently drops the `Origin`
   header — it's a forbidden/restricted header name per the Fetch spec,
   and workerd enforces that even for this same-process service-binding
   "fetch." Without it, every CSRF/trustedOrigins-checked request (i.e.
   every real sign-in) failed with `403 INVALID_ORIGIN` when going through
   the deployed Pages proxy, despite working perfectly hitting the Worker
   directly. This would have broken production too, not just staging
   verification — fixed by explicitly re-reading and re-setting the
   Origin header from the original request before forwarding.
7. Real `BETTER_AUTH_SECRET` generated (32 random bytes, base64) and set
   via `wrangler secret put` for **both** staging and production — neither
   is committed anywhere; both only exist as Cloudflare secrets.
8. `APP_ORIGIN` for both environments now trusts both the eventual custom
   domain (`staging.kwartaal.app` / `kwartaal.app`, not yet attached) and
   the currently-real `.pages.dev` URL, so auth actually works today, not
   only after the custom domain attaches. Drop the `.pages.dev` entry from
   each once its custom domain is live.
9. **Account-wide cron trigger limit hit**: the account's plan capped cron
   triggers at 5 total; 4 were already in use (`kwartaal-api-staging`: 2,
   the sibling product's production Worker: 1, its staging Worker: 1 —
   confirmed via direct Cloudflare API calls to `/workers/scripts` and
   each script's `/schedules` endpoint, not guessed), leaving no room for
   production's 2. Discussed trade-offs (drop staging's weekly backup cron
   since staging data is disposable and reproducible from `seed.sql`, vs.
   the equivalent cut on the sibling product's side, vs. upgrading the
   plan) — **user upgraded off the Free tier** rather than sacrifice any
   cron, so no crons were removed from anywhere.
10. `kwartaal-api-production` deployed for real: custom domain
    `api.kwartaal.app` attached and verified (`curl` returns the real
    `{"ok":true,"service":"kwartaal-api","environment":"production"}`),
    both cron triggers registered, queue bindings live. **D1 migrations
    applied to production (schema only, no seed — stays "unseeded" per
    instruction)** — this one write action to real production
    infrastructure was explicitly confirmed with the user before running,
    since Claude Code's own safety layer flagged it.
11. Production Pages deployed with its service binding. Verified via
    `GET /api/auth/get-session` through the real `kwartaal-production.
pages.dev` origin → `null` session, 200 — correct for an intentionally
    unseeded production database with zero accounts.

### Verified live (real HTTP, not assumed)

- `https://kwartaal-api-staging.<account-subdomain>.workers.dev/health/ready`
  → `200 {"ready":true,"checks":{"database":true}}`
- `https://kwartaal-staging.pages.dev` → real sign-in as Maya through the
  full Pages → Worker (service binding) → D1 chain, then a real
  `GET /orgs/me` returning her actual seeded business profile.
- `https://api.kwartaal.app/health` and `/health/ready` → both 200, real
  custom domain.
- `https://kwartaal-production.pages.dev` → full chain reachable, correctly
  returns no session (unseeded, as intended).

### Pages custom domains — live

Correction to the earlier "dashboard-only" assumption above: Pages custom-
domain **attachment** is not wrangler-supported but **is** a real REST
endpoint (`POST /accounts/:id/pages/projects/:project/domains`), and it
worked cleanly with the existing token. The one piece the API doesn't do
for you (the dashboard flow does, silently) is create the DNS record —
that needed the token's `Zone → DNS → Edit` permission on the `kwartaal.app`
zone added after the fact (it initially came back `{"code":10000,
"message":"Authentication error"}` on every `dns_records` call; the zone's
own `permissions` field confirmed the gap before the grant and confirmed
the fix after — `#dns_records:edit`/`#dns_records:read` appeared in that
same field once added). Both domains are now fully live and verified with
real requests, not assumed from Cloudflare's own "active" status alone:

- [x] `kwartaal.app` attached to `kwartaal-production`
      (domain id `82f8343d-e5b1-4cf4-acb4-ce59d78dbc7a`).
- [x] `staging.kwartaal.app` attached to `kwartaal-staging`
      (domain id `ad83f5af-f663-4557-b866-36501950f156`).
- [x] Zone confirmed via `GET /zones?name=kwartaal.app` (not guessed):
      `a47130f4c2dc9c245002c71ba5734c5d`.
- [x] DNS: the apex `kwartaal.app` record was a pre-existing Namecheap
      parking A-record (`162.255.119.67`, proxied) — **replaced in place**
      (`PUT .../dns_records/:id`) with a proxied CNAME to
      `kwartaal-production.pages.dev`. `staging.kwartaal.app` had no
      existing record; created fresh as a proxied CNAME to
      `kwartaal-staging.pages.dev`. The zone's pre-existing MX + SPF TXT
      records (Namecheap email forwarding) were left untouched — out of
      scope and unrelated to web routing.
      (Note for next time: the record-type-change `PUT` call returned a
      deprecation notice — "DNS record type update is deprecated" — still
      worked, but a future session should use delete+create instead.)
- [x] Both domains reached `status: active` with a certificate within
      ~4 minutes of the DNS change (well under the ~15 min budget):
      production active at +~1.5 min, staging at +~3.5 min.
- [x] Verified live: `https://kwartaal.app` and `https://staging.kwartaal.app`
      both resolve with valid Google-issued certs (CN matching, expiring
      2026-10-21) and return 200. `/api/health` on both returns the
      correctly-scoped `{"ok":true,"environment":"production"|"staging"}`
      through the real same-origin proxy — not the Worker's own origin.
      A full sign-up → sign-in → authenticated `/api/orgs/me` round-trip
      against `staging.kwartaal.app` succeeded with a real session cookie
      from the real domain. Maya's seeded demo account signs in on staging
      too.
- [x] Both Workers **redeployed** (`wrangler deploy --env staging` /
      `--env production`) after dropping each environment's `.pages.dev`
      entry from `APP_ORIGIN` in `wrangler.toml` — a `wrangler.toml` edit
      alone doesn't touch what's already live. Re-verified after redeploy:
      the staging smoke suite (below) still passes, and — confirming the
      origin-trust actually tightened, not just "nothing broke" — a
      sign-in attempt with `Origin: https://kwartaal-staging.pages.dev` (or
      the production equivalent) now correctly gets `403`.
- [x] `e2e/playwright.staging.config.ts` + `e2e/tests/staging-smoke.spec.ts`
      (`npm run smoke:staging` from `e2e/`): health check, marketing home
      page, and Maya sign-in + Today render, all against the real
      `staging.kwartaal.app` — deliberately narrow and deliberately
      separate from the local dev-stack suite, since `helpers.ts`'s
      `d1Execute`/`d1QueryFirst` assume a local `wrangler dev` D1 file with
      no remote equivalent here. (Caught one real bug writing this: the
      standalone Playwright `request` fixture is a _different_ cookie jar
      than `page`'s — had to switch to `context.request` for the sign-in
      call to actually authenticate the subsequent `page.goto()`, matching
      why `helpers.ts`'s own `apiSignUp` already threads `context`
      through explicitly.)

**Live URLs**: `https://kwartaal.app`, `https://staging.kwartaal.app`,
`https://api.kwartaal.app` (unchanged), `https://kwartaal-api-staging.
<account-subdomain>.workers.dev` (unchanged).

### Real gap found: Pages was never actually redeployed after auth surfaces

Pushing the whole Auth-surfaces pillar (and everything after it) to GitHub
never touched the live Pages sites — both projects were created via
`wrangler pages project create` (Direct Upload), which has no Git
connection at all, so nothing was watching `main` for changes. The user
caught this directly ("I am still seeing the old auth page design"),
confirmed by comparing the live site's JS bundle hash against a fresh
local build — they didn't match. Fixed in two parts:

1. Deployed the current build to both `kwartaal-staging` and
   `kwartaal-production` by hand (the documented `cp deploy/wrangler.*.toml
wrangler.toml && wrangler pages deploy dist ...` procedure) — verified
   live afterward (new bundle hash on both, `"Use password instead"`
   confirmed present in the served JS, `/api/health` still correct).
2. **Closed the actual root cause**, not just this one instance of it:
   tried the obvious fix first — connecting the Pages projects to GitHub
   natively — and hit a real, confirmed wall: `PATCH .../pages/projects/
:name` with a `source` object returns `{"code":8000069,"message":"You
cannot update the \`source\` object in a Direct Uploads project."}`.
Direct Upload is a one-way door; there's no API or dashboard path to
convert an existing one to Git-connected — only creating a brand-new
project would get native integration, which would mean re-attaching
both custom domains and the Worker service binding, a real migration
with live-traffic risk the user didn't ask for here. Instead, added a
`deploy-pages`job to`.github/workflows/ci.yml`: runs after `verify`goes green on a push to`main`, builds, and runs the same
`wrangler pages deploy`for both environments that used to be a manual
step.`CLOUDFLARE_API_TOKEN` added as a GitHub Actions repo secret
(`gh secret set`) — same value as local `wrangler`auth, scoped
separately. From here forward, a green push to`main` **is** a real
deploy for both Pages and the marketing/app frontend; the API Worker
(`wrangler deploy --env ...`) deliberately stays a manual step (see
"Normal deploy" in `docs/deploy-runbook.md` for why).

### Still open

- `EMAIL_ALLOWLIST` for staging is still `REPLACE_WITH_STAGING_EMAIL_
ALLOWLIST` (fails safe — blocks all sends — but needs real addresses to
  actually be useful for testing reminder delivery).
- Stripe keys/prices, `RESEND_API_KEY` + domain verification, `SENTRY_DSN`,
  and real (non-placeholder) TaxFigures 2026 figures remain exactly as
  BLOCKED as documented earlier in this file — none of those credentials
  were touched this session.
- Queues declared with no dead-letter queue in any Kwartaal environment
  (the sibling product's do have one per env) — a deliberate follow-up
  decision, not made unilaterally here.

## Auth surfaces

Full pixel-faithful implementation of `docs/design/.../Kwartaal Auth.dc.html`
(session 3): sign in, sign up, check-your-inbox, magic-link outcomes,
forgot/reset password, bookkeeper invite acceptance, and the three auth
emails — wired to the existing Pillar 1 Better Auth setup, not a
reconfiguration of it.

### What's done

**Backend (`apps/api`)**

- `auth/index.ts`: magic-link `expiresIn` and `emailAndPassword.
resetPasswordTokenExpiresIn` both set to 15 minutes (one shared constant,
  `auth/constants.ts`, so the emailed "expires in 15 minutes" copy can
  never drift from what's actually enforced); `minPasswordLength` raised
  8 → 10 to match the design's reset-password hint copy; `sendResetPassword`
  wired to a new `email/deliver-password-reset.ts` (Better Auth's own
  `requestPasswordReset` already has anti-enumeration built in — dummy
  verification lookup + identical response for a missing user — verified
  by test, not just assumed).
- **A real, previously-unexercised bug found and fixed**:
  `email/rewrite-auth-link.ts`. Better Auth builds magic-link/reset-
  password URLs on `BETTER_AUTH_URL` (the Worker's own origin), but
  `apps/web/functions/api/[[path]].ts`'s same-origin proxy exists
  specifically because a cookie set on the Worker's origin never comes
  back on the app's own subsequent requests. Every prior e2e sign-up went
  through the API directly (see `core-quarter-flow.spec.ts`'s own note) —
  nobody had actually clicked an emailed link before this pillar's e2e
  flow did. Fixed by rewriting the link's origin to `APP_ORIGIN` (path/
  query untouched) before it's ever sent, routing the click through the
  same same-origin proxy every other auth request already uses. Same fix
  applies to both magic-link and password-reset emails.
- `middleware/redirect-guard.ts`: Better Auth's `sign-in/magic-link`
  endpoint runs no `originCheck` on `callbackURL`/`errorCallbackURL` (its
  own `requestPasswordReset` does, on `redirectTo` — confirmed by reading
  the installed version's source, not assumed). Since a real session
  cookie is set before the redirect fires, an unchecked callbackURL is a
  genuine phishing vector: a direct API call naming a victim's email and
  an attacker-controlled `callbackURL` would still mail that victim a
  legitimate Kwartaal link. Added as its own composable middleware next to
  the existing `rateLimit`, checking body + query params against
  `parseTrustedOrigins` before the request ever reaches Better Auth's
  handler.
- `email/auth-email-shell.ts` + rewritten `deliver-magic-link.ts`,
  `deliver-bookkeeper-invite.ts`, new `deliver-password-reset.ts`: the
  design's mark/wordmark/card/footer email template, HTML + plain-text,
  same dev-logs/prod-sends/staging-allowlist pattern as every other email
  in the app.
- `routes/invite-preview.ts`: three distinct responses matching the
  design's three states — 200 (valid, full preview incl. the inviting
  owner's name and legal form), 410 (expired — still names the inviter, so
  "ask Maya to send a fresh one" is possible), 404 (never existed or
  already consumed — no context invented). New `POST /invite-preview/
:token/decline` (public, same threat model as the existing public preview
  GET): deletes the invite, writes an `invite_declined` row to the
  existing-but-previously-unused `notifications` table (the design's email
  copy promises "Maya has been notified" — this makes that literally
  true, proven by test, even though there's no notification-inbox UI yet
  to surface it), and an audit-log entry.
- `routes/invites.ts`: now looks up the inviting owner's `authUser.name`
  (falling back to org name) so both the invite email and the
  AcceptInvite page can say "Maya Lindqvist invited you" instead of a
  generic line.
- `wrangler.toml`: `EMAIL_FROM` updated to `Kwartaal <hello@mail.
kwartaal.app>` (was a `.example` placeholder) across all three
  environments.
- **A real rate-limit false positive found and fixed**:
  `/api/auth/get-session` — a read-only cookie check with zero
  credential-testing value — shared the same 20/60s per-IP bucket as
  sign-in/sign-up/magic-link/reset-password. Every page mount's
  `useSession()`/`useMe()` fires it, so on a shared/NAT'd IP (or, in
  local dev and CI, an IP that's always literally the string `"unknown"`
  since Miniflare never sets `cf-connecting-ip`) ordinary navigation alone
  could exhaust the whole budget and lock a real user out of actually
  signing in. Confirmed empirically: a clean full e2e run measured 32
  `/api/auth/*` hits in one 60s window, 11 of them bare `get-session`
  reads. Excluded `get-session` from the rate limit in `index.ts` — every
  credential-testing/enumeration-relevant endpoint stays fully protected.

**Frontend (`apps/web`)**

- `components/AuthShell.tsx`: the design's shared shell (mark + wordmark
  over a single card on `wash`), reused by every auth screen.
- `lib/return-to.ts`: `sanitizeReturnTo` — same-origin-relative-path-only
  allow-list for the post-auth destination (redirect discipline: "never
  open redirects"). `RequireAuth.tsx` now appends `?returnTo=` when
  bouncing an unauthenticated deep link to `/signin`; `lib/api.ts`'s
  previously-unwired `setOnUnauthenticated` hook is now wired in `App.tsx`
  to the same mechanism for a session that expires mid-use (the design's
  "Expired session redirect" state) — that hook existed since Pillar 1 and
  had never been called until now.
- Rewritten `routes/SignIn.tsx` (magic link default, password disclosure,
  wrong-password error, rate-limited state reading the real
  `retry-after`-adjacent window rather than a fabricated countdown,
  expired-session banner) and new `routes/SignUp.tsx`, `CheckYourInbox.tsx`
  (live 30s resend cooldown, shared by magic-link sign-in/sign-up/
  password-reset requests), `LinkExpired.tsx`, `ForgotPassword.tsx`,
  `ResetPassword.tsx`; rewritten `AcceptInvite.tsx` (accept via magic link
  or password, decline, expired-with-inviter-name, not-found).
- `LinkExpired.tsx`'s amber-vs-neutral split: Better Auth collapses
  expired/already-used/invalid/forged into one `INVALID_TOKEN` error with
  no way to distinguish them server-side (confirmed by reading the
  installed plugin's source). The `email` query param is never decoded
  from the token — it's one this app attaches to `errorCallbackURL` itself
  when _this browser_ sent the link (`lib/auth-resend.ts`), so its
  presence means "we know what this browser was trying to do" (amber,
  targeted resend) and its absence means a stale/forwarded/forged link
  (neutral, deliberately vague, exactly as the design specifies).
- `theme.css`/`tailwind.config.js`: one new token, `--color-amber-border`
  (4+ reuses across the expired/rate-limited states — the existing amber
  trio had no border variant).
- Auth-client (`lib/auth-client.ts`) now also exports `signUp`,
  `requestPasswordReset`, `resetPassword` (previously only `signIn`).

### Gate results

| Check                                                    | Result                                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                      | ✅                                                                                                                      |
| `npm test` (169 tests: 93 core + 4 db + 56 api + 16 web) | ✅ (+8 api: anti-enumeration pair, redirect-guard, invite reuse/expiry/decline; +7 web: `sanitizeReturnTo`)             |
| `npm run lint`                                           | ✅                                                                                                                      |
| `npm run format:check`                                   | ✅ (pre-existing untracked `VERIFICATION-PROTOCOL.md` unchanged)                                                        |
| `npm run token-check`                                    | ✅ 0 violations                                                                                                         |
| `npm run brand-check`                                    | ✅ 0 violations                                                                                                         |
| `npm run build:web`                                      | ✅                                                                                                                      |
| `npm run test:a11y` (marketing site, unchanged scope)    | ✅ 10/10                                                                                                                |
| e2e (real Chromium, real `wrangler dev` + `vite dev`)    | ✅ 24/24 (+2: magic-link click-through against the real dev-mailbox D1 row, password sign-in + forgot/reset round-trip) |
| `wrangler deploy --dry-run` (API)                        | ✅                                                                                                                      |

### Deviations / notes

1. **Bookkeeper-invite "Use password instead" is a real signup path**,
   not just magic link — since invited emails can never already have an
   account (enforced at invite-creation time), `signUp.email` on the
   invited address correctly triggers the same `consumeInviteIfPending`
   hook as magic link.
2. **The consent-as-checkbox sign-up variant from the design was not
   built** — only the "consent as line" default. The design itself frames
   the checkbox as "if legally required," and nothing in this pillar's
   scope established that requirement; adding it is a one-line change
   later if it ever is.
3. **`accessibility.spec.ts`'s axe-core scan was deliberately left scoped
   to the marketing site** — `KWARTAAL-BUILD-PLAN.md`'s Definition of Done
   names "the marketing site" specifically, and this pillar's own gate
   list didn't call for widening it. Auth-page accessibility (autocomplete
   attributes, label associations, focus-moved-to-error, aria-invalid/
   describedby) was built to the same standard throughout but isn't
   currently proven by an automated axe run the way the marketing site is.
4. **Two real, previously-latent bugs were caught by finally building this
   pillar's required e2e flows** rather than by design review: the cross-
   origin magic-link/reset-password cookie bug (item above), and the
   `get-session` rate-limit false positive. Neither was hypothetical —
   both were reproduced with evidence (a 302 landing on the wrong origin;
   a clean-state 32-hits-in-60s count) before being fixed, per the
   systematic-debugging discipline this session followed throughout.

## Mobile + responsiveness audit — Phase A (audit only, no code changes)

Per explicit instruction: audit first, findings to PROGRESS.md, **STOP for
confirmation before any remediation**. No code changed in this phase.

**Methodology**: real local dev stack (`wrangler dev --config
wrangler.e2e.toml` + `vite dev`, the same pairing the e2e suite uses),
Playwright device emulation at 390/768/1280px, seeded Maya demo account for
authenticated surfaces. 57 full-page screenshots + a `document.
documentElement.scrollWidth` vs `clientWidth` measurement (objective
horizontal-overflow detection, not eyeballed) captured **this session**
against current HEAD (`42e64dd`), saved to `e2e/test-results/mobile-audit/`
(gitignored, same convention as `visual-pass.spec.ts`'s own screenshots —
inspect locally, not committed) plus `results.json` with the raw
measurements for every shot. Every status below cites the specific
screenshot file backing it, per the design-fidelity evidence standard
(`VERIFICATION-PROTOCOL.md`). A repo-wide `grep` for Tailwind's `md:`/
`sm:`/`lg:`/`xl:` breakpoint prefixes across every route, marketing page,
and shell component returned **zero matches** — confirmed before touching
a browser, then confirmed by what the browser actually renders.

### Track A1 — the four phone-critical moments (`Kwartaal Mobile.dc.html`, 390px)

#### Moment 1 — the reminder lands (Today, mobile)

| #   | Spec element                                                                                             | Status        | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | Mobile Today card composition (one card, two-action pair)                                                | **Missing**   | `apps/web/src/routes/Today.tsx` has no mobile variant at all — same `HeroCard` renders at every viewport. `390-app-today.png`: the desktop card renders squeezed into ~166px next to a fixed 224px sidebar that never collapses.                                                                                                                                                                                                                    |
| 1.2 | "Remind me at my laptop tonight" → schedules a same-day 19:00 reminder, reopens the checklist on desktop | **Missing**   | No such control exists in `Today.tsx`. Backend: `packages/db/src/schema.ts`'s `ReminderStage` (`packages/core/src/tax/reminders.ts:12`) is a closed union — `t14\|t7\|t2\|day\|overdue_1\|overdue_2\|overdue_3` — all deadline-relative, computed by `dueReminderStage`. There is no same-day/user-triggered/one-off kind, and nothing enqueues to `REMINDER_QUEUE` outside `scheduled.ts`'s hourly fan-out. Genuinely absent, not just unwired UI. |
| 1.3 | "Start on the phone anyway" → enters the VAT checklist                                                   | **Partially** | `Today.tsx`'s existing "Preview the Q3 checklist" button already navigates to `/app/vat` — the destination exists, the mobile-specific framing/copy and the paired handoff choice do not.                                                                                                                                                                                                                                                           |
| 1.4 | Set-aside progress register (bar, €X of €Y, "move €X more")                                              | **Partially** | `SetAsideCard` in `Today.tsx` shows a figure but not a progress-bar register against a target — different composition from the design's bar.                                                                                                                                                                                                                                                                                                        |
| 1.5 | Hours tally with pace, on the Today card                                                                 | **Missing**   | No hours data appears anywhere on `Today.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.6 | Bottom tab nav (Today/VAT/Money/Vault)                                                                   | **Missing**   | `apps/web/src/app/AppShell.tsx:72-114` is a single unconditional sidebar `<nav>`, `w-56` fixed, at every viewport — no bottom-bar variant. Same root cause as A3's dashboard findings below.                                                                                                                                                                                                                                                        |

**Moment 1 overall: Missing.** The desktop screen exists and is reachable at 390px, but none of the mobile-specific composition or the handoff-reminder behavior does.

#### Moment 2 — catch a receipt

| #   | Spec element                                                                                       | Status                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Six-element checklist verified before save                                                         | **Fully Implemented** (correctly scoped) | `apps/web/src/routes/Vault.tsx`'s `ReceiptCapture` + `apps/api/src/routes/receipts.ts` implement the six-element checklist. The design's "verified live" / camera-reads-it framing is OCR — explicitly out of v1 scope per `KWARTAAL-BUILD-PLAN.md` locked decision #9 ("OCR on receipts... manual six-element checklist in v1"). Manual toggle-confirm is the correct v1 behavior, not a gap.                                                                                                    |
| 2.2 | Camera-first capture (full-screen, dark, in-frame guide)                                           | **Missing**                              | `Vault.tsx:143-152`: plain `<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf">`, no `capture` attribute, rendered as a small 150×200px thumbnail button inside the desktop Vault layout — not a full-screen mobile camera flow.                                                                                                                                                                                                                                         |
| 2.3 | Missing element over €100 → "save with a note" (note stored with the photo) + Retake               | **Missing**                              | No €100 threshold logic anywhere in `Vault.tsx` or `receipts.ts`. No note field exists in the data model at all: `packages/core/src/contracts/vault.ts:71` — `checklistElementSchema = z.object({ confirmed: z.boolean() })`, nothing else. This is a backend gap, not just a missing UI state.                                                                                                                                                                                                   |
| 2.4 | Success state: Vault storage confirmed, 7-year line, btw queued to the correct quarter's checklist | **Partially**                            | The Vault footer states the 7-year retention period (`Vault.tsx:81-84`) at the page level, not as a per-capture success confirmation. "btw queued to the correct quarter's checklist" is **Missing** — receipts (`schema.receipts`) and VAT expense lines (`schema.expenseLines`) are two unconnected tables; nothing links a captured receipt to a quarter's checklist. (Contrast: `StartupCostsCorner` in the same file _does_ create a real expense-line — the receipt-capture path does not.) |
| 2.5 | "Catch another" loop                                                                               | **Partially**                            | `Vault.tsx:190-196` has "Add another," functionally equivalent, different framing.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2.6 | Mobile layout                                                                                      | **Missing**                              | `390-app-vault.png`: `DataExportButton` text and the search input are visibly clipped off the right edge of the viewport — not just cramped, actually cut off.                                                                                                                                                                                                                                                                                                                                    |

**Moment 2 overall: Missing.** The core checklist mechanic is correctly built to v1 scope; the mobile capture entry point, the note-fallback rule, and the VAT-quarter linkage are all absent, two of them at the data-model level.

#### Moment 3 — an invoice is paid, the split ritual

| #   | Spec element                                               | Status                | Evidence                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Three-band split (yours / btw hatched-exact / reserve)     | **Fully Implemented** | `apps/web/src/routes/Money.tsx`'s `Splitter` calls the real `splitInvoice` from `@kwartaal/core` (`Money.tsx:5,73`) — same function the marketing calculator and the API's `/money/set-aside-entries` route use. Visual band composition matches.                                               |
| 3.2 | Paid-invoice trigger framing ("A client just paid you €X") | **Missing**           | `Splitter` is a standalone manual calculator + logger (type an amount, pick a rate, log it) — nothing frames it as responding to a payment event.                                                                                                                                               |
| 3.3 | Single combined "Move €X to the Taxes pot" instruction     | **Missing**           | Not present; `Money.tsx` shows the three band amounts separately, no combined-transfer instruction line.                                                                                                                                                                                        |
| 3.4 | "I moved it — done" / "Remind me tonight" two-choice flow  | **Missing**           | `logSplit()` (`Money.tsx:78-101`) is a single "log it" action with no such choice.                                                                                                                                                                                                              |
| 3.5 | Pinned-to-Today persistence for an unconfirmed split       | **Missing**           | `schema.setAsideEntries` (`packages/db/src/schema.ts:369-384`) has no status/pending/moved field of any kind — `totalCents`/`vatCents`/`reserveCents`/`rateBps`/timestamps only. There is nothing to pin; a logged entry is just a completed record, not a two-state (pending → confirmed) one. |
| 3.6 | "No bank connection" honesty line                          | **Fully Implemented** | `Money.tsx:38-39`: "No bank connection — a 30-second ritual, not bookkeeping." present verbatim in spirit.                                                                                                                                                                                      |
| 3.7 | Mobile layout                                              | **Missing**           | `390-app-money.png`: sidebar squeeze, same as Moment 1/2.                                                                                                                                                                                                                                       |

**Moment 3 overall: Missing.** The math and the honesty line are right; the ritual's actual behavior (trigger framing, combined instruction, two-choice flow, and — most importantly — the pinned-persistence mechanic the task specifically asked me to verify) does not exist.

#### Moment 4 — log the week's hours

| #   | Spec element                                                | Status                                                                                                                         | Evidence                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | Ring + tally vs. 1.225, synced to desktop urencriterium     | **Fully Implemented**                                                                                                          | `Vault.tsx`'s `HoursRing` (`Vault.tsx:209-318`) renders the ring and pulls from `useIncomeTax`, the same source the desktop income-tax studio's ring would use — "sync" is trivially true since there's one shared data source, not two. |
| 4.2 | Week view, Mon–Sun, with per-day bars                       | **Missing**                                                                                                                    | No day-by-day breakdown anywhere — `HoursRing` shows only the running total, not a week grid.                                                                                                                                            |
| 4.3 | +2u/+4u/+8u one-tap quick-add chips, with undo              | **Missing**                                                                                                                    | The only entry mechanism is a generic form (date field + numeric hours field + optional note + Save), `Vault.tsx:276-315` — not one-tap chips.                                                                                           |
| 4.4 | Pace-for-target + zelfstandigenaftrek €1.200 unlock framing | **Missing**                                                                                                                    | Copy present is generic ("N hours to go. The Belastingdienst may ask for this log.") — no pace projection, no €1.200 framing.                                                                                                            |
| 4.5 | Exportable from the Vault                                   | **Fully Implemented**                                                                                                          | `apps/api/src/queue.ts`'s `buildExportZip` (`queue.ts:183-241`) includes `hours-entries.json` in every export; `DataExportButton` is on the Vault page.                                                                                  |
| 4.6 | Mobile layout                                               | **Missing** (inferred from the shared root cause; not independently screenshotted this session — see "Not yet measured" below) |                                                                                                                                                                                                                                          |

**Moment 4 overall: Missing.** The ring and the export path are correctly shared with desktop; the entire week-ritual composition (chips, day bars, pace/unlock framing) does not exist — the current UI is a generic logging form, not the described 20-second ritual.

### Track A2 — Marketing Home (`Kwartaal Site Home.dc.html`)

**Desktop (1280px) — binding:**

| Spec element                                                                                     | Status                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero + mid-October year timeline                                                                 | **Fully Implemented**           | `1280-home.png` vs. design: composition, spacing, and states (Q1/Q2 settled, Q3 due-in-12-days, Q4/annual future) match closely.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Live split-calculator, wired to the real core function                                           | **Fully Implemented**           | `apps/web/src/components/SetAsideCalculator.tsx:2,28` imports and calls `splitInvoice` from `@kwartaal/core` directly — confirmed by reading the component, not assumed from the visual. Not a lookalike.                                                                                                                                                                                                                                                                                                                                                                           |
| Reminder-email mock                                                                              | **Partially**                   | Structure/copy match. Sender shown is `post@kwartaal.nl` (`Home.tsx:136`) — this is the design's own stale placeholder, copied verbatim. Per the operator's ruling, the _design's_ domain is a design-time artifact and is explicitly not itself a finding — but the ruling's premise is that the implementation renders the real configured sender (`hello@mail.kwartaal.app`, set in the Auth-surfaces pillar). It doesn't: the code still hardcodes the design's placeholder. This is a real, trivial-to-fix finding, not the domain-mismatch non-finding the ruling pre-empted. |
| Mirror/why section, term-chip vocabulary section, "what Kwartaal is not," testimonial, final CTA | **Fully Implemented**           | All present, `1280-home.png`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Nav                                                                                              | **Fully Implemented** at 1280px | Matches design. (Fails to adapt below ~1000px — see mobile, below, and A3.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Mobile (390px) — binding, per the design's own explicit "Mobile pass" annex (`Kwartaal Site Home.dc.html` lines 220-258, a full separate composition, not a responsive-CSS afterthought):**

| Spec element                                                                                                          | Status      | Evidence                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav collapses to mark + condensed "Start free" + hamburger                                                            | **Missing** | `apps/web/src/marketing/MarketingLayout.tsx` renders the same five-link desktop nav row unconditionally. `390-home.png`: nav items overflow the viewport horizontally — measured `scrollWidth: 627px` vs `clientWidth: 390px` (`results.json`).               |
| Condensed single-column hero                                                                                          | **Missing** | Hero itself doesn't overflow, but nothing about it is the annex's condensed mobile composition — it's the desktop hero at a narrow width.                                                                                                                     |
| Condensed year-timeline list (icon+label+date+status in a single-column row list, not the desktop's horizontal strip) | **Missing** | `Home.tsx`'s timeline is one `flex justify-between` row (`Home.tsx:58`) — no mobile list variant. Visually cramped at 390px but not the annex's specific list composition.                                                                                    |
| Condensed split-teaser card ("A client just paid you €2.420?" one-line summary)                                       | **Missing** | Same full desktop calculator renders at 390px, not the annex's simplified read-only teaser.                                                                                                                                                                   |
| "What Kwartaal does" 2-column feature rows stack to one column                                                        | **Missing** | `Home.tsx:280` — `grid grid-cols-2` with no responsive variant. `390-home.png`: rows render as two cramped side-by-side columns; body copy wraps 1-2 words per line and is effectively unreadable (e.g., the "Btw you received / paid / owe" figures column). |
| "What Kwartaal is not" 220px+1fr grid stacks                                                                          | **Missing** | `Home.tsx:206` — `grid grid-cols-[220px_1fr]`, no responsive variant. Same severe wrap in `390-home.png`.                                                                                                                                                     |

**Track A2 overall: Desktop is Fully Implemented (one Partial: sender domain). Mobile is Missing** — the design specifies an exact, different mobile composition, and the current implementation is not a simplified adaptation of it but an un-adapted reflow of the desktop grid that breaks.

### Track A3 — responsiveness sweep (390/768/1280px, all remaining surfaces)

**Objective overflow measurement** (`document.documentElement.scrollWidth` vs `clientWidth`, all 57 shots in `results.json`): **zero occurrences of `md:`/`sm:`/`lg:`/`xl:` anywhere in `apps/web/src`** is the single root cause behind every finding in this track.

| Surface group                                                                                                 | 390px                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 768px                                                                                                                                               | 1280px            | Evidence                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All 10 marketing pages (Home, Pricing, How it works, Guide, About, Companion, Privacy, Terms, Dpa, Impressum) | **Missing** — horizontal overflow on every single one (`scrollWidth` 493–627px vs 390px)                                                                                                                                                                                                                                                                                                                                                                                  | Fully Implemented — no overflow, and `768-home.png` renders acceptably (coincidental: fixed grid columns still fit at 768px, not a real breakpoint) | Fully Implemented | `results.json`; visually confirmed on Home and Pricing (`390-home.png`, `390-pricing.png` — Pricing's two-card grid renders as two overlapping cramped columns instead of stacking, and the deductibility diagram's figures become illegible)                                                                                                              |
| All 7 dashboard pages (Today, VAT, Income tax, Money, Vault, Glossary, Settings)                              | **Missing** — no numeric overflow (`AppShell`'s fixed 224px sidebar + `flex-1` main squeezes rather than overflows the page) but severely broken: confirmed **clipped** content, not just cramped, on Vault (search input + export button cut off, `390-app-vault.png`), Vat (checklist item text cut off, `390-app-vat.png`), and Settings (`Legal form`/`KOR Off…`/`Bookkeeper handoff` labels and the `Persistent` cadence button all cut off, `390-app-settings.png`) | Fully Implemented — `768-app-today.png` renders correctly, sidebar + content both readable                                                          | Fully Implemented | `results.json` + the four screenshots cited                                                                                                                                                                                                                                                                                                                |
| Auth (Sign in, Sign up, Forgot password)                                                                      | **Fully Implemented**                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Fully Implemented                                                                                                                                   | Fully Implemented | `results.json` — zero overflow at any viewport; `AuthShell`'s single centered-column composition is inherently responsive without any breakpoint classes, confirmed by inspection. Auth surfaces need no remediation.                                                                                                                                      |
| Bottom nav / hamburger drawer anywhere in the app shell                                                       | **Missing**                                                                                                                                                                                                                                                                                                                                                                                                                                                               | —                                                                                                                                                   | —                 | `AppShell.tsx` has exactly one `<nav>`, unconditional.                                                                                                                                                                                                                                                                                                     |
| Tap targets ≥44px                                                                                             | **Not yet measured**                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                                                                                                                                     |                   | Not independently measured this session (no automated bounding-box pass run) — several desktop buttons use `py-2`/`py-2.5` (~36-40px computed height), which is under 44px, but I have not confirmed this with a rendered measurement. Flagging as unresolved rather than asserting a status without evidence, per rule zero.                              |
| Hover-only controls on touch                                                                                  | **Not yet measured**                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                                                                                                                                     |                   | Not audited this session. `hover:` classes are used extensively for desktop affordances (e.g., nav links, row actions); whether any control is hover-_only_ reachable (no visible/tappable equivalent) was not systematically checked.                                                                                                                     |
| Forms / correct mobile keyboards                                                                              | **Partially assessed**                                                                                                                                                                                                                                                                                                                                                                                                                                                    |                                                                                                                                                     |                   | Spot-checked only: `Money.tsx`'s amount input correctly uses `inputMode="decimal"`; `Vault.tsx`'s date fields correctly use `type="date"`. Not exhaustively checked across every form on every surface.                                                                                                                                                    |
| VAT checklist genuinely completable on a phone (plan's explicit stance)                                       | **Missing**                                                                                                                                                                                                                                                                                                                                                                                                                                                               |                                                                                                                                                     |                   | Currently false — `390-app-vat.png` shows clipped, unreadable checklist content under the same un-adapted sidebar shell as every other dashboard page.                                                                                                                                                                                                     |
| Annual studio (Income tax) may stay desktop-oriented but must degrade readably                                | **Missing** (degrades unreadably, not readably)                                                                                                                                                                                                                                                                                                                                                                                                                           |                                                                                                                                                     |                   | Same shared root cause; not individually screenshotted this session beyond the overflow measurement, which shows no numeric overflow but (by the same pattern confirmed on four sibling pages under the identical shell) is expected to share the clipping/squeeze failure. Flagged for confirmation in Phase B rather than asserted from inference alone. |

### Summary

- **26 individually-classified spec elements across A1's four moments: 3 Fully Implemented, 6 Partially, 17 Missing.** Two of the Missing findings (3.5's pinned-persistence field, 2.3's note field) are data-model gaps, not just UI — Phase B's "test-first for behaviors" instruction anticipated exactly this.
- **A2 desktop: Fully Implemented plus one trivial Partial (sender domain). A2 mobile: Missing in full** — a completely specified, different mobile composition exists in the design and is 0% built.
- **A3: every marketing page and every dashboard page fails at 390px** (overflow on marketing, clipping on dashboard) for the same single root cause — no responsive breakpoints exist anywhere in `apps/web/src`. Auth is the one bright spot: fully responsive already, by construction, needing no remediation. Tap-target sizing and hover-only-control audits are explicitly unresolved (not measured), not silently assumed passing.
- **No breakpoint improvisation to flag** — there's no _existing_ breakpoint logic anywhere to contradict; the finding is its total absence, not a wrong one.

### Phase B readiness note

Per the operator's plan, Phase B is test-first for the three genuinely new behaviors (19:00 handoff reminder via a new `ReminderStage` value reusing the existing cron/queue/`reminder_logs` path; pinned-split persistence via a new status field on `setAsideEntries`; receipt note-fallback via a new field on the checklist element schema), spec-fidelity work for A1/A2, and principle-conformance responsive work for A3 using only existing tokens/components — composing a mobile bottom-nav and a marketing hamburger nav from the established system, not inventing a new visual language. Nothing in this audit surfaced a surface that "genuinely needs a designed mobile variant" beyond what the two binding specs already cover — no NEEDS-DESIGN candidates identified.

**Stopping here for confirmation before Phase B, per instruction.**

## Mobile + responsiveness — Phase B (implementation) — complete

Per the operator's "Proceed with Phase B" go-ahead. Gate green from clean:
`npm run typecheck` (all 4 workspaces), `npm run test` (67 API + 16 web,
all passing), `npm run lint` (0 errors), `npm run token-check` (0
violations), `npm run brand-check` (0 violations), `npm run format:check`
(clean), and the full Playwright suite including the 23 new tests below
(47/47 passing, `e2e/tests/mobile-responsive.spec.ts`).

### Test-first behaviors (all three, backend + real tests, no new machinery)

1. **19:00 handoff reminder.** `packages/core/src/tax/reminders.ts`'s
   `ReminderStage` gained `"same_day_1900"` (deliberately excluded from
   `CADENCE_STAGES` — it's user-triggered, not day-offset-computed).
   `deadlines.same_day_reminder_requested_at` (nullable timestamp,
   migration `0004_lowly_layla_miller.sql`) is set by
   `POST /deadlines/:id/remind-tonight` and cleared by
   `DELETE /deadlines/:id/remind-tonight` (undo) or by the consumer once
   sent. `scheduled.ts`'s `fanOutReminders` gained
   `maybeEnqueueSameDayStage`: fires once the Amsterdam clock reaches
   19:00 on the _same_ Amsterdam calendar day the request was made (new
   `amsterdamHour` helper in `packages/core/src/tax/dates.ts`) — a request
   left unactioned past that night lapses rather than firing later.
   `queue.ts`'s `handleReminderMessage` clears the flag after the
   idempotent `reminder_logs` insert. Tests:
   `apps/api/src/integration/same-day-reminder.test.ts` (3 tests) — real
   POST/DELETE through the Hono app, real `worker.scheduled()` ticks
   time-traveled to before/after 19:00 Amsterdam via `scheduledTime`, real
   `worker.queue()` drain, asserting the `reminder_logs` row, the email
   send, and the flag-clear all actually happen exactly once.

2. **Pinned-split persistence.** `setAsideEntries.status`
   (`"pending" | "confirmed"`, same migration) — "I moved it — done"
   creates `confirmed`; "Remind me tonight" creates `pending`, pinning the
   entry to Today until confirmed. `PATCH /money/set-aside-entries/:id`
   (new) flips pending → confirmed. Tests:
   `apps/api/src/integration/set-aside-status.test.ts` (4 tests) — default
   status, pending persistence on a fresh read, confirm transition, 404 on
   a missing entry.

3. **Receipt note-fallback rule.** `receipts.amountCents` +
   `receipts.note` (same migration), `RECEIPT_NOTE_FALLBACK_THRESHOLD_CENTS
= 10000` (€100) in `packages/core/src/contracts/vault.ts`.
   `PATCH /receipts/:id/details` (new) sets either field. Tests:
   `apps/api/src/integration/receipt-note-fallback.test.ts` (4 tests) —
   amount+note set together, amount-only (note stays null), empty-note
   rejection (min length 1), 404 on a missing receipt.

Explicitly **not** built: the "btw queued to the correct quarter's
checklist" linkage flagged Missing in Phase A's 2.4 (connecting a captured
receipt to a VAT expense line) — this is a genuinely separate,
larger feature (receipt-to-expense-line auto-connection), not one of the
three named test-first behaviors, and building it now would have been
scope creep. Still open; not attempted.

### A1 — the four phone-critical moments, spec fidelity

- **Moment 1 (Today).** `apps/web/src/routes/Today.tsx`'s `HeroCard` now
  renders the two-choice handoff pair ("Remind me at my laptop tonight" /
  "Start on the phone anyway") whenever the focus deadline is urgent and
  not overdue, backed by the real `remind-tonight` endpoints; the
  confirmed state shows "Reminder set for 19:00…" + a working Undo.
  `SetAsideCard` now renders a real progress-bar register (confirmed vs.
  confirmed+pending `setAsideEntries` totals) with "Move €X more and QN is
  covered" — the target is the sum of this quarter's _logged_ splits, not
  a fabricated number (see caveat below). A new `HoursTallyRow` ("Hours: N
  of 1.225 — on pace" + "Log →") reads the same `useIncomeTax` source the
  Vault ring uses. A new `PinnedSplitsBanner` lists pending splits with an
  inline "I moved it — done" confirm. `AppShell.tsx` gained the
  Today/VAT/Money/Vault bottom tab bar (`md:hidden`, ≥44px targets, a VAT
  accent dot when a btw deadline is within 14 days), sidebar hidden below
  `md`.
  **Known limitation, not silently glossed over:** `setAsideEntries` has
  no `quarterId` column, so the progress register sums _all_ entries
  regardless of quarter rather than just the focus quarter's — correct
  once a quarter closes and its entries stop accruing, but a
  multi-quarter edge case (a stale prior-quarter pending entry) would
  currently bleed into the running total. Flagged for a future quarter-fk
  addition; out of scope for this phase (not one of the three named
  behaviors, and adding a migration for it here would have been scope
  creep beyond "make the described feature real with what already
  exists").
- **Moment 2 (Vault — catch a receipt).** `ReceiptCapture` now sets
  `capture="environment"` on the file input (camera-first on mobile
  browsers), added an Amount field, the €100 note-fallback warning +
  "Save with a note"/"Retake" flow wired to the new
  `PATCH /receipts/:id/details`, and a real success state ("In the Vault.
  Kept for 7 years…" + amount + "Catch another receipt", matching the
  design's copy).
- **Moment 3 (Money — split ritual).** `Splitter` now shows the
  paid-invoice trigger framing ("A client just paid you €X?"), a combined
  "Move €X to the Taxes pot" instruction, and the "I moved it — done" /
  "Remind me tonight" two-choice flow (posting `status: "confirmed" |
"pending"`), with distinct confirmation copy for each. Pots and VA
  sections' fixed grids now stack on mobile.
- **Moment 4 (Vault — log hours).** `HoursRing` replaced by
  `HoursWeekCard`: the ring+tally (unchanged data source), a Mon–Sun day
  list with per-day bars (today highlighted in accent), +2u/+4u/+8u
  quick-add chips (each posts a real `hoursEntry`, with "undo" removing
  the just-added one — the underlying data model is an append log, so
  "change" reads as "log another entry," not a per-day upsert that
  doesn't exist server-side), and pace/unlock framing ("On pace for
  {month}… N hours to go unlocks the zelfstandigenaftrek — €1.200 off
  your profit"). A collapsed "Log a different day →" preserves the old
  date/hours/note form for entries chips can't express (backdating,
  notes).

### A2 — Marketing Home, spec fidelity

Sender domain fixed (`post@kwartaal.nl` → `hello@mail.kwartaal.app`,
matching the real configured `EMAIL_FROM`; same fix applied to the
`How it works` step-1 email mock, which had the identical stale
placeholder). Built the design's separate mobile-pass composition rather
than reflowing the desktop one: hamburger nav (`MarketingLayout.tsx`,
44px target, `aria-expanded`/`aria-controls`, closes on link click), a
condensed single-column year-timeline list at `<md` (icon+label+date+status
per row) vs. the desktop horizontal strip, and a non-interactive
`SetAsideTeaser` (real `splitInvoice` on a fixed example, per the design's
explicit "not the full calculator" instruction) swapped in for the full
`SetAsideCalculator` below `md`. `FeatureRow`'s and "what Kwartaal is
not"'s fixed grids now stack below `md`.

### A3 — responsiveness sweep

Applied `md:`-prefixed Tailwind utilities (existing tokens/components
only) across every surface Phase A's `results.json` flagged: all 10
marketing pages (container padding, heading sizes, every fixed
`grid-cols-[…]`/`grid-cols-N` now stacks below its breakpoint — Pricing's
two-card grid and deductibility diagram, HowItWorks' rubriek table and
filed/paid grid, Companion's division-of-labor grid, About's founder
grid, LegalPage's numbered-section grid); all 7 dashboard pages (Vat's
three data-table grids narrowed+stacked rather than clipped, IncomeTax's
waterfall/bracket grids stack below `sm`, Settings' label/value rows wrap
instead of clipping, invite rows truncate long emails instead of pushing
the Revoke button off-screen). Glossary needed no responsive fixes (already
single-column) — see the Glossary bug section below for its _unrelated_,
non-responsive defect. Auth confirmed still needing none (Phase A's own
finding).

**Still open, honestly flagged rather than silently asserted as passing:**
tap-target sizing was **not** exhaustively re-measured across every
pre-existing button (only new/touched controls got explicit `min-h-[44px]`
this phase); hover-only-control reachability on touch was **not**
audited. Both were "Not yet measured" in Phase A and remain so — narrowed
in scope (new controls comply) but not closed out.

### e2e evidence

`e2e/tests/mobile-responsive.spec.ts` (23 tests, all passing against the
real dev stack — `wrangler dev` + Vite, nothing mocked): a
no-horizontal-scroll assertion (`scrollWidth` vs `clientWidth`, same
objective technique as the Phase A audit script) across all 10 marketing
pages and all 7 dashboard pages at 390px; Home at 390 (hamburger present,
desktop nav links hidden until opened) and 1280 (full nav, hamburger
hidden); and the four moments end to end at 390px as the seeded Maya
account — including a real remind-tonight → confirmed-state → undo round
trip (with the focus deadline's due date forced into the urgent window
via a direct D1 write for determinism, the same `d1Execute` pattern
`reminder-email.spec.ts` already used), a real receipt upload → amount
over €100 → note-fallback → success-state round trip, a real split-ritual
→ "remind me tonight" → pinned-card-on-Today round trip, and a real
quick-add-chip → logged → undo round trip.

## Glossary bug — empty glossary ("No terms match \"\"" with no search) — fixed

Diagnosed in the specified order; **root cause was #2, env-inconsistent
seeding** (not #1, tenant-scope — that path was already correct).

1. **Data path — ruled out.** `apps/api/src/routes/glossary.ts` already
   reads `GlossaryTerm` via `tenantDb.global`, with a comment explicitly
   documenting why. `income-tax-aggregate.ts`'s `TaxFigures` read is the
   same. `packages/db/src/tenant.test.ts` already registers both as
   non-tenant tables and asserts `TenantDb` throws a `tenant guard` error
   if either is ever passed to a tenant-scoped call — the registry
   already would have caught this class of mistake; no strengthening
   needed.
2. **Seed — the actual cause, confirmed by querying real D1.** Local: 9
   glossary rows (`wrangler d1 execute kwartaal --local`). Staging: 9
   rows (`--remote --env staging`). **Production: 0 rows** — confirmed
   directly (`--remote --env production`), also 0 `tax_figures` rows.
   Root cause: `packages/db/seed.sql` bundled genuinely-global reference
   data (glossary terms, tax figures) together with Maya's org-specific
   demo data in one file; `docs/deploy-runbook.md`'s "Production D1:
   migrations applied (schema only) — intentionally left unseeded" was
   the right call for demo data and the wrong one for reference data real
   users need regardless of any demo account. (The runbook's own open
   checklist already flagged the `tax_figures` half of this — "TaxFigures
   2026 row seeded into the production D1" — but not the glossary half;
   this was a real, previously-untracked gap.)
   - **Fix:** split reference data into a new `packages/db/seed-reference-data.sql`
     (idempotent — `INSERT OR IGNORE`, keyed on each table's real
     primary key — safe to re-run against any environment any number of
     times), which must apply before `seed.sql` (whose
     `tax_year_profiles` FKs to `tax_figures(year)`).
     `apps/api/package.json`'s `db:local:reset` now applies it first; a
     new `db:seed:reference-data` script applies just that file. Applied
     directly to production (`wrangler d1 execute kwartaal-production
--env production --remote --file=packages/db/seed-reference-data.sql`) —
     verified after: production now has 9 glossary rows and 1 tax_figures
     row, matching staging and local. **The live defect is fixed as data
     — the code fix below (the readiness check, the UI bug) still needs
     its normal Worker deploy to reach production.**
   - **Health-adjacent check, added:** `apps/api/src/routes/health.ts`'s
     `/health/ready` now also checks `glossary_terms` is non-empty
     (`checks.referenceData`), 503 if not — "an empty glossary is a
     deploy defect, not a valid ready state," not just DB reachability.
     Tests: `apps/api/src/integration/health-readiness.test.ts` (2 tests,
     real D1 — asserts 503 with an empty table and 200 once a row
     exists).
3. **UI empty-state bug — real, fixed regardless of #1/#2.**
   `apps/web/src/routes/Glossary.tsx`'s no-match message was gated only
   on `filtered.length === 0`, with no check that the query was actually
   non-empty — so an empty `terms` list (loading-elsewhere edge case, or
   exactly the production defect above) rendered `No terms match ""`
   instead of an (empty) full list. Fixed: the message now requires
   `trimmedQuery.length > 0` too. Tests:
   `apps/web/src/routes/Glossary.test.tsx` (3 tests, RTL + mocked
   `fetch`) — full list with no query and never the no-match message,
   filtering narrows correctly, no-match shows only for a genuinely
   unmatched non-empty query and clears back to the full list when the
   query is cleared.
   `apps/api/src/integration/glossary.test.ts` (2 tests, real D1) — an
   org user reads back seeded terms through the real route; two unrelated
   orgs see identical global content.

**D-finding standard gains a criterion.** Phase A's audit never
screenshotted `/app/glossary` with the query in mind — its Glossary entry
in `visual-pass.spec.ts` only asserts the heading renders, which would
pass identically whether the glossary held 9 terms or 0. This bug would
have shipped invisibly past that check. Recorded for the Phase 1
VERIFICATION-PROTOCOL.md audit below (as a D-finding): **for
content-bearing screens, "seeded content visible" is now a required
criterion alongside composition — a compositionally-correct-but-empty
screen is a Partial/Still Open finding, not a pass.**

Gate green (typecheck, 71 API + 19 web unit/integration tests, lint,
token-check, brand-check, format:check, 47/47 e2e) after this fix, same
run as the rest of Phase B.

## VERIFICATION-PROTOCOL.md audit — cycle 1 complete, see AUDIT-REPORT.md

Full detail lives in `AUDIT-REPORT.md` (not duplicated here); summary:

- **Definition of done, all 26 clauses individually verified**: 15 Fully
  Resolved, 8 Partially Resolved, 3 Still Open/Deferred (Stripe and
  Sentry round-trips — credential-blocked, consistent with every prior
  mention in this file).
- **Explain Mode built from scratch** (was 0% built): `users.explainModeEnabled`
  (migration `0005_busy_roughhouse.sql`, default true), `GET /orgs/me` +
  `PATCH /orgs/me/explain-mode`, `ExplainModeContext` + `<ExplainNote>`,
  a Settings toggle, applied to Today's three design-specified ※ asides
  verbatim. 4 API tests + 5 web unit tests + 1 real-browser e2e test
  (proves the toggle survives sign-out/sign-in against the real backend).
  Onboarding's three design-specified notes are not yet built — see
  AUDIT-REPORT.md's Escalation section, recommended as next session's
  first item.
- **A real bug found and fixed via test-first verification**:
  `POST /export-jobs` was wrongly gated behind the Pro-entitlement check,
  contradicting the Definition of Done's explicit "trial data remains
  readable and exportable... behind the gate" — a lapsed trial user
  could not request an export of their own data. Fixed in
  `apps/api/src/index.ts` (removed `requireProForMutations` from the
  export-jobs mount, matching the existing billing carve-out); bookkeeper
  role-based blocking on the same route is untouched and still correctly
  enforced (`bookkeeper-role.test.ts`, re-verified).
- **Two regressions found and fixed**: `PinnedSplitsBanner` (new this
  Phase B) had no cap and could grow unboundedly (found via a
  design-fidelity screenshot showing 7 stacked cards from accumulated
  test data) — now caps at 3 with a reveal-the-rest link. A Phase B e2e
  test was silently mutating Maya's canonical demo deadline without
  restoring it, corrupting the shared local demo account's fidelity to
  the seed's October date for every subsequent viewer — fixed to restore
  state in a `finally` block.
- **One pre-existing, unrelated flake found and fixed** during gate
  verification: `reminder-email.spec.ts` computed its seeded deadline's
  "+7 days" in raw UTC instead of Amsterdam calendar days, off-by-one
  whenever the test happens to run between 00:00–02:00 Amsterdam time —
  root-caused via the fan-out's own log output, fixed to use the same
  Amsterdam-calendar pattern every other test in the suite already uses.
- **Two items escalated to the operator** (not resolvable by further
  unilateral code changes): F-002, the demo's "mid-October, byte-identical"
  claim is structurally in tension with real-wall-clock day-counting
  outside a narrow window each October — needs a product decision (a
  demo-clock feature, or reword the clause); F-021, `orgId` in production
  `wrangler tail` logs is code- and locally-proven but not independently
  observed live in production, since doing so would require creating a
  real production account.
- Gate green from clean, post-remediation: typecheck (4 workspaces),
  79 API + 27 web unit/integration tests, lint, token-check, brand-check,
  format:check, axe-core a11y (10/10), Playwright e2e (48/48),
  `wrangler deploy --dry-run`.

## Next session

**Current priority (post-VERIFICATION-PROTOCOL cycle 1 — see the section
above and AUDIT-REPORT.md):**

1. Deploy this session's Worker code changes to staging/production (the
   `explainModeEnabled` migration, the export-jobs entitlement-gate fix,
   and everything else in this session's diff are committed but not yet
   deployed — the production D1 _data_ fix for the Glossary bug was
   applied directly this session, but the _code_ changes, including the
   new `/health/ready` reference-data check, have not been).
2. Onboarding's three Explain notes (design-specified copy already
   identified, `Kwartaal Onboarding.dc.html` lines 86/123/154 — same
   shape of work as Today's, already done).
3. The two escalated product decisions in AUDIT-REPORT.md's Escalation
   section (F-002's demo-clock question, F-021's production-log
   verification) — need an operator call, not more code.

**Earlier priority list (superseded in part — items 1 below are already
done; kept for history):**

Pillar 6 and the Auth surfaces pillar are both done; staging and
production are **real, deployed, and verified** (see "Environment" above).
What remains is entirely credential- or operator-gated, not code:

1. ~~Attach the two Pages custom domains~~ — **done**, see "Environment."
2. Set real `EMAIL_ALLOWLIST` addresses for staging so reminder-email
   (and now magic-link/reset/invite-email) testing can actually deliver
   somewhere.
3. A real Stripe test account (walk through one real Checkout → webhook →
   entitlement-unlocks cycle by hand, since that's the one flow this repo
   has only ever simulated) is the single highest-value next external
   dependency to obtain, followed by Resend domain verification (needed
   for `mail.kwartaal.app` to actually send) and a Sentry DSN.
4. Now that staging is real, the backup-restore rehearsal's still-untested
   `--remote` path (see Pillar 6's "Backup restore" section above) can
   finally be rehearsed against it for real — it was BLOCKED purely on
   "no staging exists," which is no longer true.
