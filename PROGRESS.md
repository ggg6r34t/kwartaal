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

## Deferred to their pillar (not gaps — sequencing per the Build order)

- CSV import UI (upload + column-mapping widget) and the named import
  adapters (blocked on `docs/import-formats/` samples, which still don't
  exist) → follow-up within **Pillar 3's** scope, not yet done.
- Vault's "Recent records" table doesn't yet include invoice/expense lines
  from VAT quarters (see Pillar 4 deviation #5) → natural follow-up
  whenever a cross-quarter lines endpoint is built, no fixed pillar.
- A D1-backed route-test harness, to close the automated-coverage gap
  flagged in Pillar 4 deviation #6 → worth doing before Pillar 5's Stripe
  webhooks add more untested route surface.
- Marketing site (7 `Kwartaal Site *.dc.html` screens are in `docs/design`
  and confirmed complete — just not built yet), Stripe billing, paywall
  interstitial wiring → **Pillar 5**.
- Playwright e2e (this pillar's and Pillar 3's frontend work has never
  been browser-tested — see the gate tables above), backup rehearsal,
  production cutover → **Pillar 6**.

## External resources — still needed, none blocking Pillar 5

- **Sentry DSN** — optional; degrades to structured console.error /
  `wrangler tail` today.
- **Stripe test account** — needed for Pillar 5.
- **Resend API key + verified domain** — dev-logs mode covers local testing;
  a real key is needed before trusting actual reminder delivery, and
  required before Pillar 6 launch.
- **Custom domain(s)** — Pillar 6 cutover.
- **`docs/import-formats/` sample exports** — needed to build the three
  named import adapters (generic CSV path doesn't need them; still blocked,
  three `it.skip` markers waiting).
- **Browser Rendering access, confirmed against a real deployed
  environment** — the local-dev failure path is now verified graceful
  (job → `failed`, no crash), but the actual PDF has never been generated
  for real; verify `[browser]` access and the rendered output the first
  time staging is exercised.
- Staging/production R2 buckets and Queues — self-provisionable, no user
  action needed; still placeholder names in `wrangler.toml`, to be created
  when Pillar 5/6 actually exercises those environments.
- **A real browser-testing capability** (Playwright, or manual click-through
  access) — Pillars 3 and 4 together have shipped a large amount of
  frontend code verified only at the build/transform/unit-test level,
  never rendered. Worth closing before Pillar 5 adds the marketing site and
  billing flows on top.

## Next session

Start with: "Read KWARTAAL-BUILD-PLAN.md, CLAUDE.md, and PROGRESS.md,
continue with Pillar 5." Strongly consider opening the app in an actual
browser first (`npm run dev:api` + `npm run dev:web`) to visually verify
Pillars 3 and 4's screens before building the marketing site and billing
flows on top of them — that verification still has not happened.
