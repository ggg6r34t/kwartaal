-- Global reference data — glossary terms, tax figures. Org-invisible
-- (no org_id column, read only via TenantDb's `.global` escape hatch),
-- and required in EVERY environment including production: unlike
-- seed.sql's Maya persona (demo-only, "intentionally left unseeded" in
-- production per docs/deploy-runbook.md), real users need these rows
-- too. An empty glossary_terms table is a deploy defect, not a valid
-- state — see apps/api/src/routes/health.ts's `/health/ready`.
--
-- Idempotent (INSERT OR IGNORE, keyed on each table's real primary key)
-- so this can be safely re-run against any environment, any number of
-- times, without erroring or overwriting rows already there. Apply via:
--   wrangler d1 execute kwartaal --local --file=packages/db/seed-reference-data.sql
-- (swap --local for --remote --env <staging|production> for those
-- environments). Must run BEFORE seed.sql — seed.sql's
-- tax_year_profiles row FKs to tax_figures(year).

-- ─── TaxFigures 2026 ────────────────────────────────────────────────────
-- zelfstandigenaftrek / startersaftrek / mkb_vrijstelling are locked decision
-- #4's verbatim numbers (golden). brackets / zvw / arbeidskorting / algemene
-- heffingskorting are NOT specified by any golden fixture in the plan —
-- seeded here from the best-available published rates (2025) as a
-- placeholder pending official 2026 publication. No golden test in the plan
-- depends on these; flag for review in docs/tax-figures.md (Pillar 6).

INSERT OR IGNORE INTO tax_figures (
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

-- ─── Glossary (9 seeded terms — plan calls for 6-8 minimum) ─────────────

INSERT OR IGNORE INTO glossary_terms (slug, nl_term, en_gloss, plain_explanation, where_youll_see_it, depth) VALUES
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
