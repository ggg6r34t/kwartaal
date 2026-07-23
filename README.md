# Kwartaal

Dutch tax guidance for self-employed expats (ZZP'ers) — four quarterly btw
drawers and one annual income-tax return a year, turned into a guided
checklist. Kwartaal estimates, reminds, and explains; it never files
anything for you.

## Stack

- **API** (`apps/api`): Cloudflare Workers, Hono, Drizzle ORM over D1,
  Better Auth (email/password + magic link), R2 (receipts/exports/backups),
  Queues (reminders, exports), Cron Triggers (hourly reminder fan-out,
  weekly backup + deletion sweep), Browser Rendering (PDF handoff
  summaries).
- **Web** (`apps/web`): Vite + React 18 + React Router + Tailwind v3,
  built as a static SPA with an SSR shell, deployed to Cloudflare Pages.
- **Core** (`packages/core`): the tax engine and shared types — pure
  functions, no I/O, exhaustively golden-tested.
- **DB** (`packages/db`): Drizzle schema + migrations, shared by the API
  and its test harnesses.
- **e2e** (`e2e`): Playwright, driving the real dev stack
  (`wrangler dev` + Vite) in an actual browser.

See `STACK-BLUEPRINT.md` for the full architecture rationale and
`KWARTAAL-BUILD-PLAN.md` for the pillar-by-pillar build plan this repo was
built against (`PROGRESS.md` tracks what's actually done, pillar by pillar,
including anything BLOCKED and why).

## Quick start

```
npm install
npm run db:local:reset      # migrations + the Maya demo seed
npm run dev:api             # apps/api, :8787
npm run dev:web             # apps/web, :5173 (separate terminal)
```

Open `http://localhost:5173` and sign in as the seeded demo account —
`maya@kwartaal-demo.example` / `kwartaal-demo-2026` — for a fully-populated
mid-October 2026 state (Q1/Q2 filed and paid, Q3 open with real invoice/
expense lines). No secrets are required for local dev; see `docs/env.md`
for what's configurable and how every missing secret degrades gracefully
instead of crashing.

## Testing

```
npm run typecheck                 # every workspace
npm test                          # unit + integration, every workspace
npm run lint
npm run format:check
npm run token-check               # design-token discipline (see CLAUDE.md)
npm run build:web
npx wrangler deploy --dry-run     # from apps/api
```

`apps/api`'s test suite runs under `@cloudflare/vitest-pool-workers` — real
D1/R2/Queues bindings under actual workerd, not mocks. Its
`src/integration/` directory is where cross-cutting correctness lives:
tenant isolation, bookkeeper-role gating, reminder idempotency, year-rollover/
DST edge cases, backup export + hard-delete-sweep, and live security probes
(webhook forgery, upload content-type bypass, headers) — all real HTTP
requests against the actual worker, not unit tests of internal functions.

### End-to-end (real browser)

```
cd e2e
npx playwright test          # or: npm run test:e2e from the repo root
```

Starts a real `wrangler dev` + `vite dev` pair and drives them with an
actual Chromium browser: the three primary user flows (signup → onboarding
→ Q3 lines → mirror → filed+paid; receipt capture → vault → export-zip;
reminder email for a T-7 deadline via a real cron tick) plus a visual pass
over every marketing and app screen. See `e2e/tests/` — each spec's own
comments explain what it proves and, where relevant, what it deliberately
doesn't (e.g. the Stripe-subscribe step, blocked on not having a real
Stripe account — see `PROGRESS.md`).

## Docs

- `docs/rounding.md` — the money-rounding convention every tax calculation follows.
- `docs/tax-figures.md` — how the yearly tax-figures reference data works and how to add a new year.
- `docs/env.md` — every environment variable and secret, what it does, and how it degrades when absent.
- `docs/deploy-runbook.md` — deploy steps, the staging→production cutover checklist, and the backup/restore procedure.
- `docs/design/` — the design export this app is built to match pixel-for-pixel.

## Repo layout

```
apps/api      Cloudflare Worker — routes, auth, queue/scheduled handlers, integration tests
apps/web      React SPA — routes, marketing pages, components
packages/core Tax engine + shared types, no I/O
packages/db   Drizzle schema, migrations, demo seed
e2e           Playwright end-to-end suite
docs/         Rounding, tax-figures, env, deploy-runbook, design export
scripts/      Repo-wide tooling (token-discipline check)
```
