import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
import { createDb } from "@kwartaal/db";
import { schema } from "@kwartaal/db/schema";
import { authUser } from "@kwartaal/db/auth-schema";
import type { Bindings } from "../bindings";
import { logger } from "./logger";

const BACKUP_PREFIX = "weekly/";
const RETAINED_BACKUPS = 8;
const DELETION_GRACE_DAYS = 30;

/**
 * Logical (not binary) D1 backup: every real table, dumped via
 * sqlite_master rather than the Drizzle schema list, so it also captures
 * Better Auth's user/session/account/verification tables without this
 * module having to know about them by name. One zip per run
 * (weekly/<iso-timestamp>.zip, one JSON file per table), oldest pruned
 * beyond the last 8 (~2 months of weekly runs).
 */
export async function runWeeklyBackup(env: Bindings): Promise<void> {
  const db = createDb(env.DB);

  // `PRAGMA table_list` (not a direct SELECT against sqlite_master, which
  // D1's query authorizer rejects — it would expose Cloudflare's own
  // internal bookkeeping tables) is D1's sanctioned way to enumerate
  // tables; it already excludes those internal tables from its result.
  // Routed through Drizzle's db.all() rather than a raw env.DB.prepare()
  // call — the latter goes through D1's Sessions API bookmark lookup
  // differently and fails under Miniflare with a spurious
  // "_cf_METADATA.key is prohibited" SQLITE_AUTH error; Drizzle's own
  // query path (already used by every other D1 read in this codebase)
  // doesn't hit it.
  const tableList = await db.all<{ schema: string; name: string; type: string }>(
    sql`PRAGMA table_list`,
  );
  const tableNames = tableList
    .filter(
      (t) =>
        t.type === "table" &&
        t.schema === "main" &&
        !t.name.startsWith("sqlite_") &&
        !t.name.startsWith("_cf_") &&
        t.name !== "d1_migrations",
    )
    .map((t) => t.name);

  const files: Record<string, Uint8Array> = {};
  for (const name of tableNames) {
    const rows = await db.all(sql.raw(`SELECT * FROM "${name}"`));
    files[`${name}.json`] = strToU8(JSON.stringify(rows, null, 2));
  }

  const zipped = zipSync(files, { level: 6 });
  const key = `${BACKUP_PREFIX}${new Date().toISOString()}.zip`;
  await env.BACKUPS.put(key, zipped, {
    httpMetadata: { contentType: "application/zip" },
  });

  const existing = await env.BACKUPS.list({ prefix: BACKUP_PREFIX });
  const sortedKeys = existing.objects.map((o) => o.key).sort();
  const stale = sortedKeys.slice(0, Math.max(0, sortedKeys.length - RETAINED_BACKUPS));
  if (stale.length > 0) await env.BACKUPS.delete(stale);

  logger.info("weekly-backup-complete", {
    key,
    tables: tableNames.length,
    pruned: stale.length,
  });
}

/**
 * The 30-days-later half of "hard cascade delete with a grace period"
 * (the immediate half — setting deletionRequestedAt and enqueueing the
 * user's own export — is orgs.ts's POST /deletion-request). Deleting the
 * `orgs` row cascades every org-scoped table via onDelete: "cascade" FKs
 * (see schema.ts's banner comment); Better Auth's user/session/account
 * rows aren't reachable by that cascade (they're referenced FROM `users`,
 * not the other way around) so they're deleted explicitly here, which
 * itself cascades session/account. R2 receipt/export/summary objects
 * (keyed `${orgId}/...`) are removed first since they aren't in D1 at all.
 */
export async function sweepExpiredDeletions(env: Bindings, now: Date): Promise<void> {
  const db = createDb(env.DB);
  const cutoff = new Date(now.getTime() - DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  const expiredOrgs = await db
    .select({ id: schema.orgs.id })
    .from(schema.orgs)
    .where(
      and(
        isNotNull(schema.orgs.deletionRequestedAt),
        lte(schema.orgs.deletionRequestedAt, cutoff),
      ),
    );

  for (const org of expiredOrgs) {
    const orgUsers = await db
      .select({ authUserId: schema.users.authUserId })
      .from(schema.users)
      .where(eq(schema.users.orgId, org.id));

    let cursor: string | undefined;
    do {
      const listed = await env.RECEIPTS.list({ prefix: `${org.id}/`, cursor });
      // One at a time, not a batch array — Miniflare's local R2 emulation
      // hits a Windows file-locking race on batch deletes (see
      // isolated-storage in the vitest-pool-workers known issues).
      for (const object of listed.objects) {
        await env.RECEIPTS.delete(object.key);
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    await db.delete(schema.orgs).where(eq(schema.orgs.id, org.id));

    for (const u of orgUsers) {
      await db.delete(authUser).where(eq(authUser.id, u.authUserId));
    }

    logger.info("org-hard-deleted", { orgId: org.id, usersDeleted: orgUsers.length });
  }

  if (expiredOrgs.length > 0) {
    logger.info("deletion-sweep-complete", { orgsDeleted: expiredOrgs.length });
  }
}
