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

### Still BLOCKED-for-operator (dashboard-only, not attempted)

Per explicit instruction not to attempt Pages custom domains from here:

- [ ] Attach `kwartaal.app` to the `kwartaal-production` Pages project.
- [ ] Attach `staging.kwartaal.app` to the `kwartaal-staging` Pages project.

Once either is attached, drop the corresponding `.pages.dev` entry from
that environment's `APP_ORIGIN` in `wrangler.toml` (see point 8 above).

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

## Next session

Pillar 6 was the plan's last pillar. Staging and production are now both
**real, deployed, and verified** (see "Environment" above) — what remains
is narrower than it was: two dashboard-only domain attachments, and the
credential-BLOCKED items (Stripe, Resend, Sentry, real TaxFigures) that
were always going to need the operator's hands regardless of
infrastructure access. Start with: "Read KWARTAAL-BUILD-PLAN.md,
CLAUDE.md, and PROGRESS.md" and then, with the user:

1. Attach the two Pages custom domains (`kwartaal.app` →
   `kwartaal-production`, `staging.kwartaal.app` → `kwartaal-staging`) via
   the Cloudflare dashboard, then drop each environment's `.pages.dev`
   entry from its `APP_ORIGIN`.
2. Set real `EMAIL_ALLOWLIST` addresses for staging so reminder-email
   testing can actually deliver somewhere.
3. A real Stripe test account (walk through one real Checkout → webhook →
   entitlement-unlocks cycle by hand, since that's the one flow this repo
   has only ever simulated) is the single highest-value next external
   dependency to obtain, followed by Resend domain verification and a
   Sentry DSN.
4. Now that staging is real, the backup-restore rehearsal's still-untested
   `--remote` path (see Pillar 6's "Backup restore" section above) can
   finally be rehearsed against it for real — it was BLOCKED purely on
   "no staging exists," which is no longer true. The accessibility gate
   itself no longer needs this (see the brand-hygiene sweep note above —
   it's a self-contained axe-core CI step now, not a scan of a deployed
   site by an external tool).
