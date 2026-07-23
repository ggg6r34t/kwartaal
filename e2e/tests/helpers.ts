import type { BrowserContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const APP_ORIGIN = "http://localhost:5173";

/**
 * Real Better Auth email/password sign-up + sign-in via the browser
 * context's own request API — the resulting session cookie lands in the
 * SAME cookie jar `page.goto()` uses, so it's a genuinely authenticated
 * browser session afterward, just arrived at without clicking through the
 * magic-link screen (that screen has no password field; it's covered
 * separately by the visual pass, not re-exercised per flow here). Origin
 * is set explicitly — Playwright's request API doesn't auto-send it the
 * way a real browser fetch does, and csrfGuard requires it to match
 * APP_ORIGIN.
 */
export async function apiSignUp(
  context: BrowserContext,
  email: string,
  password = "Sm0keTest!2026",
): Promise<void> {
  const headers = { "Content-Type": "application/json", Origin: APP_ORIGIN };
  const signUpRes = await context.request.post(`${APP_ORIGIN}/api/auth/sign-up/email`, {
    headers,
    data: { email, password, name: email.split("@")[0] },
  });
  if (!signUpRes.ok()) {
    throw new Error(`sign-up failed: ${signUpRes.status()} ${await signUpRes.text()}`);
  }
  const signInRes = await context.request.post(`${APP_ORIGIN}/api/auth/sign-in/email`, {
    headers,
    data: { email, password },
  });
  if (!signInRes.ok()) {
    throw new Error(`sign-in failed: ${signInRes.status()} ${await signInRes.text()}`);
  }
}

/** Completes onboarding via the API directly — used by flows whose focus is downstream of onboarding, not onboarding itself. */
export async function apiCompleteOnboarding(context: BrowserContext): Promise<void> {
  const res = await context.request.post(`${APP_ORIGIN}/api/onboarding/complete`, {
    headers: { "Content-Type": "application/json", Origin: APP_ORIGIN },
    data: {
      legalForm: "eenmanszaak",
      kvkRegisteredAt: "2025-01-15",
      turnoverEstimateCents: 7_200_000,
      korOptIn: false,
      defaultSetAsideRateBps: 3000,
      reminderCadence: "persistent",
    },
  });
  if (!res.ok()) {
    throw new Error(`onboarding failed: ${res.status()} ${await res.text()}`);
  }
}

export async function apiGetOrgId(context: BrowserContext): Promise<string> {
  const res = await context.request.get(`${APP_ORIGIN}/api/orgs/me`);
  const body = (await res.json()) as { org: { id: string } };
  return body.org.id;
}

/**
 * Shells out to the real wrangler CLI against the same local dev D1 the
 * running `wrangler dev` server uses — the same tool (not a separate
 * mock) used for the Pillar 6 backup-restore rehearsal. Used only to seed
 * state a real user can't reach through the UI in a bounded test (a
 * deadline due in exactly 7 days), never to fake a result the app itself
 * should have produced.
 */
// A --command string containing spaces gets word-split by the Windows
// shell when passed through execFileSync's shell:true (needed for npx.cmd
// to resolve at all) — writing the SQL to a real file and using --file
// sidesteps quoting entirely, matching the actual backup-restore rehearsal.
function writeSqlTempFile(sql: string): string {
  const dir = mkdtempSync(join(tmpdir(), "kwartaal-e2e-"));
  const file = join(dir, "query.sql");
  writeFileSync(file, sql, "utf-8");
  return file;
}

export function d1Execute(sql: string): void {
  const file = writeSqlTempFile(sql);
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "kwartaal", "--local", "--file", file],
    {
      cwd: "../apps/api",
      stdio: "pipe",
      shell: true,
    },
  );
}

export function d1QueryFirst<T>(sql: string): T | null {
  const file = writeSqlTempFile(sql);
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", "kwartaal", "--local", "--json", "--file", file],
    { cwd: "../apps/api", stdio: ["ignore", "pipe", "pipe"], shell: true },
  ).toString("utf-8");
  const parsed = JSON.parse(out) as { results: T[] }[];
  return parsed[0]?.results[0] ?? null;
}
