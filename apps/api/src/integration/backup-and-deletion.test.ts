import { describe, expect, it } from "vitest";
import { unzipSync, strFromU8 } from "fflate";
import {
  createExecutionContext,
  createScheduledController,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import worker from "../index";
import { authedRequest, signUpAndOnboard } from "./helpers";

async function runWeeklyCron(scheduledTime?: number): Promise<void> {
  const ctx = createExecutionContext();
  await worker.scheduled(
    createScheduledController({ cron: "0 3 * * 7", scheduledTime }),
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
}

/**
 * Definition of Done: "Backup restore rehearsed once against staging per
 * the runbook" (out of reach here — no staging environment) and, more
 * testably, "account deletion cascades D1 rows and R2 objects by test".
 * These two share a cron tick (scheduled.ts's "0 3 * * 7" branch), so they
 * share this file.
 */
describe("weekly backup export", () => {
  it("writes a zip to BACKUPS containing every D1 table, including an org just created", async () => {
    const org = await signUpAndOnboard("backup-check@example.com");

    await runWeeklyCron();

    const listed = await env.BACKUPS.list({ prefix: "weekly/" });
    expect(listed.objects.length).toBeGreaterThan(0);
    const latestKey = [...listed.objects.map((o) => o.key)].sort().at(-1)!;
    const object = await env.BACKUPS.get(latestKey);
    expect(object).not.toBeNull();

    const zip = unzipSync(new Uint8Array(await object!.arrayBuffer()));
    expect(zip["orgs.json"]).toBeDefined();
    expect(zip["user.json"]).toBeDefined(); // Better Auth's table, not in schema.ts

    const orgs = JSON.parse(strFromU8(zip["orgs.json"]!)) as { id: string }[];
    expect(orgs.some((o) => o.id === org.orgId)).toBe(true);
  });

  it("prunes backups beyond the 8 most recent", async () => {
    for (let i = 0; i < 9; i++) {
      await runWeeklyCron();
    }

    const listed = await env.BACKUPS.list({ prefix: "weekly/" });
    expect(listed.objects.length).toBeLessThanOrEqual(8);
  });
});

describe("30-day hard-cascade-delete sweep", () => {
  it("deletes the org's D1 rows, R2 objects, and auth session once past the grace period", async () => {
    const org = await signUpAndOnboard("deletion-sweep@example.com");

    // A minimal fake PNG — the receipts route gates on content-type only.
    const uploadRes = await authedRequest(org.cookie, "/receipts", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: new Uint8Array([1, 2, 3, 4]),
    });
    expect(uploadRes.status).toBe(201);
    const receipt = (await uploadRes.json()) as { id: string };

    const receiptRow = await env.DB.prepare("SELECT r2_key FROM receipts WHERE id = ?")
      .bind(receipt.id)
      .first<{ r2_key: string }>();
    expect(await env.RECEIPTS.get(receiptRow!.r2_key)).not.toBeNull();

    // Request deletion, then backdate it past the 30-day grace window —
    // this test cares about the sweep, not the passage of real time.
    const reqRes = await authedRequest(org.cookie, "/orgs/deletion-request", {
      method: "POST",
    });
    expect(reqRes.status).toBe(201);
    // Timestamp columns are Drizzle `{ mode: "timestamp" }` — stored as unix
    // *seconds*, not milliseconds (see SQLiteTimestamp.mapToDriverValue) —
    // this raw UPDATE has to match that convention to be seen correctly.
    const thirtyOneDaysAgoSeconds = Math.floor(
      (Date.now() - 31 * 24 * 60 * 60 * 1000) / 1000,
    );
    await env.DB.prepare("UPDATE orgs SET deletion_requested_at = ? WHERE id = ?")
      .bind(thirtyOneDaysAgoSeconds, org.orgId)
      .run();

    await runWeeklyCron();

    const orgRow = await env.DB.prepare("SELECT id FROM orgs WHERE id = ?")
      .bind(org.orgId)
      .first();
    expect(orgRow).toBeNull();

    const profileRow = await env.DB.prepare(
      "SELECT id FROM business_profiles WHERE org_id = ?",
    )
      .bind(org.orgId)
      .first();
    expect(profileRow).toBeNull();

    expect(await env.RECEIPTS.get(receiptRow!.r2_key)).toBeNull();

    // The auth session was cascade-deleted along with the auth user, so the
    // old cookie no longer authenticates anything.
    const meRes = await authedRequest(org.cookie, "/orgs/me");
    expect(meRes.status).toBe(401);
  });

  it("leaves orgs whose deletion is within the grace period untouched", async () => {
    const org = await signUpAndOnboard("deletion-sweep-recent@example.com");
    const reqRes = await authedRequest(org.cookie, "/orgs/deletion-request", {
      method: "POST",
    });
    expect(reqRes.status).toBe(201);

    await runWeeklyCron();

    const orgRow = await env.DB.prepare("SELECT id FROM orgs WHERE id = ?")
      .bind(org.orgId)
      .first();
    expect(orgRow).not.toBeNull();
  });
});
