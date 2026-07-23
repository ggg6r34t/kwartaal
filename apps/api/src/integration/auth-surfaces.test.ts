import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ORIGIN, authedRequest, signUp, signUpAndOnboard } from "./helpers";

function jsonHeaders() {
  return { "Content-Type": "application/json", Origin: ORIGIN };
}

describe("anti-enumeration — magic-link sign-in", () => {
  it("returns an identical response shape and status for a known and an unknown email", async () => {
    const knownEmail = `auth-known-${Date.now()}@example.com`;
    await signUp(knownEmail);
    const unknownEmail = `auth-unknown-${Date.now()}@example.com`;

    const knownRes = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: knownEmail, callbackURL: `${ORIGIN}/app` }),
    });
    const unknownRes = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ email: unknownEmail, callbackURL: `${ORIGIN}/app` }),
    });

    // Timing is not asserted numerically here — network/test-harness jitter
    // makes a strict timing comparison flaky rather than meaningful. What's
    // reliably testable, and what actually matters for anti-enumeration, is
    // that shape and status never differ between the two cases; Better
    // Auth's own magic-link endpoint never looks up the user before
    // responding (open signup — see apps/api/src/auth/index.ts), so there's
    // no existence check to leak in the first place.
    expect(knownRes.status).toBe(unknownRes.status);
    expect(await knownRes.json()).toEqual(await unknownRes.json());
  });
});

describe("anti-enumeration — password reset request", () => {
  it("returns an identical response shape and status for a known and an unknown email", async () => {
    const knownEmail = `reset-known-${Date.now()}@example.com`;
    await signUp(knownEmail);
    const unknownEmail = `reset-unknown-${Date.now()}@example.com`;

    const knownRes = await SELF.fetch(`${ORIGIN}/api/auth/request-password-reset`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        email: knownEmail,
        redirectTo: `${ORIGIN}/reset-password`,
      }),
    });
    const unknownRes = await SELF.fetch(`${ORIGIN}/api/auth/request-password-reset`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        email: unknownEmail,
        redirectTo: `${ORIGIN}/reset-password`,
      }),
    });

    expect(knownRes.status).toBe(unknownRes.status);
    expect(await knownRes.json()).toEqual(await unknownRes.json());
  });
});

describe("redirect discipline — /api/auth/* callback params", () => {
  it("rejects a sign-in/magic-link request whose callbackURL points off-origin", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        email: `redirect-guard-${Date.now()}@example.com`,
        callbackURL: "https://evil.example/steal",
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "untrusted-redirect" });
  });

  it("rejects a magic-link/verify GET whose errorCallbackURL points off-origin", async () => {
    const res = await SELF.fetch(
      `${ORIGIN}/api/auth/magic-link/verify?token=whatever&errorCallbackURL=${encodeURIComponent(
        "https://evil.example/steal",
      )}`,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "untrusted-redirect" });
  });

  it("does not reject a same-origin callbackURL", async () => {
    const res = await SELF.fetch(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        email: `redirect-guard-ok-${Date.now()}@example.com`,
        callbackURL: `${ORIGIN}/app`,
      }),
    });
    expect(res.status).toBe(200);
  });
});

describe("bookkeeper invites — single-use and expiry", () => {
  it("a token can never be previewed, accepted, or declined again once accepted", async () => {
    const owner = await signUpAndOnboard(`invite-reuse-owner-${Date.now()}@example.com`);
    const bookkeeperEmail = `invite-reuse-bk-${Date.now()}@example.com`;

    const inviteRes = await authedRequest(owner.cookie, "/invites", {
      method: "POST",
      body: JSON.stringify({ email: bookkeeperEmail }),
    });
    expect(inviteRes.status).toBe(201);

    const row = await env.DB.prepare("SELECT token FROM invites WHERE email = ?")
      .bind(bookkeeperEmail)
      .first<{ token: string }>();
    if (!row) throw new Error("invite row not found after creation");
    const { token } = row;

    // Accept — the same email-match consumption path AcceptInvite.tsx drives.
    await signUp(bookkeeperEmail);

    const previewAfterAccept = await SELF.fetch(`${ORIGIN}/invite-preview/${token}`);
    expect(previewAfterAccept.status).toBe(404);

    const declineAfterAccept = await SELF.fetch(
      `${ORIGIN}/invite-preview/${token}/decline`,
      { method: "POST", headers: { Origin: ORIGIN } },
    );
    expect(declineAfterAccept.status).toBe(404);
  });

  it("a declined invite can never be previewed or declined again", async () => {
    const owner = await signUpAndOnboard(
      `invite-decline-owner-${Date.now()}@example.com`,
    );
    const declinerEmail = `invite-decline-bk-${Date.now()}@example.com`;

    await authedRequest(owner.cookie, "/invites", {
      method: "POST",
      body: JSON.stringify({ email: declinerEmail }),
    });
    const row = await env.DB.prepare("SELECT token FROM invites WHERE email = ?")
      .bind(declinerEmail)
      .first<{ token: string }>();
    if (!row) throw new Error("invite row not found after creation");
    const { token } = row;

    const firstDecline = await SELF.fetch(`${ORIGIN}/invite-preview/${token}/decline`, {
      method: "POST",
      headers: { Origin: ORIGIN },
    });
    expect(firstDecline.status).toBe(204);

    const secondDecline = await SELF.fetch(`${ORIGIN}/invite-preview/${token}/decline`, {
      method: "POST",
      headers: { Origin: ORIGIN },
    });
    expect(secondDecline.status).toBe(404);

    const previewAfterDecline = await SELF.fetch(`${ORIGIN}/invite-preview/${token}`);
    expect(previewAfterDecline.status).toBe(404);

    // The design's email copy promises "Maya has been notified" — proven
    // by a real row, not just the absence of an error.
    const notification = await env.DB.prepare(
      "SELECT kind, message FROM notifications WHERE org_id = ?",
    )
      .bind(owner.orgId)
      .first<{ kind: string; message: string }>();
    expect(notification?.kind).toBe("invite_declined");
    expect(notification?.message).toContain(declinerEmail);

    const audit = await env.DB.prepare(
      "SELECT action FROM audit_logs WHERE org_id = ? AND action = 'invite.declined'",
    )
      .bind(owner.orgId)
      .first<{ action: string }>();
    expect(audit?.action).toBe("invite.declined");
  });

  it("an expired invite is never consumed — signup provisions a fresh org instead", async () => {
    const owner = await signUpAndOnboard(`invite-expiry-owner-${Date.now()}@example.com`);
    const invitedEmail = `invite-expiry-bk-${Date.now()}@example.com`;

    await authedRequest(owner.cookie, "/invites", {
      method: "POST",
      body: JSON.stringify({ email: invitedEmail }),
    });
    const row = await env.DB.prepare("SELECT token FROM invites WHERE email = ?")
      .bind(invitedEmail)
      .first<{ token: string }>();
    if (!row) throw new Error("invite row not found after creation");
    const { token } = row;

    await env.DB.prepare("UPDATE invites SET expires_at = ? WHERE token = ?")
      .bind(Math.floor(Date.now() / 1000) - 3600, token)
      .run();

    const previewExpired = await SELF.fetch(`${ORIGIN}/invite-preview/${token}`);
    expect(previewExpired.status).toBe(410);
    const previewBody = (await previewExpired.json()) as { invitedByName: string };
    expect(previewBody.invitedByName).toBeTruthy();

    const cookie = await signUp(invitedEmail);
    const me = await authedRequest(cookie, "/orgs/me");
    const meBody = (await me.json()) as { org: { id: string }; role: string };
    expect(meBody.org.id).not.toBe(owner.orgId);
    expect(meBody.role).toBe("owner");
  });
});
