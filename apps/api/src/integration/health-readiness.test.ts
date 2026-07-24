import { describe, expect, it } from "vitest";
import { env, SELF } from "cloudflare:test";
import { ORIGIN } from "./helpers";

/**
 * "An empty glossary is a deploy defect, not a valid state" — this is the
 * check that would have caught production shipping with zero
 * glossary_terms rows (seed-reference-data.sql never applied there).
 * The migrations-only harness starts with an empty glossary_terms table,
 * so `/health/ready` genuinely fails here until a row is inserted —
 * proving the check is real, not a tautology.
 */
describe("GET /health/ready — reference-data check", () => {
  it("reports not ready when glossary_terms is empty", async () => {
    // This suite's D1 is shared, non-isolated storage across the whole
    // run (vitest.config.ts) — establish the empty precondition
    // explicitly rather than relying on being the first test to touch
    // this global table.
    await env.DB.prepare("DELETE FROM glossary_terms").run();

    const res = await SELF.fetch(`${ORIGIN}/health/ready`);
    expect(res.status).toBe(503);
    const body = (await res.json()) as {
      ready: boolean;
      checks: Record<string, boolean>;
    };
    expect(body.ready).toBe(false);
    expect(body.checks.database).toBe(true);
    expect(body.checks.referenceData).toBe(false);
  });

  it("reports ready once glossary_terms has at least one row", async () => {
    await env.DB.prepare(
      `INSERT INTO glossary_terms (slug, nl_term, en_gloss, plain_explanation, where_youll_see_it, depth)
       VALUES ('readiness-test', 'btw', 'VAT', 'Dutch value-added tax.', 'Every invoice line.', 'full')`,
    ).run();

    const res = await SELF.fetch(`${ORIGIN}/health/ready`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ready: boolean;
      checks: Record<string, boolean>;
    };
    expect(body.ready).toBe(true);
    expect(body.checks.referenceData).toBe(true);
  });
});
