# STACK-BLUEPRINT

Reference for replicating this repo's engineering foundation in a new, unrelated product.
Audited from the Hackiwi/SlackersHub monorepo. Machinery only — no product features.
Secrets redacted. Where the repo's reality differs from its own README ("proposed stack"),
this documents the reality.

Runtime target: **Cloudflare Workers (API) + Cloudflare Pages (SPA) + D1 (SQLite) + Drizzle + Better Auth + Hono + React 18 + Vite + Tailwind v3.** Node 22.18.0 (`.node-version`), npm workspaces. TypeScript strict everywhere. No bundler-level monorepo tool (Turbo/Nx); plain `npm --workspaces`.

---

## 1. Monorepo layout & tooling

### Workspace manager

npm workspaces (no pnpm/yarn/turbo). Single root lockfile, one `npm ci` installs all.

```
root
├── package.json            # workspaces + orchestration scripts
├── tsconfig.base.json      # shared strict compiler options
├── .node-version           # 22.18.0 — read by CI, Cloudflare Pages, fnm/nvm/Volta
├── apps/
│   ├── api/                # Hono Worker (the API)
│   ├── web/                # React SPA + SSG prerender + Pages Functions proxy
│   ├── addin-gmail/        # README only (scaffold)
│   └── addin-outlook/      # README only (scaffold)
└── packages/
    ├── db/                 # Drizzle schema, migrations, tenant guard, seed, bootstrap CLIs
    ├── core/               # framework-free domain types + RBAC + entitlement + safety
    ├── content/            # static training taxonomy (pure data)
    ├── ai/  osint/  ui/    # README only (scaffold)
```

Root `package.json` declares only five real workspaces: `packages/core`, `packages/content`, `packages/db`, `apps/api`, `apps/web`. The `ai/osint/ui` dirs are README-only placeholders — do **not** carry them forward unless you fill them.

### TypeScript config inheritance

`tsconfig.base.json` is the shared base. `apps/api`, `packages/db`, `packages/core`, `packages/content` all `extends` it. **`apps/web` does NOT extend base** — it is a self-contained Vite tsconfig with project references (`tsconfig.node.json` for the Vite config). Replicate the split; don't try to unify web under the base (its `lib`/`jsx`/`moduleResolution` needs differ).

Base compiler options (copy verbatim as a starter):

```jsonc
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "Bundler",
  "lib": ["ES2022"],
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "esModuleInterop": true,
  "skipLibCheck": true,
  "forceConsistentCasingInFileNames": true,
  "isolatedModules": true,
  "verbatimModuleSyntax": true,
  "noEmit": true,
}
```

Cross-package imports resolve two ways at once: **path aliases** in `apps/api/tsconfig.json` for the typechecker, and **package `exports`** pointing at raw `src/*.ts` for the runtime bundler (Wrangler/Vite compile TS directly — packages ship no build step):

```jsonc
// apps/api/tsconfig.json
"paths": {
  "@hackiwi/content": ["../../packages/content/src/index.ts"],
  "@hackiwi/core":    ["../../packages/core/src/index.ts"],
  "@hackiwi/db":      ["../../packages/db/src/index.ts"]
}
```

```jsonc
// packages/db/package.json — no "build"; main points straight at TS source
"main": "./src/index.ts", "types": "./src/index.ts",
"exports": { ".": "./src/index.ts", "./schema": "./src/schema.ts" }
```

### Core stack — exact versions (from package.json)

| Dep                         | Version                                 | Where                                                       |
| --------------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `hono`                      | ^4.6.14                                 | apps/api                                                    |
| `better-auth`               | ^1.6.23                                 | api, web, db (all pinned identical — keep them in lockstep) |
| `drizzle-orm`               | ^0.45.2                                 | apps/api, packages/db                                       |
| `drizzle-kit`               | ^0.31.10                                | packages/db (dev)                                           |
| `wrangler`                  | ^3.99.0                                 | apps/api (dev)                                              |
| `@cloudflare/workers-types` | ^4.20241218.0                           | api, db (dev)                                               |
| `react` / `react-dom`       | ^18.3.1                                 | apps/web                                                    |
| `react-router-dom`          | ^6.28.0                                 | apps/web                                                    |
| `vite`                      | ^5.4.10                                 | apps/web (dev)                                              |
| `@vitejs/plugin-react`      | ^4.3.3                                  | apps/web (dev)                                              |
| `tailwindcss`               | ^3.4.14                                 | apps/web (dev) — **v3, not v4**                             |
| `vitest`                    | ^3.2.7                                  | api, web, db                                                |
| `typescript`                | ^5.7.2 (root/api/db/core), ^5.6.3 (web) | all                                                         |

No Zod, no Prisma, no tRPC, no state library, no data-fetching library. Deliberately thin.

### Every script, per package

Root:

- `typecheck` / `test` / `build` → `npm run <x> --workspaces --if-present`
- `dev:api` → `npm run dev -w @hackiwi/api`
- `dev:web` → `npm run dev -w @hackiwi/web`
- `build:web` → `npm run build -w @hackiwi/web`
- `db:local:reset` → delegates to api's reset

`@hackiwi/api`:

- `dev` → `wrangler dev`
- `deploy` → `wrangler deploy`
- `typecheck` → `tsc --noEmit`
- `test` → `vitest run`
- `db:local:reset` → `wrangler d1 migrations apply hackiwi --local && wrangler d1 execute hackiwi --local --file=../../packages/db/seed.sql`

`@hackiwi/web`:

- `dev` → `vite`
- `build` → `node scripts/generate-sitemap.mjs && tsc -b && vite build && vite build --ssr src/entry-prerender.tsx --outDir dist-server --emptyOutDir && node scripts/prerender.mjs` (SPA build + SSG prerender of public routes)
- `preview` → `vite preview`
- `og` → `tsx scripts/generate-og.mts` (OG image generation via resvg)
- `typecheck` / `test`

`@hackiwi/db`:

- `typecheck`
- `generate` → `drizzle-kit generate` (schema diff → SQL migration)
- `test` → `vitest run`

`@hackiwi/core`, `@hackiwi/content`: `typecheck` only.

---

## 2. Cloudflare topology

Single `wrangler.toml` at `apps/api/wrangler.toml`. The web app is a **Pages** project (deployed via Pages build of `apps/web`), not a Worker — it reaches the API through a Pages Function proxy (§9), not a route in this toml.

```toml
name = "hackiwi-api"
main = "src/index.ts"
compatibility_date = "2024-12-18"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "hackiwi"
database_id = "REPLACE_WITH_D1_DATABASE_ID"
# Migrations live in packages/db, not next to the Worker. Without this,
# `wrangler d1 migrations apply` looks in apps/api/migrations.
migrations_dir = "../../packages/db/migrations"

# [[r2_buckets]]           # DECLARED-BUT-COMMENTED. No R2 yet.
# binding = "ASSETS"
# bucket_name = "hackiwi-assets"

[vars]
ENVIRONMENT = "development"
BETTER_AUTH_URL = "http://localhost:8787"
APP_ORIGIN = "http://localhost:5173"

[env.staging]
name = "hackiwi-api-staging"
[env.staging.vars]
ENVIRONMENT = "staging"
BETTER_AUTH_URL = "https://<public-origin>"          # bare origin, NOT the *.workers.dev URL
APP_ORIGIN = "https://<origin>,https://<origin>.pages.dev"   # comma-separated allow-list
EMAIL_FROM = "Hackiwi <no-reply@send.<domain>>"
[[env.staging.d1_databases]]
binding = "DB"
database_name = "hackiwi-staging"
database_id = "<redacted-uuid>"
migrations_dir = "../../packages/db/migrations"
```

**Bindings:** only `DB` (D1). No R2, **no Queues**, no KV, no Durable Objects, no service bindings _in the API toml_. (The Pages project has one service binding `API` → the Worker; configured on the Pages side, §9.)

**Environments:** default block = dev; `[env.staging]` = staging. **No prod block exists yet** — staging currently serves the live public origin. If you replicate, add `[env.production]` explicitly; don't let staging double as prod.

**Secrets (never vars)** — set per-env with `wrangler secret put <NAME> [--env staging]`:

- `BETTER_AUTH_SECRET` — session-cookie signing key
- `SECRETS_ENCRYPTION_KEY` — KEK for tenant secrets (`openssl rand -base64 32`)
- `RESEND_API_KEY` — transactional email
  Local dev uses insecure in-code fallbacks (§5, §8) so no `.dev.vars` is required to boot.

**Local dev:** `wrangler dev` runs the Worker on :8787 against a local D1; `vite` runs the SPA on :5173 and proxies `/api` → :8787 (§9). Reset local DB: `npm run db:local:reset` (apply migrations + load `seed.sql`).

**Deploys:** `wrangler deploy [--env staging]`. Migrations applied separately: `wrangler d1 migrations apply <db> [--remote] [--env staging]`. Seed a remote demo DB: `wrangler d1 execute <db> --remote --file=packages/db/seed.sql`. CI does not deploy — deploy is a manual consequence of a green build (§10).

---

## 3. API architecture (Hono)

### Composition (`apps/api/src/index.ts`)

Single `Hono<AppEnv>` app. Middleware order is load-bearing:

```ts
app.use("*", secureHeaders());   // 1. security headers on every response
app.use("*", cors());            // 2. CORS
app.use("*", withDb);            // 3. attach per-request Drizzle client
app.onError(...)                 //    structured error handler (below)

// Auth endpoints: IP rate-limited, Better Auth handles its own CSRF.
app.use("/api/auth/*", rateLimit({ bucket: "auth", limit: 20, windowSec: 60 }));
app.on(["GET","POST"], "/api/auth/*", c => createAuth(c.get("db"), c.env).handler(c.req.raw));

// Public, no auth:
app.route("/health", health);
app.route("/library", library);

// Authenticated: CSRF guard THEN session gate, per-route RBAC inside modules.
app.use("/orgs/*",        csrfGuard, requireSession);
app.use("/domains/*",     csrfGuard, requireSession);
app.use("/templates/*",   csrfGuard, requireSession);
app.use("/campaigns/*",   csrfGuard, requireSession);
app.use("/integrations/*",csrfGuard, requireSession);
app.route("/orgs", orgs); /* …etc */

app.notFound(c => c.json({ error: "not-found" }, 404));
```

Key point: **Better Auth mounts at `/api/auth/*`; every other route mounts at the root** (`/orgs`, not `/api/orgs`). The `/api` prefix the browser uses is stripped by the dev proxy and the Pages proxy (§9). This asymmetry is the single most error-prone part of the topology — replicate the proxy exactly or drop the asymmetry.

Middleware chain per request: `secureHeaders → cors → withDb → [rateLimit on auth] → csrfGuard → requireSession → requireRole(...) → handler`.

### Error handling (`app.onError`)

```ts
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse(); // honour CSRF 403 etc.
  console.error(
    JSON.stringify({
      level: "error",
      path: new URL(c.req.url).pathname,
      method: c.req.method,
      message: err instanceof Error ? err.message : String(err),
    }),
  );
  return c.json({ error: "internal-error" }, 500); // never leak a stack
});
```

Every error body is `{ error: "<stable-code>" }`. The client keys off `error` strings, not messages (§9 `ApiError`).

### CSRF

`hono/csrf` with an Origin allow-list built from `APP_ORIGIN` + `BETTER_AUTH_URL`; falls back to `localhost` when unset. Applied to state-changing route groups, **not** to `/api/auth/*` (Better Auth runs its own origin check via `trustedOrigins`). Two separate checks guarding two separate route sets — keep both.

### Validation — MANUAL, no Zod

There is no schema-validation library. Request bodies are read with a hand-written interface and `c.req.json<T>()`, then checked ad hoc:

```ts
interface CreateCampaignBody {
  name: string;
  templateId: string;
  fromDomain: string;
  audience: CampaignAudience;
  scheduledAt?: string | null;
}
const body = await c.req.json<CreateCampaignBody>();
if (!body.value) return c.json({ error: "missing-value" }, 422);
```

**There is no response validation** — routes hand-pick columns in the `.select({...})` projection to control what leaves the server. This is the repo's weakest layer (§11); a new product should add Zod (or `@hono/zod-validator`) for request parsing and typed responses.

### Annotated end-to-end example: `POST /campaigns`

Definition → gates → DB → audit, one flow (`apps/api/src/routes/campaigns.ts`):

```ts
campaigns.post("/", requireRole("manager"), async (c) => {
  // (1) RBAC: manager+
  const db = c.get("db"); //     Drizzle client from withDb
  const { orgId, userId } = c.get("session"); //     identity from requireSession

  const org = await getOrganisation(db, orgId); // (2) load tenant row (repo.ts)
  if (!org) return c.json({ error: "org-not-found" }, 404);

  const entitlement = canUsePhishingSimulator(org); // (3) domain gate #1 (core/plan.ts)
  if (!entitlement.allowed)
    return c.json(
      { error: "phishing-sim-not-allowed", reason: entitlement.reason },
      403,
    );

  const body = await c.req.json<CreateCampaignBody>(); // (4) manual body parse
  const safetyErrors = validateCampaignSafety(org, {
    // (5) domain gate #2 (core/safety.ts)
    fromDomain: body.fromDomain,
    audience: body.audience,
  });
  if (safetyErrors.length > 0)
    return c.json({ error: "unsafe-campaign", violations: safetyErrors }, 422);

  const id = crypto.randomUUID(); // (6) write (raw insert, org_id explicit)
  await db
    .insert(schema.campaigns)
    .values({
      id,
      orgId /* … */,
      fromDomain: body.fromDomain.toLowerCase(),
      status: body.scheduledAt ? "scheduled" : "draft",
    });
  await audit(db, {
    orgId,
    actor: userId,
    action: "campaign.created",
    target: id,
  }); // (7) audit
  return c.json({ id, status: body.scheduledAt ? "scheduled" : "draft" }, 201);
});
```

Note step (6) uses a **raw** `db.insert`, not the tenant guard — see §4.

---

## 4. Multi-tenancy guard

Mechanism: a `TenantDb` wrapper (`packages/db/src/tenant.ts`) bound to one `orgId`, obtained via `forOrg(db, orgId)`. It injects `org_id = :orgId` into reads, forces `org_id` on writes, and throws on any table lacking an `orgId` column.

```ts
export class TenantDb {
  constructor(private readonly db: Database, readonly orgId: string) {}
  select<T extends TenantTable>(table: T, where?: SQL) {
    assertTenantTable(table);
    const scope = eq(table.orgId, this.orgId);
    return this.db.select().from(table).where(where ? and(scope, where) : scope);
  }
  insert<T extends TenantTable>(table: T, values: Record<string, unknown>) {
    assertTenantTable(table);
    return this.db.insert(table).values({ ...values, orgId: this.orgId } as never); // override caller org_id
  }
  update/delete … // both always AND the org scope
  get global(): Database { return this.db; } // explicit, greppable escape hatch for non-tenant tables
}
```

`TENANT_TABLE_NAMES` lists all 26 tenant tables; a test asserts it stays in sync with the schema so a new tenant table can't be added without registering it. `assertTenantTable` throws `"tenant guard: table has no org_id column"` at runtime.

### Can it be bypassed? YES — the guard is opt-in, and most routes don't use it.

This is the single most important critical finding. `forOrg` is only used in **one** route module (`integrations.ts`) and in `lib/secrets.ts`. Every other route filters tenancy **by hand**:

```ts
// orgs.ts, campaigns.ts, templates.ts, domains.ts — raw query, manual eq(orgId)
.from(schema.campaigns).where(eq(schema.campaigns.orgId, orgId))
// campaigns.ts create — raw insert, org_id passed as a literal field
await db.insert(schema.campaigns).values({ id, orgId, … });
```

So org isolation depends on every author remembering the `eq(orgId)` filter and the correct `orgId` literal — exactly the discipline `TenantDb` was built to remove. Queries that circumvent the guard today: **all of** `orgs.ts` (`/me`, `/me/users`, `/me/departments`, entitlements), `campaigns.ts` (list, create, events), `templates.ts` (list), `domains.ts` (list/verify), plus the raw `db.query.*.findFirst` lookups in `middleware/auth.ts` and `lib/secrets.ts`. None are _wrong_ (they do filter), but none are _protected_ by the guard.

For a new product: either (a) make `forOrg` the **only** way to touch tenant tables (don't export the raw `Database` to route handlers; hand them a `TenantDb` from `requireSession`), or (b) delete the guard and be honest that isolation is manual. The current half-adoption is the worst of both — a guard that looks authoritative but isn't enforced.

---

## 5. Auth & RBAC

### Two-layer identity model

- **Better Auth** owns identity/credentials: tables `user`, `session`, `account`, `verification` (`packages/db/src/auth-schema.ts`; drizzle property keys must match Better Auth's field names exactly).
- **App `users` table** (`schema.ts`) owns org membership + RBAC, linked via `users.authUserId → user.id`. "Who is this" (Better Auth) is separate from "which org, what role" (app).

### Better Auth setup (`apps/api/src/auth/index.ts`)

Instantiated **per request** because the D1 binding is only available per request:

```ts
export function createAuth(db: Database, env: Bindings) {
  return betterAuth({
    secret: resolveAuthSecret(env), // allow-list of one; unknown env throws (secret.ts)
    baseURL: env.BETTER_AUTH_URL || "http://localhost:8787",
    trustedOrigins: parseTrustedOrigins(env.APP_ORIGIN), // comma-separated; its own origin check
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      disableSignUp: true,
    },
    plugins: [
      magicLink({
        disableSignUp: true,
        sendMagicLink: async ({ email, url }) => {
          await requestMagicLinkSend(db, env, email, url);
        },
      }),
    ],
  });
}
```

Sign-up is closed on **both** the password path and the magic-link path (`disableSignUp` on each — two mechanisms, two routes; closing one leaves the other open). Accounts are created out-of-band by the bootstrap CLI (§6), never by a public endpoint. Magic-link send is gated on existing membership to avoid an open email relay (§8, and see memory `[[better-auth-magic-link-behavior]]`).

### Session resolution (`middleware/auth.ts`)

```ts
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const auth = createAuth(c.get("db"), c.env);
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result?.user) return c.json({ error: "unauthenticated" }, 401);
  const membership = await db.query.users.findFirst({
    where: eq(schema.users.authUserId, result.user.id),
  });
  if (!membership || membership.status === "suspended")
    return c.json({ error: "no-active-membership" }, 403);
  c.set("session", {
    userId: membership.id,
    orgId: membership.orgId,
    role: membership.role as Role,
  });
  await next();
});
```

A valid identity with no membership row is authenticated but authorized for no tenant → 403. Suspended members are rejected here. Session cookie is Better Auth's default (SameSite=Lax) — kept first-party via the same-origin proxy (§9).

### Roles

Stored as a text column `users.role`. Hierarchy in `packages/core/src/rbac.ts`:

```ts
export const ROLE_RANK = {
  owner: 4,
  admin: 3,
  manager: 2,
  learner: 1,
  viewer: 0,
};
export const roleAtLeast = (role, minimum) =>
  ROLE_RANK[role] >= ROLE_RANK[minimum];
```

### Protecting a route / a mutation

Route group: `app.use("/campaigns/*", csrfGuard, requireSession)`.
Mutation-level RBAC: `requireRole` middleware placed on the specific verb, after `requireSession`:

```ts
export function requireRole(minimum: Role) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { role } = c.get("session");
    if (!roleAtLeast(role, minimum))
      return c.json({ error: "forbidden", requiredRole: minimum, role }, 403);
    await next();
  });
}
// usage:
campaigns.post("/", requireRole("manager"), handler);
domains.post("/:domain/verify", requireRole("admin"), handler);
integrations.put("/:service/secret", requireRole("admin"), handler);
```

Frontend `RequireAuth` (§9) only decides what to render; the server is the sole authority.

---

## 6. Database conventions

Drizzle + D1 (SQLite). Schema in `packages/db/src/schema.ts` (one file, ~30 tables, sectioned by domain with comment banners).

### Patterns

- **Table names** snake_case; **columns** snake_case in SQL, camelCase in TS (`orgId: text("org_id")`).
- **PKs**: `text("id").primaryKey()`, populated with `crypto.randomUUID()` (app-side) or prefixed ids in seeds (`usr_`, `cmp_`).
- **Tenancy**: every tenant table has `orgId: text("org_id").notNull().references(() => organisations.id, { onDelete: "cascade" })` + an index on it. Global tables (`modules`, `phishing_templates`, `learning_paths`) make `org_id` **nullable** (null = shared platform content, set = org-authored).
- **Timestamps**: text ISO strings, `.default(sql\`CURRENT_TIMESTAMP\`)`, named `createdAt`/`updatedAt`/domain-specific (`verifiedAt`, `ranAt`). **Exception:** Better Auth tables use `integer({ mode: "timestamp" })` — its adapter requires it. Two timestamp conventions coexist by necessity.
- **Booleans**: `integer({ mode: "boolean" })`.
- **JSON**: `text({ mode: "json" }).$type<T>()` (e.g. `domains: string[]`, `audience`, `config`, `meta`).
- **Money/rates**: stored as integer basis points (`clickRateBps: 1460 = 14.6%`) to avoid float drift.
- **No soft deletes.** Deletion is real, via `onDelete: "cascade"` FKs. Lifecycle is modelled with `status` text columns instead (`"active"|"invited"|"suspended"`, `"draft"|"scheduled"|…`).
- **Indexes**: per-table array form `(t) => [index("x_org_idx").on(t.orgId), uniqueIndex("…").on(t.orgId, t.email)]`. Compound unique on `(orgId, naturalKey)` is the norm.
- **Enums**: not SQL enums — plain `text` with the allowed values written in a `//` comment above the column, validated in app code.

### Migration workflow

1. Edit `schema.ts`.
2. `npm run generate -w @hackiwi/db` (`drizzle-kit generate`, config `drizzle.config.ts`: `dialect: "sqlite"`, `driver: "d1-http"`, `out: "./migrations"`).
3. Commit generated SQL + `migrations/meta/*_snapshot.json` + `_journal.json`.
4. Apply: `wrangler d1 migrations apply <db> [--local|--remote] [--env staging]`.
   Migrations live in `packages/db/migrations` and Wrangler is pointed there via `migrations_dir` in every toml env block.

### Seed strategy — two distinct paths, do not confuse

- **Demo seed** (`packages/db/src/seed.ts`, `seedDemoTenant`): **deterministic** — fixed ids + fixed timestamps — so re-applying yields byte-identical state that reproduces the design mockups exactly (one org "Noordkust Logistics", 7 users, campaigns with a real 187-recipient event history, triage inbox, OSINT/SBOM/domain fixtures). Password hash is **hardcoded** (not computed) because Better Auth salts randomly and `seed.sql` is a committed, diffed artifact. `seed.sql` is generated from the TS by `scripts/gen-seed-sql.mts` using an in-memory D1 shim (`scripts/lib/memory-d1.mts`) + `dumpInserts`. Never loaded into production. Chunked inserts (40 rows) respect D1's bound-variable cap.
- **Bootstrap** (`packages/db/src/bootstrap.ts` + `scripts/bootstrap-org.mts`): **non-deterministic** — random ids, random 24-char password (Web Crypto, rejection-sampled, ambiguous chars removed), shown once, never stored. Creates the first real org + owner for a live deploy without publishing a credential. Emits SQL; output is git-ignored (`packages/db/.bootstrap/`). Companion `add-member.mts` adds colleagues to an existing org.

---

## 7. Async job pattern — NOT IMPLEMENTED

The README lists Cloudflare Queues; **there are none.** No `[[queues]]` producer/consumer in `wrangler.toml`, no `queue()` handler in the Worker, no message shapes, no retry/idempotency code. Schema hints at where jobs will go — `web_scans.status` uses `"queued"|"running"|"completed"|"failed"`, `campaigns.status` has `"sending"` — but nothing drives those transitions; the seed writes terminal states directly.

Job **status persistence** is modelled (a `status` text column + a `*_findings` child table per scan type, plus `notifications` for surfacing to the UI), so the data layer is ready. If you replicate: add a `[[queues.producers]]`/`[[queues.consumers]]` pair, an `export default { fetch, queue }` on the Worker, a typed message union, and use the existing `status` columns as the idempotency/progress ledger. Don't assume any of that exists here to copy.

---

## 8. Secrets & integrations

### Encrypted tenant-secret store

- **Storage** (`schema.secrets`): `{ id, orgId, integrationId?, keyRef, ciphertext, iv, createdAt }`. Only ciphertext + iv persisted; plaintext never stored, never returned.
- **Crypto** (`lib/crypto.ts`): AES-256-GCM via Web Crypto (`crypto.subtle`). KEK from `SECRETS_ENCRYPTION_KEY`. Key import accepts a base64 32-byte key or hashes any other string to 32 bytes via SHA-256 (so a dev string works). 96-bit random IV per encryption. `sealSecret`/`openSecret`.
- **Repo** (`lib/secrets.ts`): `putSecret` upserts by `(integration, keyRef)` and encrypts; `getSecret` decrypts, **server-side only** (comment: never return to a client). `putSecret` uses the tenant guard (`forOrg`), the read uses a raw scoped query.

### Test-connection pattern — schema-only

`integrations.lastTestedAt` and `status ("unconfigured"|"configured"|"error")` exist for it, but **no test-connection endpoint is implemented.** The store-secret route just persists; it doesn't verify the credential against the provider. If replicating, add a `POST /integrations/:service/test` that decrypts, calls the provider, and updates `status`/`lastTestedAt`.

### Degraded-mode pattern (this IS implemented, and is the reusable idea)

When a dependency is unconfigured, fail closed with a specific code rather than 500:

```ts
// integrations.ts — no KEK ⇒ 503, not a crash
const kek = c.env.SECRETS_ENCRYPTION_KEY;
if (!kek) return c.json({ error: "secrets-not-configured" }, 503);
```

```ts
// email/resend.ts — missing key throws loudly
if (!env.RESEND_API_KEY)
  throw new Error("RESEND_API_KEY is not configured; cannot send email");
```

```ts
// email/deliver-magic-link.ts — dev logs the link, everything else emails; unknown env sends (fails safe)
if (env.ENVIRONMENT === "development") {
  console.log(`[magic-link] … ${url}`);
  return;
}
await sendEmail(env, { to: email, ...buildMagicLinkEmail(url) });
```

And the anti-enumeration variant (`auth/request-magic-link.ts`): gate the send on membership, then **swallow** delivery failure so the endpoint returns a uniform 200 whether or not the address exists — no enumeration signal in status or body. Two "is this development?" allow-lists (`resolveAuthSecret`, `deliverMagicLink`) treat _unknown_ env as production so a typo can't silently downgrade security.

---

## 9. Frontend architecture (SPA)

### Structure

Vite + React 18 + react-router-dom v6. Alias `@ → src`. Two surfaces in one build:

- **Public marketing/library** (`/`, `/about`, `/library`, `/library/:slug`) under `PublicLayout`, statically **prerendered** (SSG) at build time via a separate `--ssr entry-prerender.tsx` pass + `scripts/prerender.mjs` for SEO.
- **Authenticated console** (`/app/*` admin, `/me/*` employee) behind `RequireAuth`, rendered by one `AppShell view="admin"|"employee"`.

Routing is centralised in `App.tsx` (`<Routes>`), with a `ScrollManager` and a legacy-URL redirect. Screens render into `<Outlet/>`.

### Data fetching & API client (`lib/api.ts`)

Plain `fetch`, no React Query/SWR. `BASE = import.meta.env.VITE_API_URL ?? "/api"`. Paths are API-root-relative (`apiFetch("/domains")`). `credentials: "include"` sends the session cookie. Non-2xx throws a typed `ApiError(status, code)` where `code` is the server's stable `error` string. A 401 triggers an injected `onUnauthenticated()` callback (wired in `App.tsx` to redirect to `/signin`) so the client stays browser-free and testable.

**Type sharing with the backend**: via `@hackiwi/core` — both API and web import the same framework-free domain types/enums (`Role`, `Organisation`, `Campaign`, entitlement helpers). There is **no** generated client or OpenAPI contract; request/response body shapes are duplicated by hand on each side (a gap — see §11).

### Auth client (`lib/auth-client.ts`)

`better-auth/react` `createAuthClient` + `magicLinkClient`. Exposes `useSession`, `signIn`, `signOut`. SSR-guarded `baseURL` (`window` may be undefined during the prerender pass). `RequireAuth` uses `useSession()`, renders blank while pending, redirects to `/signin` when unauthenticated.

### The same-origin proxy (critical)

Prod parity of the dev Vite proxy, as a Pages Function (`apps/web/functions/api/[[path]].ts`):

```ts
// Strip /api for everything except /api/auth (Worker mounts auth at /api/auth, rest at root),
// then forward via the Pages service binding `API`, preserving method/body/headers/Cookie/Origin.
if (!url.pathname.startsWith("/api/auth"))
  url.pathname = url.pathname.replace(/^\/api/, "");
return context.env.API.fetch(new Request(url, context.request));
```

Reason: app on `*.pages.dev` and Worker on `*.workers.dev` are cross-site (separate PSL entries), so a SameSite=Lax cookie set by the Worker is never sent back → sign-in "works" then everything 401s. Serving the API from the app's own origin keeps the cookie first-party. Dev proxy in `vite.config.ts` does the identical rewrite. **These two must stay in agreement.**

### State management

None beyond React local state + `useSession`. Demo screens read static client data (`app/demo.ts`, `data/*`) that each pillar is meant to replace with live API calls.

### App shell / nav / badge system

`AppShell` → `Topbar` + `Sidebar` + `<main>`, wrapped in `.sh-app`. Nav is data-driven (`app/nav.ts`): `NavGroup[]` of `NavItem { label, to, icon (lucide), badge?: {text, tone: "danger"|"warn"|"info"}, disabled?, pillar }`. Admin vs employee are two exported arrays. Badge counts come from `app/demo.ts` (`navBadges`) — placeholder until live.

### Tailwind conventions & design tokens (deliberate two-system split)

- **Tailwind v3** (`tailwind.config.js`) governs the **public site only**. Rich custom theme: `brand` (iris `#5B4FE9`) scale, `ink` text ramp, `night`/`dusk` dark bands, status colours, `kiwi` graphic accent, custom radii (`card`/`control`), shadows (`cta`, `glass`), keyframes/animations. Fonts self-hosted via `@fontsource` (no CDN — privacy). Content globs `./index.html`, `./src/**/*.{ts,tsx}`.
- **The console has its own scoped system** (`src/app/theme.css`), CSS custom properties under `.sh-app` (flat, hairline-bordered, white-on-white Stripe-console idiom), intentionally _not_ driven by the Tailwind config. Scoping under `.sh-app` keeps console chrome out of the public pages. (See memory `[[slackershub-marketing-v3]]`.)

### Loading / error / empty states

`RequireAuth` renders `null` while `isPending` (deliberate blank over a flash). API errors surface as thrown `ApiError`; a 401 redirects globally. Empty/loading/skeleton conventions are per-screen (a `--skel` token exists in `theme.css`); there is no shared `<Loading>`/`<Error>`/`<Empty>` primitive yet — add one if you replicate.

---

## 10. Observability & hardening

- **Error tracking**: none (no Sentry). `console.error(JSON.stringify({...}))` in `app.onError` is the whole story — Workers logs / `wrangler tail`.
- **Structured logging shape**: `{ level, path, method, message }` JSON on errors; `[magic-link] …` prefixed lines elsewhere. No request-id, no correlation, no per-request access log.
- **Health/readiness** (`routes/health.ts`): `GET /health` → liveness `{ ok, service, environment }` (no deps touched). `GET /health/ready` → runs `SELECT 1` against D1, returns `{ ready, checks: { database } }` or 503. Public, meant for deploy gates.
- **Rate limiting** (`middleware/rate-limit.ts`): D1-backed **fixed window**, keyed by `cf-connecting-ip`. Atomic `INSERT … ON CONFLICT DO UPDATE count = count + 1`, PK `(key, window_start)`. Returns 429 + `Retry-After` past the limit. **Applied only to `/api/auth/*`** (limit 20/60s). No other route is rate-limited. Comment acknowledges Durable-Object precision as the eventual upgrade.
- **Audit log** (`lib/audit.ts` + `schema.auditLog`): `audit(db, { orgId, actor, action, target })` appends an immutable row (`action` = dotted verb like `"campaign.created"`, `"integration.secret.set"`). "Never throws into the caller" per the doc, but the current impl does a bare `insert` with no try/catch, and the helper populates neither the `ip` nor `meta` columns the schema provides — tighten if replicating.
- **CI** (`.github/workflows/ci.yml`): on push-to-main / PR / manual. One `verify` job: checkout → `setup-node` (reads `.node-version`, npm cache) → `npm ci` → `npm run typecheck` → `npm test` → `npm run build:web`. `concurrency` cancels superseded runs. `permissions: contents: read`. **No deploy stage, no lint stage, no coverage gate.**
- **Tests**: Vitest, 22 test files, colocated next to source (`*.test.ts[x]`, `*.test.mts`). Default `environment: "node"`; component tests opt into jsdom per-file via `// @vitest-environment jsdom` docblock (web deps include `@testing-library/react` + `jest-dom`). `packages/db` also tests its `scripts/*.mts` (the bootstrap anti-leak guarantee is a tested property of its SQL output). No integration/e2e harness (no Playwright, no Miniflare integration suite) — tests are unit-level, including tenant-guard invariants and the magic-link membership gate.

---

## 11. Reuse verdict

### (a) Copy nearly verbatim into a new product

- `tsconfig.base.json` — clean strict base.
- `packages/core/src/rbac.ts` — role-rank + `roleAtLeast`. Trivial, correct, framework-free.
- `apps/api/src/lib/crypto.ts` — AES-256-GCM envelope encryption on Web Crypto. Self-contained, Workers-native.
- `apps/api/src/middleware/rate-limit.ts` + `schema.rateLimits` — D1 fixed-window limiter. Portable as-is.
- `apps/api/src/middleware/auth.ts` — `withDb` / `requireSession` / `requireRole` shape (retarget the membership lookup).
- `apps/api/src/routes/health.ts` — liveness + readiness. Copy directly.
- `apps/api/src/auth/*` (`index.ts`, `secret.ts`, `origins.ts`) — per-request Better Auth on Workers + the "allow-list of one, unknown = prod" secret resolution. The security reasoning is the value.
- `apps/api/src/email/*` — Resend-over-HTTPS + dev-logs/prod-sends degraded pattern + anti-enumeration send gate.
- `apps/web/functions/api/[[path]].ts` + `vite.config.ts` proxy — the same-origin cookie solution. Copy the _pair_; they must match.
- `apps/web/src/lib/api.ts` — tiny typed fetch client + `ApiError` + injected `onUnauthenticated`.
- `packages/db/src/tenant.ts` — the guard _design_ is worth copying **if** you also adopt (a) below.
- `packages/db/src/bootstrap.ts` + `scripts/*` — first-owner bootstrap + deterministic-seed-generation pattern (in-memory D1 shim → committed `seed.sql`).
- `.github/workflows/ci.yml` — minimal, correct monorepo verify job.
- Root + package `package.json` script wiring and the `exports`-to-raw-`src/*.ts` package layout.

### (b) Do NOT inherit — fix in the new product

1. **Half-adopted tenant guard.** `forOrg`/`TenantDb` exists but only 1 of 6 route modules uses it; everything else hand-writes `eq(orgId)`. A guard that isn't the only path is theatre. **Fix:** hand route handlers a `TenantDb` (not raw `Database`) from `requireSession`, and never expose the unscoped client to route code. Then delete the manual `eq(orgId)` filters.
2. **No request/response validation library.** Manual `c.req.json<T>()` with ad-hoc checks and hand-picked `.select()` projections is unsafe and duplicative. **Fix:** Zod (or `@hono/zod-validator`) on every mutating route; derive response types from schemas.
3. **No shared API contract.** Body shapes are duplicated between `@hackiwi/api` and `@hackiwi/web`. **Fix:** put request/response schemas in `@hackiwi/core` (or use Hono RPC / `hono/client`) so the client is typed from the server.
4. **Queues advertised, absent.** README and README-only pillar dirs (`ai`, `osint`, `ui`) imply machinery that doesn't exist. Don't scaffold empty promises; add the queue producer/consumer + typed message union when you actually need async work (§7).
5. **Two timestamp conventions** (text ISO app-side vs integer epoch for Better Auth). Unavoidable given the adapter, but document it loudly; it bites on joins/sorting.
6. **`updatedAt` not maintained** on the app tables (only `createdAt` defaults; no `$onUpdate`). Add `updatedAt` with an update trigger/hook if you need it.
7. **Observability is bare.** No error tracker, no request id, no access log, rate-limiting only on auth, audit log missing `ip`/`meta`. Fine for a prototype, not for a security product. Add Sentry (or Workers Logpush + Tail Workers), a request-id middleware, and broaden rate limiting before real traffic.
8. **No prod environment block** in `wrangler.toml` — staging doubles as prod. Add an explicit `[env.production]`; never let one env silently serve another's traffic.
9. **CORS is wide open** (`cors()` with no options) while CSRF is strict. Reconcile: with the same-origin proxy you likely don't need permissive CORS at all.
10. **`apps/web` tsconfig doesn't extend the base** and re-declares strictness by hand — easy to drift. Extend base and override only what Vite needs.
11. **No lint/format in CI** (no ESLint/Prettier gate; a stray `eslint-disable` in `seed.ts` implies ESLint exists somewhere but isn't run in CI). Add it.
12. Product-specific naming (`hackiwi`, org "Noordkust", the eight security pillars, phishing-safety gates in `core/safety.ts` and `plan.ts`) is domain-bound — strip it; keep the _shape_ (entitlement/safety helpers as pure functions in `core`), not the content.
