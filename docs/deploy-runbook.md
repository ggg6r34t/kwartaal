# Deploy runbook

## Environments

`apps/api/wrangler.toml` defines three explicit blocks — default (local dev),
`[env.staging]`, `[env.production]` — per the architecture non-negotiable that
staging must never double as production. Each has its own D1 database, R2
buckets, queues, and vars. Staging and production resource names are
currently `REPLACE_WITH_*` placeholders (see wrangler.toml) — provisioning
them with real Cloudflare resources is part of the cutover below, not done
yet in this repo.

The web app (`apps/web`) builds to a static SPA + SSR shell
(`npm run build -w @kwartaal/web`) deployed as a Cloudflare Pages project;
its origin feeds `APP_ORIGIN`/`BETTER_AUTH_URL` on the API side.

## Normal deploy (staging or production)

```
npm run typecheck && npm test && npm run lint && npm run format:check && npm run token-check
npm run build:web
npx wrangler deploy --env staging   # or --env production, from apps/api
```

CI (`.github/workflows/ci.yml`) runs the same gate plus `wrangler deploy
--dry-run` on every push; a real `wrangler deploy` is a manual/protected step,
not automatic on merge.

After deploying, confirm the cron triggers actually registered:

```
npx wrangler deployments list --env production
```

and watch `npx wrangler tail --env production` for the next `"scheduled-
trigger-fired"` log line at the top of the hour — this is the same structured
JSON logging (`request-id`, `org-id` on request logs) the Definition of Done
requires to be visible in `wrangler tail`.

## Staging → production cutover checklist

Everything below requires real Cloudflare/Stripe/Resend/Sentry credentials
this environment does not have — **BLOCKED**, not attempted. Listed here so
the checklist exists and each item has a concrete, checkable definition of
done rather than being deferred vaguely.

- [ ] Custom domain attached to the production Pages project + API Worker
      route (replace `REPLACE_WITH_PRODUCTION_ORIGIN` in wrangler.toml).
- [ ] Live Stripe keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` via
      `wrangler secret put --env production`) and real
      `STRIPE_PRICE_MONTHLY`/`STRIPE_PRICE_ANNUAL` price IDs — see PROGRESS.md,
      no Stripe account exists yet.
- [ ] Resend domain verified (SPF + DKIM DNS records published and passing)
      for `EMAIL_FROM`'s domain, and `RESEND_API_KEY` set as a secret.
- [ ] `SENTRY_DSN` secret set; confirm receipt by throwing a real test error
      in production and checking it lands in Sentry.
- [ ] TaxFigures 2026 row seeded into the production D1 (`packages/db/seed.sql`
      or a dedicated insert — never edited in place once real, per
      `docs/tax-figures.md`).
- [ ] Uptime monitor pointed at `GET /health/ready` (200 = DB reachable,
      503 = not — see `apps/api/src/routes/health.ts`).
- [ ] Real R2 buckets and queues provisioned under the production names in
      wrangler.toml (currently `REPLACE_WITH_PRODUCTION_*` placeholders).
- [ ] Cron verified firing in production (see `wrangler tail` step above).

## Backup & restore

### How the weekly backup works

`apps/api/src/lib/backup.ts`'s `runWeeklyBackup`, invoked from the
`"0 3 * * 0"` branch of `scheduled.ts`'s cron handler: enumerates every real
D1 table via `PRAGMA table_list` (filtering out SQLite's own `sqlite_%`
tables, Cloudflare's internal `_cf_%` tables, and `d1_migrations`), dumps
each table's full row set to its own `<table>.json`, zips them into
`weekly/<iso-timestamp>.zip` in the `BACKUPS` R2 bucket, and prunes down to
the 8 most recent (~2 months). It captures Better Auth's `user`/`session`/
`account`/`verification` tables too, since they're just more rows in the
same D1 — a restore needs them to bring back working logins, not just
business data. Covered by
`apps/api/src/integration/backup-and-deletion.test.ts` (real D1/R2 under
`@cloudflare/vitest-pool-workers`): the zip contains every table including
`user.json`, a freshly-created org round-trips through it, and pruning
correctly caps at 8.

### Restore procedure

1. Download and unzip the target `weekly/<timestamp>.zip` from the
   `BACKUPS` bucket (`wrangler r2 object get`).
2. Target a **bare, empty** D1 database — do not run
   `wrangler d1 migrations apply` first. Each table's JSON was dumped
   alongside D1's own schema info; the restore recreates schema from
   scratch per table, in dependency order, not from the migrations
   directory.
3. For each table, in FK dependency order (parents before children —
   `orgs` → `users`/`business_profiles`/... → everything that references
   them; the full order mirrors `packages/db/src/schema.ts`'s declaration
   order top to bottom), generate `INSERT INTO <table> (...) VALUES (...)`
   statements from that table's JSON array and execute them with
   `wrangler d1 execute <db> --file=<generated>.sql` (`--remote` against
   real D1, or `--local` for a drill).
4. Re-run `wrangler d1 migrations apply <db>` last, as a no-op sanity check
   — it should report every migration already applied (D1 infers this from
   the schema the restored data already implies... in practice, simplest is
   to restore into a DB that had migrations applied *before* step 1's data
   load, which is why step 2 above uses each table's own JSON rather than a
   combined schema+data dump — see the finding below for why).

### What was actually rehearsed (2026-07-23, local)

A full disaster-recovery drill was run against the real local dev D1 (not
staging — no staging Cloudflare credentials exist in this environment; see
the cutover checklist above):

1. Confirmed the seeded local dev D1 (`kwartaal`, `--local`) had real data:
   4 orgs, 16 quarters, 5 users, 4 income lines.
2. Exported it with `wrangler d1 export kwartaal --local --output=...sql`
   (a real, complete SQL dump — schema + data together, Cloudflare's own
   export format, distinct from this app's own per-table JSON backup format
   described above).
3. Backed up the local D1 state directory, then deleted it entirely
   (`rm -rf .wrangler/state/v3/d1`) to simulate total data loss, and
   confirmed the simulated loss (`SELECT COUNT(*) FROM orgs` → "no such
   table").
4. Attempted to restore by running `wrangler d1 migrations apply` (fresh
   schema) followed by importing the export — **failed**:
   `table d1_migrations already exists`, because `wrangler d1 export`'s
   dump already includes a `CREATE TABLE d1_migrations` statement (it's a
   real table in the source DB); pre-applying migrations and then importing
   a full export double-creates it.
5. Retried against a bare, un-migrated D1 (import only, no pre-applied
   migrations) — **failed differently**: `no such table: main.users`. The
   dump's tables are ordered alphabetically, and `wrangler d1 execute
   --file` against local D1 does not execute the whole file as one ordered
   batch — statements referencing tables declared later in the file (`users`
   sorts after `audit_logs`, which has an FK to it) ran before that table's
   `CREATE TABLE` reached the local database. This reproduced with
   `PRAGMA foreign_keys=OFF` prepended too, ruling out FK-constraint timing
   specifically — it's statement-ordering, not constraint enforcement.
6. Restored the local dev D1 from the step-3 filesystem backup and verified
   original row counts came back exactly (4 orgs, 16 quarters, 5 users, 4
   income lines) — **the dev environment was left exactly as found**.

**Conclusion:** a single combined `wrangler d1 export` dump is not reliably
restorable via `wrangler d1 execute --file` against **local** D1 on this
wrangler version (3.114 — several majors behind current). This is why the
restore procedure above uses this app's own per-table JSON backup (already
proven correct by `backup-and-deletion.test.ts`) with an explicit
dependency-ordered, per-table import rather than one interleaved dump — that
approach was reasoned through but not yet executed end-to-end against a real
D1 in this session (writing and running the per-table SQL generator is the
next concrete step, tracked as follow-up work). Restoring against **real**
(non-local) D1 via `--remote` goes through Cloudflare's actual D1 import API
rather than local Miniflare's batching, and is the path that matters for a
genuine production incident — that path is what the staging rehearsal the
plan calls for would exercise, and remains **BLOCKED** on staging
credentials.

## Health & monitoring

- `GET /health/ready` — `{ ready: true, checks: { database: true } }` on
  success, 503 otherwise. Point the uptime monitor here, not `/health`
  (which only confirms the Worker itself is running, not D1 connectivity).
- `wrangler tail` — structured JSON logs (`apps/api/src/lib/logger.ts`),
  every request log line carries `requestId` and (once authenticated)
  `orgId`.
- Sentry: `SENTRY_DSN` secret, currently unset in all three environments
  (see cutover checklist).
