# Progress — Pillar 1: Foundations

Status: **complete**. Full gate green (see "Gate results" below), including a live
end-to-end smoke test (real login with the seeded Maya credentials → real
tenant-scoped API response).

## What's done

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
  registry (20 tables), `.global` escape hatch. A test
  (`tenant.test.ts`) asserts the registry stays in sync with every
  `org_id`-bearing table in the schema, and that the guard throws for
  unregistered tables (including `orgs` itself, the tenant root).
- ESLint rule (`apps/api/src/routes/**`) bans importing raw `Database`/
  `createDb` from `@kwartaal/db` — route modules only ever get a `TenantDb`
  via `c.get("tenantDb")`.
- Migration `0000_shiny_tyger_tiger.sql` generated via `drizzle-kit generate`
  and applied to local D1 — verified.
- `packages/db/seed.sql` — deterministic Maya demo seed, **hand-written SQL**
  rather than the blueprint's TS→SQL generator pipeline (see "Deviations"
  below). Applied to local D1 and verified: Q3's rubriek numbers
  (1a €4.095,00 / 1b €45,00 / 5b €610,00) reconcile exactly to locked
  decision #4's golden figures via `SUM()` queries against the seeded
  income/expense lines.

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
  `/api/auth/*` (20/60s). Public-calculator and upload limiters use the same
  factory but land with their routes in Pillar 2/4.
- `lib/logger.ts` (structured JSON) + `lib/sentry.ts` (minimal hand-rolled
  Store-API reporter, no SDK dependency) — degrades to
  console.error/`wrangler tail` when `SENTRY_DSN` is unset, per the
  plan's explicit Sentry-or-Tail-Worker fallback. No DSN provided yet.
- `routes/health.ts` (liveness + `SELECT 1` readiness) and `routes/orgs.ts`
  (`GET /orgs/me`, response validated through the Zod `meResponseSchema`).
- `queue.ts` / `scheduled.ts` — handlers exist and ack/log correctly; the
  actual reminder fan-out and export-build logic is Pillar 3/4 (needs the
  tax engine and Deadline materialization first).

**Web (`apps/web`)**

- Vite + React 18 + react-router-dom, self-contained tsconfig (not extending
  base, per blueprint §9).
- `src/theme.css` — the single token source, every value taken from
  `docs/design`'s canonical "Color" component sheet (Paper/Ink/Body/Faint/
  Accent/Settled/Overdue/Caution/Border/Wash/Sand/Reserve + the derived
  state-bg/border/ink variants, the exact not-yours hatch recipe).
- `tailwind.config.js` — every token mapped to a semantic utility
  (`paper`, `ink`, `accent`, `state-due-soon`, `state-neutral`, `not-yours`,
  `sage`, `amber`, `clay`, `radius-card`, `radius-control`, `ring-focus`, …).
- App shell (`app/AppShell.tsx`), data-driven nav (`app/nav.ts`, currentColor
  SVG icons), `RequireAuth`, and two shared components ported 1:1 with tests:
  `TermChip` (dotted-underline term button + explanation panel) and
  `StateSwitcher` (dev-only floating tool, `import.meta.env.DEV`-gated,
  generic `groups` API for later pillars' design-state toggles).
- Same-origin proxy pair verified matching:
  `functions/api/[[path]].ts` (Pages Function) and `vite.config.ts`'s dev
  proxy both strip `/api` except `/api/auth`.
- Placeholder routes for Today/VAT/Income tax/Money/Vault/Glossary/Settings
  (pixel screens are Pillar 3-5 per Build order — Pillar 1 scope is shell +
  nav + term-chip + state-switcher only) and a functional `SignIn` page
  (magic-link form) wired to the real `better-auth/react` client.

**Tax domain (types only — Pillar 2 implements the functions)**

- `packages/core/src/tax/types.ts` — `TaxFigures`, `QuarterComputation`,
  `WaterfallStep`, `IncomeTaxEstimate`, `SetAsideSplit`,
  `DepreciationYearEntry`, `DeadlineDef`, etc.
- `packages/core/src/entitlement.ts` — `hasProAccess`, tested against all
  four trial-state combinations from locked decision #5.
- `packages/core/src/rbac.ts` — `roleAtLeast`, two-role rank (owner/bookkeeper).
- `packages/core/src/money.ts` — Dutch-notation `parseAmountToCents` /
  `formatCents`, integer cents throughout.

## Gate results

| Check | Result |
|---|---|
| `npm run typecheck` (4 workspaces) | ✅ |
| `npm test` (32 tests, 4 workspaces) | ✅ |
| `npm run lint` | ✅ |
| `npm run format:check` | ✅ |
| `npm run token-check` | ✅ 0 violations, 0 exceptions |
| `npm run build:web` | ✅ |
| `wrangler deploy --dry-run` (API) | ✅ |
| Live smoke test | ✅ `wrangler dev` boot → `/health` → `/health/ready` → `POST /api/auth/sign-in/email` with seeded Maya credentials → `GET /orgs/me` returns real org/BusinessProfile, tenant-scoped |

Demo login: `maya@kwartaal-demo.example` / `kwartaal-demo-2026`.

## Deviations from a literal reading of the plan (flagging per its own instruction)

1. **TaxFigures 2026 non-golden fields are placeholders.** `zelfstandigenaftrekCents`,
   `startersaftrekCents`, `mkbVrijstellingBps` are locked decision #4's verbatim
   numbers. Brackets, Zvw rate, algemene heffingskorting max, and the
   arbeidskorting table are **not specified anywhere in the plan** — seeded
   from the best-available published (2025) rates as a clearly-commented
   placeholder. No golden fixture in the plan depends on these (the only
   golden income-tax number is the taxable-income figure, ±€51.660, which
   only needs the waterfall inputs). Must be verified against real 2026
   publication before `docs/tax-figures.md` (Pillar 6) or any UI shows a tax
   *owed* number built from brackets/credits.
2. **The €72.000 turnover / €9.500 costs annual figures are treated as
   Maya's projected full-year onboarding input**, reused directly as
   Pillar 2's standalone annual-waterfall golden-test input — **not** as the
   sum of the seeded Q1–Q3 lines-to-date (which total €52.000 turnover /
   ~€6.944 costs, since Q4 hasn't happened yet in the story). Flagging this
   interpretation for confirmation before Pillar 2 encodes its golden test
   fixture.
3. **`seed.sql` is hand-written SQL**, not generated via a TS
   `gen-seed-sql.mts` + in-memory-D1-shim pipeline (blueprint's Hackiwi
   approach). It satisfies the actual requirement — deterministic, fixed
   ids/dates, committed, diffable, re-applies byte-identical — without the
   extra generator machinery. Worth revisiting if the seed grows enough in
   Pillar 3+ that hand-maintenance gets painful.
4. **Q3 is seeded `in_progress` with real income/expense lines but NULL
   `rubriek_*_cents`** on the `quarters` row itself — those columns are
   "engine-computed, persisted at close" per the schema banner, and Q3
   hasn't closed in the story yet. Pillar 2/3 should close it through the
   real engine + checklist flow, not by hand-editing the seed.
5. **`apps/web/functions/api/[[path]].ts` is excluded from the TS project
   graph.** Its Pages-Functions/Workers-runtime types
   (`PagesFunction`/`Fetcher`) can't coexist in one tsconfig with
   `vite.config.ts`'s Node-runtime types without a DOM-lib-vs-workers-types
   global conflict. The file is unmodified from the blueprint's proven proxy
   pattern and is 6 lines; still, it's not covered by `npm run typecheck` —
   low risk, but flagging the gap. A follow-up could give it its own
   standalone tsconfig if we want full coverage.
6. **`apps/web`'s `build` script is a plain `tsc -b && vite build`**, not the
   blueprint's SSG-prerender pipeline (`generate-sitemap.mjs`,
   `entry-prerender.tsx`, `prerender.mjs`, OG image generation) — that
   machinery is genuinely Pillar 5 work (it operates on marketing pages that
   don't exist yet). CI's `build:web` step exercises the simplified script.

## Deferred to their pillar (not gaps — sequencing per the Build order)

- Tax engine pure functions + golden tests + public set-aside calculator
  endpoint → **Pillar 2**.
- Onboarding flow, VAT cycle, import adapters (Moneybird/Declair/
  e-Boekhouden — `docs/import-formats/` samples still don't exist; user said
  they'll follow), Deadline/Cron/Queue reminder logic, Today/VAT/Glossary
  screens → **Pillar 3**.
- Income tax studio, Money, Vault screens, R2 receipt uploads, export-zip →
  **Pillar 4**.
- Marketing site (7 new `Kwartaal Site *.dc.html` screens are in
  `docs/design` and confirmed complete — just not built yet), Stripe
  billing, paywall interstitial wiring → **Pillar 5**.
- Playwright e2e, backup rehearsal, production cutover → **Pillar 6**.

## External resources — still needed, none blocking Pillar 2

- **Sentry DSN** — optional; degrades to structured console.error /
  `wrangler tail` today.
- **Stripe test account** — needed for Pillar 5.
- **Resend API key + verified domain** — dev-logs mode covers local testing;
  needed for real sends (Pillar 3) and required before Pillar 6 launch.
- **Custom domain(s)** — Pillar 6 cutover.
- **`docs/import-formats/` sample exports** — needed before Pillar 3 builds
  the named adapters (generic CSV path doesn't need them; named adapters
  will ship last within Pillar 3 with a skipped test as the marker, as
  instructed).
- Staging/production R2 buckets and Queues — self-provisionable by me, no
  user action needed; will create them when Pillar 3 (queues) / Pillar 4
  (R2) actually exercise those environments.

## Next session

Start with: "Read KWARTAAL-BUILD-PLAN.md, CLAUDE.md, and PROGRESS.md,
continue with Pillar 2."
