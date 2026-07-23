import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { authUser } from "./auth-schema";

/**
 * Timestamp convention (two conventions coexist by necessity — see
 * STACK-BLUEPRINT §6 and KWARTAAL-BUILD-PLAN "Architecture non-negotiables"):
 *
 *   - INSTANTS (createdAt, updatedAt, filedAt, paidAt, sentAt, capturedAt,
 *     dismissedAt, firstQuarterClosedAt, currentPeriodEnd, readAt): integer
 *     epoch via { mode: "timestamp" }, aligned with Better Auth's own
 *     convention. `updatedAt` is maintained on every app table via Drizzle
 *     `$onUpdate` (fixes blueprint §11.6 — never left to a default-only
 *     column).
 *   - CALENDAR DATES that are days, not instants (deadline due date,
 *     invoice/expense line date, hours/km entry date, KVK registration
 *     date, KOR opt-in date): `text` ISO `YYYY-MM-DD`. These are Europe/
 *     Amsterdam calendar concepts (a due date is due on a *day*, not a
 *     UTC instant), and mixing the two conventions on the same kind of
 *     field is exactly the bug class this split exists to avoid.
 *
 * Money is integer cents everywhere (never float). Rates that aren't money
 * are integer basis points (bps). IDs are prefixed UUIDs from
 * @kwartaal/core's newId(). No soft deletes — lifecycle is a `status`
 * column; deletion is real, via onDelete: "cascade" FKs from org_id down.
 */

function instant(name: string) {
  return integer(name, { mode: "timestamp" });
}

function timestamps() {
  return {
    createdAt: instant("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: instant("updated_at")
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  };
}

// ─── Tenant root ─────────────────────────────────────────────────────────
// Org is the tenant itself — it has no org_id column and is therefore NOT
// a TenantDb table; it's read/written via `.global` (see tenant.ts).

export const orgs = sqliteTable("orgs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ...timestamps(),
});

// ─── App membership + RBAC (linked to Better Auth's `user` via authUserId) ─

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    authUserId: text("auth_user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    // role: "owner" | "bookkeeper"
    role: text("role").notNull().default("owner"),
    // status: "active" | "invited" | "suspended"
    status: text("status").notNull().default("active"),
    ...timestamps(),
  },
  (t) => [
    index("users_org_idx").on(t.orgId),
    uniqueIndex("users_auth_user_idx").on(t.authUserId),
  ],
);

// ─── Business profile & tax year ────────────────────────────────────────

export const businessProfiles = sqliteTable(
  "business_profiles",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    // legalForm: "eenmanszaak" | "vof" | "bv" | "other"
    legalForm: text("legal_form").notNull(),
    kvkRegisteredAt: text("kvk_registered_at"), // ISO YYYY-MM-DD, nullable
    korOptIn: integer("kor_opt_in", { mode: "boolean" }).notNull().default(false),
    korSince: text("kor_since"), // ISO YYYY-MM-DD, nullable
    hasSalariedJob: integer("has_salaried_job", { mode: "boolean" })
      .notNull()
      .default(false),
    startersaftrekUsedCount: integer("startersaftrek_used_count").notNull().default(0),
    defaultSetAsideRateBps: integer("default_set_aside_rate_bps").notNull().default(3000),
    // reminderCadence: "calm" (email, T-14/T-2) | "persistent" (email, T-14/T-7/day-of/weekly-overdue)
    // Onboarding step 4's choice. Both cadences ride the same 5 defined
    // ReminderLog stages (t14|t7|t2|day|overdue) — cadence selects a subset,
    // it doesn't add new stages. No push channel yet (no infra for it); the
    // design's "email + push" is aspirational, see PROGRESS.md.
    reminderCadence: text("reminder_cadence").notNull().default("persistent"),
    // Set once by POST /onboarding/complete. null = the app should route to
    // the onboarding wizard instead of Today. Distinct from
    // kvkRegisteredAt (which can itself be null for "registered earlier,
    // exact year not tracked") so onboarding-complete has one unambiguous signal.
    onboardedAt: instant("onboarded_at"),
    // Set once by the filed+paid transition on an in_progress quarter,
    // NEVER cleared. null = trial still open (locked decision #5).
    firstQuarterClosedAt: instant("first_quarter_closed_at"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("business_profiles_org_idx").on(t.orgId)],
);

export const taxYearProfiles = sqliteTable(
  "tax_year_profiles",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    taxFiguresYear: integer("tax_figures_year")
      .notNull()
      .references(() => taxFigures.year),
    hoursTarget: integer("hours_target").notNull().default(1225),
    ...timestamps(),
  },
  (t) => [
    index("tax_year_profiles_org_idx").on(t.orgId),
    uniqueIndex("tax_year_profiles_org_year_idx").on(t.orgId, t.year),
  ],
);

// ─── Quarters (the year timeline) ───────────────────────────────────────

export const quarters = sqliteTable(
  "quarters",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    q: integer("q").notNull(), // 1..4
    // status: "open" | "in_progress" | "filed" | "paid" | "handled_elsewhere"
    status: text("status").notNull().default("open"),
    filedAt: instant("filed_at"),
    paidAt: instant("paid_at"),
    rubriek1aCents: integer("rubriek_1a_cents"),
    rubriek1bCents: integer("rubriek_1b_cents"),
    rubriek5bCents: integer("rubriek_5b_cents"),
    rubriek5cCents: integer("rubriek_5c_cents"),
    ...timestamps(),
  },
  (t) => [
    index("quarters_org_idx").on(t.orgId),
    uniqueIndex("quarters_org_year_q_idx").on(t.orgId, t.year, t.q),
  ],
);

// ─── Income / expense lines ──────────────────────────────────────────────

export const incomeLines = sqliteTable(
  "income_lines",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    quarterId: text("quarter_id")
      .notNull()
      .references(() => quarters.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    description: text("description").notNull(),
    amountExVatCents: integer("amount_ex_vat_cents").notNull(),
    // vatRate: "21" | "9" | "0" | "exempt"
    vatRate: text("vat_rate").notNull(),
    vatCents: integer("vat_cents").notNull(),
    // source: "manual" | "import"
    source: text("source").notNull().default("manual"),
    // importSource: "moneybird" | "declair" | "eboekhouden" | "generic_csv"
    importSource: text("import_source"),
    ...timestamps(),
  },
  (t) => [
    index("income_lines_org_idx").on(t.orgId),
    index("income_lines_quarter_idx").on(t.quarterId),
  ],
);

export const expenseLines = sqliteTable(
  "expense_lines",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    quarterId: text("quarter_id")
      .notNull()
      .references(() => quarters.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    supplier: text("supplier").notNull(),
    amountExVatCents: integer("amount_ex_vat_cents").notNull(),
    vatRate: text("vat_rate").notNull(),
    vatCents: integer("vat_cents").notNull(),
    vatReclaimable: integer("vat_reclaimable", { mode: "boolean" })
      .notNull()
      .default(true),
    isStartupCost: integer("is_startup_cost", { mode: "boolean" })
      .notNull()
      .default(false),
    // deductionMode: "expense" | "depreciate"
    deductionMode: text("deduction_mode").notNull().default("expense"),
    receiptId: text("receipt_id").references(() => receipts.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    index("expense_lines_org_idx").on(t.orgId),
    index("expense_lines_quarter_idx").on(t.quarterId),
  ],
);

export const depreciationSchedules = sqliteTable(
  "depreciation_schedules",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    expenseLineId: text("expense_line_id")
      .notNull()
      .references(() => expenseLines.id, { onDelete: "cascade" }),
    years: integer("years").notNull(),
    residualCents: integer("residual_cents").notNull().default(0),
    annualCents: integer("annual_cents").notNull(),
    startMonth: integer("start_month").notNull(), // 1..12
    ...timestamps(),
  },
  (t) => [
    index("depreciation_schedules_org_idx").on(t.orgId),
    uniqueIndex("depreciation_schedules_expense_line_idx").on(t.expenseLineId),
  ],
);

// ─── Vault ───────────────────────────────────────────────────────────────

export const receipts = sqliteTable(
  "receipts",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    capturedAt: instant("captured_at")
      .notNull()
      .$defaultFn(() => new Date()),
    // checklist: six-element JSON, { element: { confirmed: boolean } }
    checklist: text("checklist", { mode: "json" }).$type<
      Record<string, { confirmed: boolean }>
    >(),
    missingCount: integer("missing_count").notNull().default(6),
    ...timestamps(),
  },
  (t) => [index("receipts_org_idx").on(t.orgId)],
);

export const hoursEntries = sqliteTable(
  "hours_entries",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    hours: integer("hours").notNull(), // minutes would over-precision this; whole hours per design
    note: text("note"),
    ...timestamps(),
  },
  (t) => [index("hours_entries_org_idx").on(t.orgId)],
);

/** Stub table (v1: km log as stub row per locked decision #9 — no OCR, minimal fields). */
export const kmEntries = sqliteTable(
  "km_entries",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // ISO YYYY-MM-DD
    km: integer("km").notNull(),
    purpose: text("purpose"),
    ...timestamps(),
  },
  (t) => [index("km_entries_org_idx").on(t.orgId)],
);

// ─── Money ───────────────────────────────────────────────────────────────

export const pots = sqliteTable(
  "pots",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetCents: integer("target_cents").notNull().default(0),
    currentCents: integer("current_cents").notNull().default(0),
    // kind: "business" | "private"
    kind: text("kind").notNull().default("business"),
    ...timestamps(),
  },
  (t) => [index("pots_org_idx").on(t.orgId)],
);

export const setAsideEntries = sqliteTable(
  "set_aside_entries",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    invoiceRef: text("invoice_ref").notNull(),
    totalCents: integer("total_cents").notNull(),
    vatCents: integer("vat_cents").notNull(),
    reserveCents: integer("reserve_cents").notNull(),
    rateBps: integer("rate_bps").notNull(),
    ...timestamps(),
  },
  (t) => [index("set_aside_entries_org_idx").on(t.orgId)],
);

export const voorlopigeAanslagen = sqliteTable(
  "voorlopige_aanslagen",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    monthlyCents: integer("monthly_cents").notNull(),
    startMonth: integer("start_month").notNull(), // 1..12
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    index("voorlopige_aanslagen_org_idx").on(t.orgId),
    uniqueIndex("voorlopige_aanslagen_org_year_idx").on(t.orgId, t.year),
  ],
);

// ─── Deadlines & reminders ───────────────────────────────────────────────

export const deadlines = sqliteTable(
  "deadlines",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    // kind: "btw_q" | "income_tax" | "voorlopige_aanslag" | "custom"
    kind: text("kind").notNull(),
    dueDate: text("due_date").notNull(), // ISO YYYY-MM-DD, Europe/Amsterdam
    quarterId: text("quarter_id").references(() => quarters.id, {
      onDelete: "cascade",
    }),
    dismissedAt: instant("dismissed_at"),
    ...timestamps(),
  },
  (t) => [
    index("deadlines_org_idx").on(t.orgId),
    index("deadlines_org_due_date_idx").on(t.orgId, t.dueDate),
  ],
);

export const reminderLogs = sqliteTable(
  "reminder_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    deadlineId: text("deadline_id")
      .notNull()
      .references(() => deadlines.id, { onDelete: "cascade" }),
    // stage: "t14" | "t7" | "t2" | "day" | "overdue"
    stage: text("stage").notNull(),
    sentAt: instant("sent_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("reminder_logs_org_idx").on(t.orgId),
    // Idempotency: a cron replay can never double-send for the same stage.
    uniqueIndex("reminder_logs_org_deadline_stage_idx").on(
      t.orgId,
      t.deadlineId,
      t.stage,
    ),
  ],
);

// ─── Billing ─────────────────────────────────────────────────────────────

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    stripeSubId: text("stripe_sub_id"),
    // plan: "free" | "pro"
    plan: text("plan").notNull().default("free"),
    // status: Stripe subscription status ("active" | "past_due" | "canceled" | ...)
    status: text("status").notNull().default("incomplete"),
    currentPeriodEnd: instant("current_period_end"),
    ...timestamps(),
  },
  (t) => [uniqueIndex("subscriptions_org_idx").on(t.orgId)],
);

// ─── Exports, audit, secrets, notifications ─────────────────────────────

export const exportJobs = sqliteTable(
  "export_jobs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    // status: "queued" | "running" | "completed" | "failed"
    status: text("status").notNull().default("queued"),
    r2Key: text("r2_key"),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (t) => [index("export_jobs_org_idx").on(t.orgId)],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    actor: text("actor")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(), // dotted verb, e.g. "quarter.filed"
    target: text("target"),
    ip: text("ip"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: instant("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("audit_logs_org_idx").on(t.orgId)],
);

export const secrets = sqliteTable(
  "secrets",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    integrationId: text("integration_id"),
    keyRef: text("key_ref").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    createdAt: instant("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("secrets_org_idx").on(t.orgId),
    uniqueIndex("secrets_org_integration_key_idx").on(t.orgId, t.integrationId, t.keyRef),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => orgs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    readAt: instant("read_at"),
    createdAt: instant("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("notifications_org_idx").on(t.orgId)],
);

// ─── Global, org-invisible tables (accessed only via TenantDb.global) ────

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: integer("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

export const taxFigures = sqliteTable("tax_figures", {
  year: integer("year").primaryKey(),
  bracketsJson: text("brackets_json", { mode: "json" })
    .$type<{ uptoCents: number | null; rateBps: number }[]>()
    .notNull(),
  zelfstandigenaftrekCents: integer("zelfstandigenaftrek_cents").notNull(),
  startersaftrekCents: integer("startersaftrek_cents").notNull(),
  mkbVrijstellingBps: integer("mkb_vrijstelling_bps").notNull(),
  zvwBps: integer("zvw_bps").notNull(),
  korLimitCents: integer("kor_limit_cents").notNull(),
  algemeneHeffingskortingMaxCents: integer(
    "algemene_heffingskorting_max_cents",
  ).notNull(),
  arbeidskortingTableJson: text("arbeidskorting_table_json", {
    mode: "json",
  })
    .$type<{ fromCents: number; toCents: number | null; rateBps: number }[]>()
    .notNull(),
});

export const glossaryTerms = sqliteTable("glossary_terms", {
  slug: text("slug").primaryKey(),
  nlTerm: text("nl_term").notNull(),
  enGloss: text("en_gloss").notNull(),
  plainExplanation: text("plain_explanation").notNull(),
  whereYoullSeeIt: text("where_youll_see_it").notNull(),
  // depth: "full" | "stub"
  depth: text("depth").notNull().default("stub"),
});

export const schema = {
  orgs,
  users,
  businessProfiles,
  taxYearProfiles,
  quarters,
  incomeLines,
  expenseLines,
  depreciationSchedules,
  receipts,
  hoursEntries,
  kmEntries,
  pots,
  setAsideEntries,
  voorlopigeAanslagen,
  deadlines,
  reminderLogs,
  subscriptions,
  exportJobs,
  auditLogs,
  secrets,
  notifications,
  rateLimits,
  taxFigures,
  glossaryTerms,
};
