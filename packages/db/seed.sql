-- Kwartaal deterministic demo seed — the Maya persona (locked decision #4).
-- Fixed ids + fixed dates so re-applying yields byte-identical state.
-- Never loaded into production. Apply via:
--   wrangler d1 execute kwartaal --local --file=packages/db/seed.sql
--
-- Demo login: maya@kwartaal-demo.example / kwartaal-demo-2026
-- (password hash below generated with better-auth/crypto's real hashPassword
-- — verified to round-trip against that password before being committed.)
--
-- Story: Maya registered at the KVK in January 2026, filed and paid Q1 and
-- Q2 on time, and is now mid-October with Q3 due 31 October — invoices and
-- receipts already logged, checklist not yet started (status: in_progress
-- because the lines exist; the drawer itself is still open). Q4 and the
-- annual return are untouched, future quarters.
--
-- Q3 numbers are the golden fixture (KWARTAAL-BUILD-PLAN.md locked decision
-- #4): income lines sum to €20.000,00 ex btw / €4.140,00 btw, split
-- rubriek 1a €4.095,00 (21% line) + 1b €45,00 (9% line); expense lines sum
-- to €610,00 reclaimable btw (rubriek 5b); 5c = 4140 - 610 = €3.530,00.
-- Q3's rubriek_*_cents stay NULL on the quarters row deliberately — those
-- are "engine-computed, persisted at close" per the schema banner, and Q3
-- hasn't closed yet in this story. Q1/Q2 are illustrative (not golden) but
-- internally consistent with their own lines.
--
-- The €72.000 turnover / €9.500 costs / €62.500 profit figures from locked
-- decision #4 are Maya's PROJECTED full-year figures (as entered at
-- onboarding and reused directly as Pillar 2's annual-waterfall golden
-- test input) — they are not the sum of these quarterly lines-to-date, and
-- are not asserted here. See PROGRESS.md.

-- ─── Org, auth identity, app membership ────────────────────────────────────

INSERT INTO orgs (id, name, created_at, updated_at) VALUES
  ('org_maya', 'Maya Lindqvist', unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00'));

INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at) VALUES
  ('authusr_maya', 'Maya Lindqvist', 'maya@kwartaal-demo.example', 1, NULL,
   unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00'));

-- Password: kwartaal-demo-2026 — hashed with better-auth/crypto's hashPassword
-- (node:crypto scrypt), verified to round-trip before commit.
INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES
  ('acct_maya_password', 'authusr_maya', 'credential', 'authusr_maya',
   '543f5820a6e6d39125693d204c815efa:a1f20faa1c6ac0a27e9f8d723d94db6ab35e75b9e01e3ca06dcc083e86dc4b16e61d401ed54e63139ac483997ad0bbdb65cd2d3b014c4c48a5a0d62ffe279625',
   unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00'));

INSERT INTO users (id, org_id, auth_user_id, role, status, created_at, updated_at) VALUES
  ('usr_maya', 'org_maya', 'authusr_maya', 'owner', 'active',
   unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00'));

-- ─── Business profile & tax year ────────────────────────────────────────

INSERT INTO business_profiles (
  id, org_id, legal_form, kvk_registered_at, kor_opt_in, kor_since,
  has_salaried_job, startersaftrek_used_count, default_set_aside_rate_bps,
  reminder_cadence, onboarded_at,
  first_quarter_closed_at, created_at, updated_at
) VALUES (
  'bprf_maya', 'org_maya', 'eenmanszaak', '2026-01-15', 0, NULL,
  0, 1, 3000,
  'persistent', unixepoch('2026-03-01T09:05:00'), -- onboarded on signup day
  NULL, -- trial still open: Q3 (the first quarter worked in Kwartaal) hasn't closed yet
  unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00')
);

-- ─── TaxFigures 2026 ────────────────────────────────────────────────────
-- zelfstandigenaftrek / startersaftrek / mkb_vrijstelling are locked decision
-- #4's verbatim numbers (golden). brackets / zvw / arbeidskorting / algemene
-- heffingskorting are NOT specified by any golden fixture in the plan —
-- seeded here from the best-available published rates (2025) as a
-- placeholder pending official 2026 publication. No golden test in the plan
-- depends on these; flag for review in docs/tax-figures.md (Pillar 6).
-- Must precede tax_year_profiles, which FKs to tax_figures(year).

INSERT INTO tax_figures (
  year, brackets_json, zelfstandigenaftrek_cents, startersaftrek_cents,
  mkb_vrijstelling_bps, zvw_bps, kor_limit_cents,
  algemene_heffingskorting_max_cents, arbeidskorting_table_json
) VALUES (
  2026,
  '[{"uptoCents":3844100,"rateBps":3582},{"uptoCents":7681700,"rateBps":3748},{"uptoCents":null,"rateBps":4950}]',
  120000,  -- €1.200,00 (locked decision #4)
  212300,  -- €2.123,00 (locked decision #4)
  1270,    -- 12,7% (locked decision #4)
  526,     -- 5,26% — 2025 self-employed rate, placeholder for 2026
  2000000, -- €20.000,00 KOR limit
  336200,  -- €3.362,00 — 2025 placeholder for 2026
  '[{"fromCents":0,"toCents":1200000,"rateBps":800},{"fromCents":1200000,"toCents":2500000,"rateBps":3000},{"fromCents":2500000,"toCents":null,"rateBps":0}]'
);

INSERT INTO tax_year_profiles (id, org_id, year, tax_figures_year, hours_target, created_at, updated_at) VALUES
  ('typ_maya_2026', 'org_maya', 2026, 2026, 1225,
   unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00'));

-- ─── Glossary (9 seeded terms — plan calls for 6-8 minimum) ─────────────

INSERT INTO glossary_terms (slug, nl_term, en_gloss, plain_explanation, where_youll_see_it, depth) VALUES
  ('btw', 'btw', 'VAT',
   'Belasting toegevoegde waarde — Dutch value-added tax. Charged on most invoices you send, and reclaimable on most business purchases.',
   'Every invoice line, the VAT quarter flow, the Today hero card.', 'full'),
  ('voorbelasting', 'voorbelasting', 'input VAT',
   'The btw you paid on business purchases with a valid invoice — it reduces what you owe the Belastingdienst for the quarter.',
   'The expenses step of the VAT checklist.', 'full'),
  ('kor', 'KOR', 'small business scheme',
   'Kleineondernemersregeling — opt in and you stop charging btw entirely, as long as your turnover stays under €20.000 a year. No quarterly filing, but no voorbelasting reclaim either.',
   'Onboarding''s KOR decision card, the VAT screen when KOR is on.', 'full'),
  ('zelfstandigenaftrek', 'zelfstandigenaftrek', 'self-employed deduction',
   'A fixed deduction from your profit for meeting the urencriterium (1.225 hours/year on your business).',
   'The income tax studio''s deduction waterfall.', 'full'),
  ('startersaftrek', 'startersaftrek', 'starter''s deduction',
   'An extra deduction on top of the zelfstandigenaftrek for your first few years — usable 3 times within your first 5 years.',
   'The income tax studio''s deduction waterfall.', 'stub'),
  ('mkb-winstvrijstelling', 'MKB-winstvrijstelling', 'SME profit exemption',
   'A percentage of what''s left after the other deductions is exempt from income tax entirely — no eligibility test, everyone gets it.',
   'The income tax studio''s deduction waterfall.', 'stub'),
  ('urencriterium', 'urencriterium', 'hours criterion',
   'Spend at least 1.225 hours a year on your business and you qualify for the zelfstandigenaftrek and startersaftrek.',
   'The Today screen''s hours card, the income tax studio.', 'full'),
  ('voorlopige-aanslag', 'voorlopige aanslag', 'provisional assessment',
   'An optional monthly pre-payment toward next year''s income tax, so the year-end bill is smaller (or you get a refund).',
   'The Money screen.', 'stub'),
  ('rubriek', 'rubriek', 'VAT return box',
   'The numbered sections of the actual Mijn Belastingdienst btw-aangifte form (1a, 1b, 5b, 5c) — Kwartaal computes these, you type them in.',
   'The VAT handoff card.', 'stub');

-- ─── Quarters ────────────────────────────────────────────────────────────

INSERT INTO quarters (id, org_id, year, q, status, filed_at, paid_at, rubriek_1a_cents, rubriek_1b_cents, rubriek_5b_cents, rubriek_5c_cents, created_at, updated_at) VALUES
  ('qtr_2026_q1', 'org_maya', 2026, 1, 'paid',
   unixepoch('2026-04-25T10:00:00'), unixepoch('2026-04-28T10:00:00'),
   294000, 0, 31500, 262500,
   unixepoch('2026-03-01T09:00:00'), unixepoch('2026-04-28T10:00:00')),
  ('qtr_2026_q2', 'org_maya', 2026, 2, 'paid',
   unixepoch('2026-07-20T10:00:00'), unixepoch('2026-07-25T10:00:00'),
   378000, 0, 42000, 336000,
   unixepoch('2026-03-01T09:00:00'), unixepoch('2026-07-25T10:00:00')),
  ('qtr_2026_q3', 'org_maya', 2026, 3, 'in_progress',
   NULL, NULL, NULL, NULL, NULL, NULL,
   unixepoch('2026-03-01T09:00:00'), unixepoch('2026-09-10T10:00:00')),
  ('qtr_2026_q4', 'org_maya', 2026, 4, 'open',
   NULL, NULL, NULL, NULL, NULL, NULL,
   unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00'));

-- ─── Deadlines ───────────────────────────────────────────────────────────

INSERT INTO deadlines (id, org_id, kind, due_date, quarter_id, dismissed_at, created_at, updated_at) VALUES
  ('ddl_2026_q1', 'org_maya', 'btw_q', '2026-04-30', 'qtr_2026_q1', NULL, unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00')),
  ('ddl_2026_q2', 'org_maya', 'btw_q', '2026-07-31', 'qtr_2026_q2', NULL, unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00')),
  ('ddl_2026_q3', 'org_maya', 'btw_q', '2026-10-31', 'qtr_2026_q3', NULL, unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00')),
  ('ddl_2026_q4', 'org_maya', 'btw_q', '2027-01-31', 'qtr_2026_q4', NULL, unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00')),
  ('ddl_2026_ib', 'org_maya', 'income_tax', '2027-05-01', NULL, NULL, unixepoch('2026-03-01T09:00:00'), unixepoch('2026-03-01T09:00:00'));

-- ─── Q1 lines (illustrative, internally consistent — not golden) ───────

INSERT INTO income_lines (id, org_id, quarter_id, date, description, amount_ex_vat_cents, vat_rate, vat_cents, source, import_source, created_at, updated_at) VALUES
  ('inc_q1_1', 'org_maya', 'qtr_2026_q1', '2026-02-10', 'Consulting — February retainer', 1400000, '21', 294000, 'manual', NULL, unixepoch('2026-02-10T09:00:00'), unixepoch('2026-02-10T09:00:00'));

INSERT INTO expense_lines (id, org_id, quarter_id, date, supplier, amount_ex_vat_cents, vat_rate, vat_cents, vat_reclaimable, is_startup_cost, deduction_mode, receipt_id, created_at, updated_at) VALUES
  ('exp_q1_1', 'org_maya', 'qtr_2026_q1', '2026-02-15', 'Co-working space', 150000, '21', 31500, 1, 0, 'expense', NULL, unixepoch('2026-02-15T09:00:00'), unixepoch('2026-02-15T09:00:00'));

-- ─── Q2 lines (illustrative, internally consistent — not golden) ───────

INSERT INTO income_lines (id, org_id, quarter_id, date, description, amount_ex_vat_cents, vat_rate, vat_cents, source, import_source, created_at, updated_at) VALUES
  ('inc_q2_1', 'org_maya', 'qtr_2026_q2', '2026-05-12', 'Consulting — Q2 retainer', 1800000, '21', 378000, 'manual', NULL, unixepoch('2026-05-12T09:00:00'), unixepoch('2026-05-12T09:00:00'));

INSERT INTO expense_lines (id, org_id, quarter_id, date, supplier, amount_ex_vat_cents, vat_rate, vat_cents, vat_reclaimable, is_startup_cost, deduction_mode, receipt_id, created_at, updated_at) VALUES
  ('exp_q2_1', 'org_maya', 'qtr_2026_q2', '2026-05-20', 'Co-working space', 200000, '21', 42000, 1, 0, 'expense', NULL, unixepoch('2026-05-20T09:00:00'), unixepoch('2026-05-20T09:00:00'));

-- ─── Q3 lines (GOLDEN — sums to locked decision #4's Q3 figures exactly) ─
-- Income: 1.950.000 @21% (409.500 vat) + 50.000 @9% (4.500 vat)
--   = 2.000.000 ex vat, 414.000 vat -> rubriek 1a €4.095,00 / 1b €45,00
-- Expenses: 250.000 @21% (52.500 vat) + 94.444 @9% (8.500 vat)
--   = 344.444 ex vat, 61.000 vat -> rubriek 5b €610,00
-- 5c = 414.000 - 61.000 = 353.000 = €3.530,00

INSERT INTO income_lines (id, org_id, quarter_id, date, description, amount_ex_vat_cents, vat_rate, vat_cents, source, import_source, created_at, updated_at) VALUES
  ('inc_q3_1', 'org_maya', 'qtr_2026_q3', '2026-08-05', 'Consulting — August invoice', 1950000, '21', 409500, 'manual', NULL, unixepoch('2026-08-05T09:00:00'), unixepoch('2026-08-05T09:00:00')),
  ('inc_q3_2', 'org_maya', 'qtr_2026_q3', '2026-09-10', 'Workshop — reduced-rate training session', 50000, '9', 4500, 'manual', NULL, unixepoch('2026-09-10T09:00:00'), unixepoch('2026-09-10T09:00:00'));

INSERT INTO expense_lines (id, org_id, quarter_id, date, supplier, amount_ex_vat_cents, vat_rate, vat_cents, vat_reclaimable, is_startup_cost, deduction_mode, receipt_id, created_at, updated_at) VALUES
  ('exp_q3_1', 'org_maya', 'qtr_2026_q3', '2026-08-12', 'Co-working space', 250000, '21', 52500, 1, 0, 'expense', NULL, unixepoch('2026-08-12T09:00:00'), unixepoch('2026-08-12T09:00:00')),
  ('exp_q3_2', 'org_maya', 'qtr_2026_q3', '2026-09-01', 'Software subscription', 94444, '9', 8500, 1, 0, 'expense', NULL, unixepoch('2026-09-01T09:00:00'), unixepoch('2026-09-01T09:00:00'));

-- ─── Hours log (urencriterium) — illustrative, on pace for 1.225/year ───

INSERT INTO hours_entries (id, org_id, date, hours, note, created_at, updated_at) VALUES
  ('hrs_2026_02', 'org_maya', '2026-02-28', 150, 'February', unixepoch('2026-02-28T18:00:00'), unixepoch('2026-02-28T18:00:00')),
  ('hrs_2026_04', 'org_maya', '2026-04-30', 160, 'March + April', unixepoch('2026-04-30T18:00:00'), unixepoch('2026-04-30T18:00:00')),
  ('hrs_2026_06', 'org_maya', '2026-06-30', 165, 'May + June', unixepoch('2026-06-30T18:00:00'), unixepoch('2026-06-30T18:00:00')),
  ('hrs_2026_08', 'org_maya', '2026-08-31', 170, 'July + August', unixepoch('2026-08-31T18:00:00'), unixepoch('2026-08-31T18:00:00')),
  ('hrs_2026_09', 'org_maya', '2026-09-30', 155, 'September', unixepoch('2026-09-30T18:00:00'), unixepoch('2026-09-30T18:00:00'));
