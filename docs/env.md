# Environment variables & secrets

Two apps, two different mechanisms — Cloudflare Workers vars/secrets for the
API, Vite build-time env for the web app.

## API (`apps/api`)

Declared in `apps/api/wrangler.toml`'s `[vars]` block per environment
(default/staging/production), or as real secrets via `wrangler secret put`.
Locally, `apps/api/.dev.vars` (gitignored) overrides `[vars]` for anything
that shouldn't be committed even as a placeholder (this repo currently only
uses it for a local-only `STRIPE_WEBHOOK_SECRET`).

### Plain vars (`wrangler.toml [vars]`)

| Var | Purpose |
| --- | --- |
| `ENVIRONMENT` | `"development"` \| `"staging"` \| `"production"` — gates the dev-logs/prod-sends degraded pattern used by every outbound email (see `src/email/deliver-magic-link.ts`, `deliver-reminder.ts`) and by `src/lib/sentry.ts`. |
| `BETTER_AUTH_URL` | The API's own origin — Better Auth's `baseURL`. |
| `APP_ORIGIN` | Comma-separated trusted origin(s) for CORS + CSRF (`src/auth/origins.ts`'s `parseTrustedOrigins`) — the web app's origin(s). |
| `EMAIL_FROM` | `"Kwartaal <no-reply@...>"` sender for all outbound mail. |
| `EMAIL_ALLOWLIST` | **Staging only** — comma-separated recipient allow-list. `src/email/resend.ts`'s `isAllowedRecipient` gates every send: in staging, anything not on this list is logged, not sent (same dev-logs treatment as local); an unset/empty list denies everything (fail closed). Never read in production — production has no allow-list by design. See PROGRESS.md's "Environment" section and `src/email/resend.test.ts`. |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL` | Stripe Price IDs — not secret, safe as plain vars. Placeholders (`REPLACE_WITH_...`) until a real Stripe account exists (see PROGRESS.md — BLOCKED). |

### Secrets (`wrangler secret put`, absent in local dev)

Every one of these has a documented degraded mode for local dev — the app
never crashes on a missing secret, it does something visibly less-than-prod
instead (see the file referenced).

| Secret | Purpose | Degraded mode when absent |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Session signing. | `src/auth/secret.ts` falls back to a fixed dev-only value. |
| `SECRETS_ENCRYPTION_KEY` | Encrypts `secrets` table rows (future integrations). | Not yet exercised by any route. |
| `RESEND_API_KEY` | Outbound email in staging/production. | `ENVIRONMENT=development` skips sending entirely and logs `[magic-link]`/`[reminder]` to console instead. |
| `SENTRY_DSN` | Error reporting. | `src/lib/sentry.ts`'s `reportError` no-ops. |
| `STRIPE_SECRET_KEY` | Stripe API calls (checkout, portal). | `src/routes/billing.ts` returns `503 billing-not-configured`. |
| `STRIPE_WEBHOOK_SECRET` | Verifies incoming Stripe webhook signatures. | `src/routes/billing-webhook.ts` returns `503 billing-not-configured` — **never** accepts an unverified webhook. |

### D1 / R2 / Queues / Browser bindings

Declared as `[[d1_databases]]`, `[[r2_buckets]]`, `[[queues.producers/consumers]]`,
`[browser]` in `wrangler.toml`, one full set per environment. Real resource
IDs for `default`/dev are live; staging/production R2 bucket and queue names
are `REPLACE_WITH_*` placeholders until provisioned at cutover (see
`docs/deploy-runbook.md`).

`apps/api/wrangler.test.toml` and `apps/api/wrangler.e2e.toml` are **not**
deployable configs — they're local-only mirrors of the default environment
used exclusively by the vitest-pool-workers integration suite and the
Playwright e2e suite respectively. Both omit `[browser]` because Browser
Rendering has no local Miniflare simulation and (for `wrangler dev`
specifically) declaring it without `--remote` hard-fails startup on this
wrangler version.

## Web (`apps/web`)

Vite build-time env, `VITE_`-prefixed only (anything without that prefix is
never bundled — see Vite's own env var rules).

| Var | Purpose |
| --- | --- |
| `VITE_API_URL` | Overrides the default `/api`-relative base (see `src/lib/api.ts`). Unset in normal dev/prod — the same-origin proxy (`vite.config.ts`'s dev proxy, `functions/api/[[path]].ts`'s prod Pages Function) is what makes the session cookie first-party; only set this for a deliberately cross-origin setup. |

`import.meta.env.DEV` (Vite's own built-in, not a custom var) gates
`src/components/StateSwitcher.tsx`, a dev-only debug affordance that never
ships to production builds.

## Local setup from a fresh clone

1. `npm install` at the repo root (workspaces: `packages/core`, `packages/db`,
   `apps/api`, `apps/web`, `e2e`).
2. `npm run db:local:reset` — applies D1 migrations and loads
   `packages/db/seed.sql` (the Maya demo account) into the local dev D1.
3. `npm run dev:api` and `npm run dev:web` in separate terminals (or let
   `e2e/playwright.config.ts`'s `webServer` start both automatically for
   e2e runs).
4. No secrets are required for local dev — every one degrades gracefully
   per the table above. `apps/api/.dev.vars` only exists for the one var
   (`STRIPE_WEBHOOK_SECRET`) that needs a real-looking value for the
   webhook-signature integration/e2e tests to exercise the actual signing
   path locally.
