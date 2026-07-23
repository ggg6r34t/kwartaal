# Kwartaal — production build plan

> The execution contract for building the full product end-to-end. This document is
> the prompt: read it fully, then execute pillar by pillar. Two companion inputs live
> in this repo and are binding:
>
> 1. `STACK-BLUEPRINT.md` — the audited engineering foundation from a sibling product
>    (Hackiwi). Its §11(a) "copy verbatim" list is the starter kit; its §11(b)
>    "do not inherit" list is a set of MANDATORY fixes, restated below as
>    non-negotiables. Where this plan and the blueprint conflict, this plan wins.
> 2. `docs/design/` — the Claude Design exports (marketing site + app: Today,
>    onboarding, VAT quarter flow, income tax studio, Money, Vault, glossary).
>    The designs are the spec: every screen, control, state, and term-chip becomes
>    real, working, persisted functionality with the visual design preserved 1:1.
> 3. `CLAUDE.md` — binding repo rules, including the styling architecture
>    (single-token-source theme.css + semantic Tailwind utilities + CI
>    token-discipline check). It deliberately overrides blueprint §9's
>    two-system styling split; Kwartaal is one token system for both surfaces.
>    The CI check ships in Pillar 1 alongside the other gates.
>
> Product: a calm tax companion for expat entrepreneurs in the Netherlands
> (eenmanszaak/ZZP first). Guides quarterly btw-aangifte, annual inkomstenbelasting,
> deductions, set-asides, records, and deadlines — in English, with Dutch tax
> vocabulary as first-class term-chips. Buyers: expat sole proprietors and small
> business owners in NL. Positioning: calm, honest, GDPR-native — and a
> COMPANION, not a replacement: Kwartaal is the guidance layer that works
> alongside whatever the user already invoices and books with (Moneybird,
> Declair, e-Boekhouden, a spreadsheet). It never competes on bookkeeping
> feature checklists; the marketing site, onboarding copy, and comparison
> content all frame "bring your numbers from anywhere, we make the tax part
> calm." No invoicing, no bank feeds, no double-entry ledger — ever framed as
> missing features; they are the point.
> Marketing claims "EU data residency / GDPR-native / privacy-first" — never
> "sovereign" (stack is Cloudflare; don't make falsifiable claims).

## Locked decisions

1. **Stack: Cloudflare-native, per STACK-BLUEPRINT.md.** Workers + Hono (`apps/api`),
   D1 + Drizzle (`packages/db`), Pages SPA with Vite + React 18 + Tailwind v3 +
   SSG prerender for public pages (`apps/web`), Better Auth (magic link + password,
   blueprint's closed signup inverted to OPEN self-serve signup — same inversion as
   Provata: flip `disableSignUp` on BOTH the password and magic-link paths, keep the
   anti-enumeration send gate), npm workspaces, strict TS base config copied verbatim.
   Same-origin Pages Function proxy copied as a pair with the Vite dev proxy, exactly
   as blueprint §9.
2. **New machinery this product actually builds (blueprint §7 warns Hackiwi never
   did):** Cloudflare **Cron Triggers** (deadline/reminder fan-out — the heartbeat of
   the product), **Queues** (reminder emails, export builds, retention cleanup),
   **R2** (receipt images, bookkeeper export zips, PDF summaries), **Browser
   Rendering** (`@cloudflare/puppeteer`) ONLY for print-to-PDF of handoff/annual
   summaries — no crawling in this product. Declare all bindings in `wrangler.toml`
   from day one, including an explicit `[env.production]` block (blueprint §11.8).
3. **The tax engine is pure functions in `packages/core`.** Zero I/O, zero Workers
   APIs: VAT quarter aggregation → rubriek 1a/1b/5b/5c, deduction waterfall
   (zelfstandigenaftrek → startersaftrek → MKB-winstvrijstelling), bracket
   calculation, Zvw, heffingskortingen, set-aside splitter, depreciation schedules,
   KOR rolling-turnover tracker, urencriterium progress. Every function takes a
   `TaxFigures` object as an argument — never a hardcoded rate (see §Tax figures).
4. **Golden fixtures = the Maya persona.** The demo persona's numbers are the
   engine's golden tests AND the deterministic seed, so tests, seed, and design
   mockups can never drift apart: turnover €72.000, costs €9.500, profit €62.500 →
   zelfstandigenaftrek €1.200 → €61.300 → startersaftrek €2.123 (used 1 of 3) →
   €59.177 → MKB 12,7% → taxable ±€51.660. Q3: btw received €4.140 (rubriek 1a),
   voorbelasting €610 (5b), owed €3.530 (5c). Seed state: mid-October, Q1+Q2
   `paid`, Q3 due in 12 days, Q4 + annual return future.
5. **Billing: Stripe Checkout + Customer Portal + Stripe Tax** (we dogfood the same
   EU VAT machinery we explain). Tiers: Free (tax calendar, reminders, set-aside
   calculator, glossary), Pro €12/mo (full VAT checklists, income tax studio, Money
   pots, Vault with receipt capture, exports), annual = 2 months free. Pricing
   presentation is ANNUAL-FIRST: the headline price is "€10/mo, billed yearly
   (€120)" with €12 monthly as the flexible option — never lead with €12. Combined
   with the deductibility line, the pricing page may state the effective cost
   honestly ("deductible, btw reclaimable — most ZZP'ers effectively pay around
   €6–7/mo") but must show the arithmetic, never just the headline claim.
   Single-user orgs are the norm; Pro includes one bookkeeper seat (read-only
   role).
   **First quarter free (event-boxed trial):** every new org gets full Pro access
   until it closes its first quarter (both `filed` and `paid` marked → drawer
   closed). No card upfront, no time limit — the trial ends on the event, not a
   date, so the user always experiences one complete VAT loop before the gate
   drops at the start of the next quarter. Only a quarter genuinely worked in
   Kwartaal counts: `firstQuarterClosedAt` is set by the filed+paid transition on
   an `in_progress` quarter, NEVER by marking past quarters `handled_elsewhere`
   at onboarding — a mid-year signup keeps a full trial. Modelled as `BusinessProfile.
firstQuarterClosedAt` (set once, never cleared); the entitlement helper is
   `hasProAccess(org) = activeSubscription || firstQuarterClosedAt == null`.
   Data entered during the trial is retained and read-only behind the gate,
   never deleted — the gate blocks new work, not access to your own records.
   **Deductibility framing:** the pricing page and Stripe receipt emails state
   that Kwartaal is a deductible business expense and its btw is reclaimable as
   voorbelasting (rubriek 5b) — marketing, education, and dogfooding in one line.
6. **Email: Resend** — copy the blueprint's dev-logs/prod-sends + anti-enumeration
   patterns (§8) verbatim. Transactional: magic links, deadline reminders
   (T-14/T-7/T-2/day-of/overdue), "quarter closed" confirmations, billing receipts
   (Stripe sends its own). Reminder emails are product surface — their copy comes
   from `docs/design/`, not boilerplate.
7. **Honest-guidance constraint (product-wide):** Kwartaal guides, estimates, and
   reminds. It NEVER files, never claims the user "is compliant," never renders a
   verdict. Every computed total carries the "Figures: tax year 2026" tag and the
   estimate framing; every flow ends in an explicit handoff to Mijn Belastingdienst
   (DigiD) or the user's bookkeeper. The word "advice" does not appear in the UI;
   legal pages state plainly this is not tax advice (belastingadvies).
8. **Language stance:** English UI; Dutch tax terms rendered via the term-chip
   component everywhere they appear, backed by a seeded glossary. Dutch number
   formatting throughout (€1.234,56); inputs tolerate both comma and period decimal
   separators and normalize on parse (money is integer cents in the DB — blueprint
   §6 basis-points convention, applied as cents).
9. **Out of scope for v1:** bank/PSD2 integration (Money pots are a manual
   discipline layer), actual filing (no Digipoort), BV/NV corporate tax (onboarding
   branch explains + exits gracefully), ICP declaration (flag-for-bookkeeper only),
   multi-client bookkeeper portal, native mobile apps (responsive web; Vault capture
   is mobile-web), NL/other UI languages (designed language switcher visible,
   "NL coming soon"), OCR on receipts (photo + manual six-element checklist in v1).
10. **Speed is a strategic constraint, not a preference.** The guidance-layer gap
    is real but thin: the nearest English-first competitor (Declair, invoicing)
    is one roadmap decision from adding a tax layer, and the proven maximal
    model (Accountable, BE/DE) is one market-entry from arriving with capital.
    Therefore: no scope additions during the build. Anything not in this plan
    goes to the v1.1 list, however good the idea — the out-of-scope list in
    decision #9 is a commitment, and the launch date beats every feature on it.

## Architecture non-negotiables

These incorporate every blueprint §11(b) fix. They are gate criteria, not suggestions.

- **Tenant guard is the ONLY data path** (fixes §11.1). Copy the `TenantDb`/`forOrg`
  design from blueprint §4, then: `requireSession` hands route handlers a `TenantDb`
  bound to the session org; the raw `Database` is never exported to route code;
  `.global` is the sole greppable escape hatch (health checks, Better Auth adapter,
  cron fan-out, TaxFigures/Glossary reads). The tenant-table-registry test comes too,
  and the ESLint restriction rule from Provata: no raw `Database` import in any route
  module. This is financial data — isolation failures are existential.
- **Zod on every route** (fixes §11.2): `@hono/zod-validator` for params/query/body
  of every endpoint; response schemas defined alongside. Money fields validate as
  integer cents; dates as ISO strings at the boundary.
- **Shared API contract** (fixes §11.3): request/response schemas live in
  `packages/core` and both API and web import them. No hand-duplicated body shapes.
  The tax engine's input/output types are part of this contract — the web app calls
  the same pure functions for instant client-side previews (set-aside calculator,
  waterfall) and treats the API's persisted result as authoritative.
- **Multi-tenancy model:** `orgs` → everything. One org = one business. Roles:
  Owner / Bookkeeper (read + export, no mutations) via the blueprint's `roleAtLeast`
  (copy verbatim, re-rank to two roles). Server-side checks on every mutation;
  frontend only decides rendering.
- **Security baseline:** blueprint middleware chain order preserved
  (`secureHeaders → cors → withDb → rateLimit → csrfGuard → requireSession →
requireRole`). CORS locked to the app origin, not `cors()` bare (fixes §11.9).
  Rate limiting is NOT auth-only (fixes §11.7): limit auth (20/60s per blueprint),
  the public set-aside/bracket calculator endpoints on the marketing site (per-IP
  fixed-window + daily cap), and receipt upload (per-org daily cap + max file size
  8 MB, content-type allow-list: jpeg/png/webp/pdf). Encrypted secrets store (copy
  `crypto.ts`) for the Stripe webhook secret.
- **Timestamps:** integer epoch (`{ mode: "timestamp" }`) for ALL app tables — align
  with Better Auth's convention instead of coexisting text-ISO (fixes §11.5), and
  maintain `updatedAt` via Drizzle `$onUpdate` everywhere (fixes §11.6). Tax-domain
  dates that are calendar dates, not instants (deadline date, invoice date, tax
  year) are stored as `text` ISO `YYYY-MM-DD` — document this split in the schema
  banner so the two conventions never blur.
- **Observability** (fixes §11.7): request-id middleware on every request, structured
  JSON access + error logs including request-id and org-id, Sentry (or Tail Worker →
  Logpush if unavailable on plan) wired in Pillar 1, audit log writing `ip` and
  `meta` (fixing the blueprint's unpopulated columns), health + readiness endpoints
  copied from blueprint §10. Audit every filing-status change and every export —
  these are the events a user will ask about ("did I mark Q2 as paid?").
- **CI** (fixes §11.11): blueprint's verify job + ESLint/Prettier gates +
  `wrangler deploy --dry-run` on the API + Playwright e2e stage (Pillar 6). Explicit
  staging/production deploy remains manual-on-green.
- **Async rule:** no email sends or export builds in a request handler. Cron Trigger
  (hourly) computes due reminders → enqueues typed messages → queue consumer sends
  via Resend, with idempotency via a `reminder_log` ledger (one row per
  org+deadline+stage, unique-indexed) so a cron replay can never double-send.
  Export-zip builds likewise queued, status-polled, delivered from R2 via
  short-lived signed access.
- **Degraded modes:** Resend unconfigured → dev-logs pattern (blueprint §8); Stripe
  webhook lag → optimistic UI + reconciliation; a queue outage must never lose a
  deadline — the Today screen always renders deadlines computed live from the
  engine, with reminders as a bonus layer on top; CSV import rejects with row-level
  errors, never a partial silent import.
- **Privacy & data lifecycle (this product's equivalent of scan ethics):** GDPR-native
  for real: data minimization (no BSN, no DigiD credentials, ever — validate and
  refuse if a user tries to store them in free-text where detectable), full
  export-everything-as-zip (the user's own 7-year retention obligation — receipts +
  a machine-readable JSON/CSV of all records), account deletion = hard cascade
  delete with a 30-day grace export prompt, R2 objects deleted with their rows,
  cookie-less analytics (Plausible or none — no consent banner), DPA available,
  processors listed (Cloudflare, Stripe, Resend, Sentry).
- **Backups & recovery (financial records demand it):** rely on D1 Time Travel for
  point-in-time DB recovery, but verify its current retention window against
  Cloudflare docs in Pillar 1 and ADD a weekly cron-driven logical export
  (SQL dump per org-independent snapshot) to a separate R2 bucket, 8 weekly
  retained. R2 receipt objects are immutable-once-written in app code (no
  overwrite path exists), and the restore procedure — DB snapshot + R2 bucket —
  is written into the deploy runbook and rehearsed once against staging before
  launch. A tax product that loses a receipt has no second chance.
- **Tax figures as versioned data, never constants:** a global `TaxFigures` registry
  (the RuleCatalog analog): one row per tax year holding brackets, rates,
  deduction amounts, KOR limit, Zvw rate, credit maxima — seeded for 2026 with the
  brief's verbatim numbers, org-invisible, additive-only (a new tax year is a new
  row + a reviewed PR; historic years never mutate, so past estimates remain
  reproducible). Every engine call and every rendered total binds to a named tax
  year. The "Figures: tax year 2026" UI tag reads from this registry.
- **Self-accessibility:** the product ships WCAG 2.2 AA — keyboard navigable
  (both the VAT checklist and the annual studio fully completable by keyboard),
  visible focus, 4.5:1 contrast, deadline states always icon+label+color,
  term-chips operable and correctly announced by screen readers, reduced-motion
  variant of the drawer-close moment. Run Provata against Kwartaal's marketing site
  in CI as a smoke test; the build fails on new critical issues. (Sibling products
  auditing each other is both QA and the best marketing line either has.)

## Feature inventory (confirmed against `docs/design/`)

**Marketing site (public, SSG-prerendered):** Home (hero: the year timeline as a
live-looking demo + set-aside calculator teaser), Pricing (Free/Pro, annual toggle,
VAT-inclusive display), How it works (the mid-October Maya walkthrough), Expat tax
guide (editorial: btw, KOR, deductions, deadlines — the KVK-derived content),
About/Contact, plus Privacy/Terms/DPA/Impressum and the not-tax-advice statement.

**App (`/app/*`):** **Today** (next-deadline hero card, the year timeline with
drawer states, set-aside-so-far figure with "not your money" treatment; states:
empty/mid-quarter/due-soon/overdue-recovery) · **Onboarding** (5-step Entrepreneur
Check: legal form with the BV graceful exit, entrepreneur-for-btw vs -for-income-tax
two-lane explainer, turnover → KOR decision card with live app-preview toggle,
salaried-job question, start date + start-up costs; output: personalized tax
calendar) · **VAT quarter flow** (income lines with 21/9/0%/exempt per line →
expense lines with voorbelasting → the mirror screen with the "why" expander →
handoff card with real rubriek numbering 1a/1b/5b/5c and separate "I filed it" /
"I paid it" acts → drawer close; KOR variant: serene no-filing screen + rolling
€20.000 progress bar) · **Income tax studio** (profit builder waterfall → deduction
stack cards with urencriterium ring fed by Vault hours and the startersaftrek
1-of-3 tracker → bracket vessels + Zvw layer + credits → one set-aside number →
handoff checklist incl. DigiD/eHerkenning note, extension path, bookkeeper summary
export) · **Money** (per-invoice set-aside calculator with the three-band split,
pots overview with manual monthly review ritual, voorlopige aanslag decision card +
payment schedule tracker) · **Vault** (receipt capture with the six-element
checklist overlay, start-up costs corner with the €450 deduct-vs-depreciate rule +
depreciation schedule visual + reclaimed-btw question + "would you have bought it
anyway?" micro-moment, hours log feeding the urencriterium, km log as stub row,
search/year filters, export-zip) · **Glossary** (browsable screen, 6–8 deep entries

- stubs; the term-chip pattern app-wide) · **Settings** (profile/KOR status,
  reminder channels + cadence, bookkeeper seat invite, plan/invoices via Stripe
  Portal, data export, account deletion).

## Data model (tenant-scoped unless noted; extends blueprint §6 conventions)

Org, User(role, authUserId), BusinessProfile (legalForm, kvkRegisteredAt,
korOptIn + korSince, hasSalariedJob, startersaftrekUsedCount, defaultSetAsideRate),
TaxYearProfile (year, taxFiguresYear FK, hoursTarget default 1225),
Quarter (year, q, status: open|in_progress|filed|paid|handled_elsewhere,
filedAt?, paidAt?, rubriek1aCents, rubriek1bCents, rubriek5bCents,
rubriek5cCents — engine-computed,
persisted at close), IncomeLine (date, description, amountExVatCents, vatRate:
21|9|0|exempt, vatCents, quarterId, source: manual|import, importSource?: moneybird|declair|eboekhouden|generic_csv),
ExpenseLine (date,
supplier, amountExVatCents, vatCents, vatReclaimable, isStartupCost,
deductionMode: expense|depreciate, receiptId?), DepreciationSchedule (expenseLineId,
years, residualCents, annualCents, startMonth), Receipt (r2Key, capturedAt,
checklist: json of the six elements with per-element confirmed flags, missingCount),
HoursEntry (date, hours, note), KmEntry (stub table: date, km, purpose),
Pot (name, targetCents, currentCents, kind: business|private),
SetAsideEntry (invoiceRef, totalCents, vatCents, reserveCents, rate),
VoorlopigeAanslag (year, monthlyCents, startMonth, active),
Deadline (kind: btw_q|income_tax|voorlopige_aanslag|custom, dueDate text ISO,
quarterId?, dismissedAt?), ReminderLog (deadlineId, stage: t14|t7|t2|day|overdue,
sentAt — unique(orgId, deadlineId, stage)), Subscription (stripeCustomerId,
stripeSubId, plan, status, currentPeriodEnd), ExportJob (status ledger, r2Key?,
requestedBy), AuditLog (with ip/meta), RateLimits, Secrets, Notification.
Global (org_id nullable, org-invisible): TaxFigures (year, bracketsJson,
zelfstandigenaftrekCents, startersaftrekCents, mkbVrijstellingBps, zvwBps,
korLimitCents, algemeneHeffingskortingMaxCents, arbeidskortingTableJson),
GlossaryTerm (slug, nlTerm, enGloss, plainExplanation, whereYoullSeeIt, depth:
full|stub).

## Tax + deadline engine (Pillar 2 — the product)

All computation in `packages/core/src/tax/` as pure, exhaustively-tested functions;
the API persists results, the web app reuses the same functions for live previews.

1. **VAT quarter:** `computeQuarter(incomeLines, expenseLines, figures)` →
   `{ rubriek1a, rubriek1b, rubriek5b, rubriek5c, perLineVat }`. Handles 21/9/0%
   and exempt lines (exempt contributes to neither VAT nor voorbelasting), rounds
   per Belastingdienst convention (document in `docs/rounding.md`), never floats —
   integer cents end to end.
2. **KOR:** `korRollingTurnover(incomeLines, window)` → progress vs the
   figures-registry limit; crossing 80% raises a Notification; crossing 100%
   flips the app's guidance ("the KOR no longer applies — here's what changes").
3. **Deduction waterfall:** `computeWaterfall(profit, profile, hours, figures)` →
   ordered steps with per-step eligibility (urencriterium gate on
   zelfstandigenaftrek; startersaftrek gated on used-count < 3 within first 5
   years), each step returning `{ label, amountCents, runningTotalCents,
eligible, reason? }` — the studio renders this array directly.
4. **Brackets + Zvw + credits:** `estimateIncomeTax(taxable, profile, figures)` →
   per-bracket fill amounts (the vessels visual renders this), Zvw layer, credit
   reductions, one `setAsideCents` total. The salaried-job merge view is v1-visible
   only as the onboarding explainer (persona has no salaried job); the engine
   signature accepts `payrollWithheldCents` so the merge view is a data change,
   not a redesign.
5. **Set-aside splitter:** `splitInvoice(totalCents, vatRate, reserveRate)` →
   the three-band `{ yours, vat, reserve }` — used by the public calculator, the
   Money screen, and the per-invoice toast.
6. **Depreciation:** `buildDepreciationSchedule(costCents, years, residualCents,
startMonth)` — max 20%/year rule, partial first year by remaining months.
7. **Deadline computation:** `deadlinesForYear(profile, year)` → btw quarters
   (30 Apr / 31 Jul / 31 Oct / 31 Jan next year), income tax (1 May), voorlopige
   aanslag monthly dates when active; KOR orgs get no btw deadlines. All deadline
   arithmetic is Europe/Amsterdam calendar-date math — reminder stages compute
   "days until due" in Amsterdam time, never UTC (with an hourly cron the DST
   off-by-one bug is otherwise inevitable). Year rollover is a first-class,
   tested state: Q4 belongs to the old year but is due 31 Jan of the new one,
   and a new year whose TaxFigures row isn't seeded yet degrades gracefully —
   calendar and btw flows keep working (VAT rates ride on the lines, not the
   registry) while the annual studio for that year shows a designed "figures
   pending" state instead of silently reusing last year's numbers. Pure — Today
   renders from this live; the Cron layer materializes `Deadline` rows and drives
   `ReminderLog` so reminders survive profile edits idempotently.

Cron Trigger (hourly): upsert Deadline rows from the engine for every active org
(`.global` fan-out) → select due reminder stages not in ReminderLog → enqueue typed
messages → consumer sends email, writes ReminderLog. Overdue stage repeats weekly,
max 3, always linking the overdue-recovery flow, never a shame line.

## Build order (pillars; gate each before the next)

Each pillar: matching design screens pixel-faithful AND fully live (no dead
controls, no fake numbers) before the next pillar starts. Commit per pillar.
Parallel agents may port independent screens within a pillar.

1. **Foundations** — monorepo per blueprint §1 (copy tsconfig base, package layout,
   scripts, CI); wrangler.toml with dev/staging/**production** and ALL bindings
   (D1, R2, Queues, Cron, Browser Rendering); schema + migrations; TenantDb-only
   data layer + registry test + ESLint restriction rule; Better Auth with OPEN
   self-serve signup (org + BusinessProfile shell auto-created on signup); RBAC
   (Owner/Bookkeeper); Zod everywhere; shared contracts + the tax engine's types in
   core; request-id + logging + Sentry; rate limiters (auth + public calculator +
   uploads); secrets store; audit log (with ip/meta); health endpoints; same-origin
   proxy pair; app shell + nav + term-chip component + state switcher ported 1:1
   from designs; `theme.css` token file + tailwind.config.js semantic mappings +
   the CI token-discipline check per CLAUDE.md (in place BEFORE the first
   component is styled); TaxFigures 2026 + GlossaryTerm seed; deterministic Maya demo seed
   reproducing the mid-October Today screen exactly (blueprint §6 seed strategy:
   deterministic demo seed vs non-deterministic bootstrap, both).
2. **Tax engine** — everything in the section above as pure functions with golden
   tests pinned to the Maya fixtures (a snapshot test asserts the exact waterfall:
   62.500 → 61.300 → 59.177 → ±51.660, and Q3: 4.140/610/3.530); rounding doc;
   property tests (splitter bands always sum to total; waterfall never negative;
   exempt lines contribute zero VAT); public set-aside calculator endpoint + the
   marketing-hero preview wired to the same functions.
3. **VAT cycle + reminders** — onboarding flow live end to end (including the KOR
   preview toggle and BV graceful exit, plus the mid-year signup step: past
   quarters of the current year are shown and marked `handled_elsewhere` by
   default — rendered as quiet neutral drawers on the timeline, excluded from
   reminders and overdue states, reopenable if the user wants to log them in
   Kwartaal; a new user must NEVER land on a Today screen showing overdue
   quarters they never owed us); income/expense line entry + CSV import built as
   an **import adapter registry**: recognized export layouts for Moneybird,
   Declair, and e-Boekhouden (auto-detected by header signature, mapped to
   IncomeLine/ExpenseLine with per-adapter golden-fixture tests against real
   sample exports collected in `docs/import-formats/`) plus a generic CSV path
   with a manual column-mapping step; every import is previewed before commit
   and rejects with row-level errors, never a partial silent import; adapters
   are data + a mapping function, so adding a tool is a PR, not a feature;
   the full Q3 flow: mirror screen, rubriek handoff card,
   filed/paid as two acts, drawer-close (with reduced-motion variant); KOR variant
   screens; Deadline materialization + Cron + Queues + ReminderLog + all five
   reminder-stage emails with designed copy; overdue-recovery flow; Today screen
   fully live in all four states via real data (state switcher retained as a
   dev-only tool behind a flag).
4. **Annual studio + Money + Vault** — income tax studio live against the engine
   (waterfall cards, urencriterium ring from HoursEntry, startersaftrek tracker,
   bracket vessels, bookkeeper summary as print-to-PDF via Browser Rendering → R2);
   Money (splitter, pots CRUD + monthly review prompt Notification, voorlopige
   aanslag card + schedule); Vault (mobile-web receipt capture → R2, six-element
   checklist with missing-element flags, start-up costs corner incl. the €450
   branch + DepreciationSchedule + reclaimed-btw question, hours log, km stub,
   search/filters, export-zip via ExportJob queue).
5. **Billing + marketing site** — Stripe products/prices (monthly+annual), Checkout,
   Customer Portal, Stripe Tax config, webhook handler (signature-verified,
   idempotent, secrets-store key), entitlement enforcement as pure core helpers at
   the feature gates (Free: calendar/reminders/calculator/glossary; Pro: the rest;
   `hasProAccess` implements the first-quarter-free event-boxed trial per locked
   decision #5 — trial ends when the first drawer closes, trial-entered data
   becomes read-only behind the gate, never deleted); the paywall interstitial
   from `docs/design/` shown at the start of the second quarter; bookkeeper seat
   invite (magic link, role=bookkeeper, mutation-blocked server-side); all public
   pages with SSG prerender, sitemap + OG images (copy blueprint scripts), pricing
   wired to live price ids ("first quarter free, no card" + the deductibility/
   voorbelasting-rubriek-5b line on the pricing page and in Stripe receipt email
   copy), expat tax guide content, a "Kwartaal + your bookkeeping tool" page
   executing the companion positioning: explains the division of labor
   (invoicing/ledger there, understanding/deadlines/estimates here), documents
   the supported import formats, and answers the two predictable objections in
   plain words — "do I still need Moneybird/Declair?" (yes, different job) and
   "why pay when e-Boekhouden is free for starters?" (different category: that's
   bookkeeping software in Dutch, this is the layer that teaches you what the
   numbers mean and never lets you miss a deadline). NEVER ship feature-matrix
   comparison pages against bookkeeping tools — that's their turf and a fight
   the positioning is designed to avoid. Legal pages incl. not-tax-advice
   statement, cookie-less analytics.
6. **Hardening & launch** — Playwright e2e for the three primary flows
   (signup → onboarding → Pro gates open on trial → enter Q3 lines → mirror →
   mark filed+paid → drawer closed + Today updates → gates drop at next quarter,
   trial data readable but read-only → subscribe → gates reopen and mutations
   work; receipt capture → vault → export-zip contains it; reminder email fires
   for a seeded T-7 deadline [time-travel clock, also used to cross the quarter
   boundary in flow one]); a year-rollover test (time-travel to January: Q4 due
   31 Jan renders correctly, missing next-year TaxFigures shows the pending
   state, no reminder fires at the wrong Amsterdam hour across the DST change);
   backup restore rehearsed once against staging per the runbook; engine golden
   tests green as a release gate; Provata
   self-scan smoke test on the marketing site (0 critical); reminder idempotency
   test (double cron run, single email); security pass (headers, authz probing
   between two seeded orgs, bookkeeper-role mutation probe, webhook forgery,
   upload content-type bypass attempt); load pass on the reminder fan-out (1.000
   orgs, one cron tick); README + env docs + deploy runbook + `docs/rounding.md` +
   `docs/tax-figures.md` (the yearly-update procedure); staging → production
   cutover: custom domain, live Stripe keys + webhook, Resend domain verified
   (SPF/DKIM), Sentry DSN, TaxFigures 2026 seeded, uptime monitor on
   `/health/ready`, cron verified firing in production.

## Definition of done

Every screen and control from `docs/design/` live, wired, persisted; zero
placeholders/dead controls; the demo login reproduces the mid-October Maya state
byte-identical to the design export. Tenant isolation proven by a test running real
requests as two orgs asserting zero crossover, plus the TenantDb-only invariant
enforced by ESLint and the table-registry test. Engine golden tests pin the Maya
waterfall and Q3 rubriek numbers exactly; any tax-figure change requires a new
TaxFigures year row, never an edit. All three e2e flows green in CI. A fresh clone
boots with documented commands to a seeded local instance. Reminders proven
idempotent under cron replay; no reminder ever sent twice for one
(org, deadline, stage). Stripe test-mode round-trip (subscribe → upgrade → cancel →
downgrade at period end) verified; entitlements enforced server-side, and the trial
lifecycle proven by test: full Pro access pre-first-drawer with no card, gate drops
exactly once at `firstQuarterClosedAt`, trial data remains readable and exportable
but immutable behind the gate, and no code path ever deletes trial data on expiry. Bookkeeper
role can read and export, and every mutation attempt returns 403 by test. Export-zip
contains every receipt object plus machine-readable JSON/CSV of all records;
account deletion cascades D1 rows and R2 objects by test. Production env block
deployed, `wrangler tail` shows structured request logs with request-id and org-id,
Sentry receives a thrown test error. The marketing site scores 0 critical issues in
Provata. The token-discipline check passes with zero unexplained exceptions —
no raw color value or var()-arbitrary class exists outside theme.css. Nowhere
in the product does the word "compliant" appear as a verdict, and
every computed total renders its tax-year tag.
