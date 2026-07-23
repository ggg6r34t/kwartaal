import { and, eq } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import type { TenantDb } from "@kwartaal/db";
import { newId } from "@kwartaal/core";
import { openSecret, sealSecret } from "./crypto";

export interface SecretRef {
  integrationId?: string | null;
  keyRef: string;
}

/**
 * Upserts by (orgId, integrationId, keyRef) and encrypts. Callers are
 * responsible for the degraded-mode check (no SECRETS_ENCRYPTION_KEY ⇒ 503,
 * not a crash — see the integrations route once it lands in a later
 * pillar) before calling this.
 */
export async function putSecret(
  tenantDb: TenantDb,
  kek: string,
  ref: SecretRef,
  plaintext: string,
): Promise<void> {
  const sealed = await sealSecret(plaintext, kek);
  const integrationId = ref.integrationId ?? null;

  const existing = await tenantDb.select(
    schema.secrets,
    and(
      eq(schema.secrets.integrationId, integrationId as never),
      eq(schema.secrets.keyRef, ref.keyRef),
    ),
  );

  if (existing[0]) {
    await tenantDb.update(
      schema.secrets,
      { ciphertext: sealed.ciphertext, iv: sealed.iv },
      eq(schema.secrets.id, existing[0].id),
    );
    return;
  }

  await tenantDb.insert(schema.secrets, {
    id: newId("secret"),
    integrationId,
    keyRef: ref.keyRef,
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
  });
}

/** Decrypts — server-side only, never return the plaintext to a client. */
export async function getSecret(
  tenantDb: TenantDb,
  kek: string,
  ref: SecretRef,
): Promise<string | null> {
  const integrationId = ref.integrationId ?? null;
  const rows = await tenantDb.select(
    schema.secrets,
    and(
      eq(schema.secrets.integrationId, integrationId as never),
      eq(schema.secrets.keyRef, ref.keyRef),
    ),
  );
  const row = rows[0];
  if (!row) return null;
  return openSecret({ ciphertext: row.ciphertext, iv: row.iv }, kek);
}
