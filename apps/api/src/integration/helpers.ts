import { env, SELF } from "cloudflare:test";

export const ORIGIN = "http://localhost:5173";

export interface TestSession {
  cookie: string;
  orgId: string;
}

/**
 * Real end-to-end sign-up (never a shortcut through directly-seeded
 * session rows) — exercises the actual Better Auth flow + the
 * user.create.after org-provisioning hook, the same path a real signup
 * takes. Returns the raw Set-Cookie value for reuse as a Cookie header on
 * subsequent SELF.fetch calls.
 */
export async function signUp(
  email: string,
  password = "Sm0keTest!2026",
): Promise<string> {
  const signUpRes = await SELF.fetch(`${ORIGIN}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password, name: email.split("@")[0] }),
  });
  if (!signUpRes.ok) {
    throw new Error(`sign-up failed: ${signUpRes.status} ${await signUpRes.text()}`);
  }

  const signInRes = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  const cookie = signInRes.headers.get("set-cookie");
  if (!cookie) throw new Error("sign-in did not return a session cookie");
  return cookie.split(";")[0]!;
}

/** Signs up a fresh owner and completes onboarding (non-KOR, calm cadence) so quarters/deadlines exist. */
export async function signUpAndOnboard(email: string): Promise<TestSession> {
  const cookie = await signUp(email);

  await SELF.fetch(`${ORIGIN}/onboarding/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      legalForm: "eenmanszaak",
      kvkRegisteredAt: "2025-01-15",
      turnoverEstimateCents: 7200000,
      korOptIn: false,
      defaultSetAsideRateBps: 3000,
      reminderCadence: "persistent",
    }),
  });

  const me = await SELF.fetch(`${ORIGIN}/orgs/me`, { headers: { Cookie: cookie } });
  const meBody = (await me.json()) as { org: { id: string } };

  return { cookie, orgId: meBody.org.id };
}

export function authedRequest(
  cookie: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return SELF.fetch(`${ORIGIN}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      Cookie: cookie,
      ...init?.headers,
    },
  });
}

/**
 * Sends a real bookkeeper invite as the given owner (confirming the row
 * really landed in D1 — the invite email only logs in dev mode, see
 * email/deliver-bookkeeper-invite.ts, so there's no inbox to check here),
 * then signs up that email so Better Auth's user.create.after hook
 * attaches them to the owner's org as a bookkeeper (see
 * lib/consume-invite.ts) — consumption is email-match based, not
 * token-based, so the token itself isn't needed to accept.
 */
export async function inviteAndAcceptBookkeeper(
  ownerCookie: string,
  email: string,
): Promise<string> {
  const inviteRes = await authedRequest(ownerCookie, "/invites", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  if (inviteRes.status !== 201) {
    throw new Error(`invite failed: ${inviteRes.status} ${await inviteRes.text()}`);
  }

  const row = await env.DB.prepare("SELECT id FROM invites WHERE email = ?")
    .bind(email)
    .first();
  if (!row) throw new Error(`no invite row found for ${email}`);

  return signUp(email);
}
