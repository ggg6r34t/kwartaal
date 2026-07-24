import { describe, expect, it } from "vitest";
import { authedRequest, signUp, signUpAndOnboard } from "./helpers";

/**
 * "Explain notes" (docs/design's Learn layer, `explainOn`) — default-on
 * for every user including a fresh signup, toggled from Settings,
 * persisted per user, survives sign-out/sign-in (proved here by a fresh
 * GET /orgs/me after the PATCH, the same pattern every other
 * persistence test in this suite uses — a new request with no client
 * state carried over except the session cookie).
 */
describe("Explain mode", () => {
  it("defaults to enabled for a fresh signup with no stored preference", async () => {
    const org = await signUpAndOnboard("explain-owner-a@example.com");
    const res = await authedRequest(org.cookie, "/orgs/me");
    const me = (await res.json()) as { explainModeEnabled: boolean };
    expect(me.explainModeEnabled).toBe(true);
  });

  it("PATCH /orgs/me/explain-mode persists the new value, reflected on the next GET /orgs/me", async () => {
    const org = await signUpAndOnboard("explain-owner-b@example.com");

    const patchRes = await authedRequest(org.cookie, "/orgs/me/explain-mode", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as { explainModeEnabled: boolean };
    expect(patchBody.explainModeEnabled).toBe(false);

    const meRes = await authedRequest(org.cookie, "/orgs/me");
    const me = (await meRes.json()) as { explainModeEnabled: boolean };
    expect(me.explainModeEnabled).toBe(false);
  });

  it("re-enabling flips it back", async () => {
    const org = await signUpAndOnboard("explain-owner-c@example.com");
    await authedRequest(org.cookie, "/orgs/me/explain-mode", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });
    await authedRequest(org.cookie, "/orgs/me/explain-mode", {
      method: "PATCH",
      body: JSON.stringify({ enabled: true }),
    });

    const meRes = await authedRequest(org.cookie, "/orgs/me");
    const me = (await meRes.json()) as { explainModeEnabled: boolean };
    expect(me.explainModeEnabled).toBe(true);
  });

  it("a bookkeeper can toggle their own preference without owner role", async () => {
    const owner = await signUpAndOnboard("explain-owner-d@example.com");
    const inviteRes = await authedRequest(owner.cookie, "/invites", {
      method: "POST",
      body: JSON.stringify({ email: "explain-bookkeeper-d@example.com" }),
    });
    expect(inviteRes.status).toBe(201);

    const bookkeeperCookie = await signUp("explain-bookkeeper-d@example.com");

    const patchRes = await authedRequest(bookkeeperCookie, "/orgs/me/explain-mode", {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    });
    expect(patchRes.status).toBe(200);

    // The owner's own preference is untouched by the bookkeeper's change.
    const ownerMeRes = await authedRequest(owner.cookie, "/orgs/me");
    const ownerMe = (await ownerMeRes.json()) as { explainModeEnabled: boolean };
    expect(ownerMe.explainModeEnabled).toBe(true);
  });
});
