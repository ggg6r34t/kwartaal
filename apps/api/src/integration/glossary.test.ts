import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { authedRequest, signUpAndOnboard } from "./helpers";

/**
 * Regression coverage for the empty-glossary-in-production defect: the
 * migrations-only vitest-pool-workers harness starts with an EMPTY
 * glossary_terms table (seed-reference-data.sql is never auto-applied
 * here, matching how a freshly-migrated-but-unseeded D1 behaves) — these
 * tests insert rows directly, the same shape seed-reference-data.sql
 * inserts, and prove an org user reads them back through the real global
 * (`.global`) route, not a tenant-scoped one.
 */
describe("GET /glossary", () => {
  it("returns seeded global terms for an org user, regardless of org", async () => {
    await env.DB.prepare(
      `INSERT INTO glossary_terms (slug, nl_term, en_gloss, plain_explanation, where_youll_see_it, depth)
       VALUES ('btw-glossary-test', 'btw', 'VAT', 'Dutch value-added tax.', 'Every invoice line.', 'full')`,
    ).run();

    const org = await signUpAndOnboard("glossary-owner-a@example.com");
    const res = await authedRequest(org.cookie, "/glossary");
    expect(res.status).toBe(200);
    const terms = (await res.json()) as { slug: string; nlTerm: string }[];

    expect(terms.length).toBeGreaterThan(0);
    expect(terms.find((t) => t.slug === "btw-glossary-test")?.nlTerm).toBe("btw");
  });

  it("is global — a second, unrelated org sees the exact same terms", async () => {
    const orgA = await signUpAndOnboard("glossary-owner-b@example.com");
    const orgB = await signUpAndOnboard("glossary-owner-c@example.com");

    const [resA, resB] = await Promise.all([
      authedRequest(orgA.cookie, "/glossary"),
      authedRequest(orgB.cookie, "/glossary"),
    ]);
    const [termsA, termsB] = await Promise.all([
      resA.json() as Promise<{ slug: string }[]>,
      resB.json() as Promise<{ slug: string }[]>,
    ]);

    expect(termsA.map((t) => t.slug).sort()).toEqual(termsB.map((t) => t.slug).sort());
  });
});
