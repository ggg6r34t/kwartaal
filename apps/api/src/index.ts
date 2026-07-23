import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./bindings";
import { withDb } from "./middleware/db";
import { requestId } from "./middleware/request-id";
import { accessLog } from "./middleware/access-log";
import { requireSession } from "./middleware/auth";
import { csrfGuard } from "./middleware/csrf";
import { rateLimit } from "./middleware/rate-limit";
import { redirectGuard } from "./middleware/redirect-guard";
import { requireProForMutations } from "./middleware/entitlement";
import { parseTrustedOrigins } from "./auth/origins";
import { createAuth } from "./auth";
import { logger } from "./lib/logger";
import { reportError } from "./lib/sentry";
import { health } from "./routes/health";
import { orgs } from "./routes/orgs";
import { calculator } from "./routes/calculator";
import { onboarding } from "./routes/onboarding";
import { quarters } from "./routes/quarters";
import { deadlines } from "./routes/deadlines";
import { glossary } from "./routes/glossary";
import { incomeTax } from "./routes/income-tax";
import { hours } from "./routes/hours";
import { km } from "./routes/km";
import { money } from "./routes/money";
import { receipts } from "./routes/receipts";
import { exportJobs } from "./routes/export-jobs";
import { startupCosts } from "./routes/startup-costs";
import { billing } from "./routes/billing";
import { billingWebhook } from "./routes/billing-webhook";
import { invites } from "./routes/invites";
import { invitePreview } from "./routes/invite-preview";
import { handleQueue } from "./queue";
import { handleScheduled } from "./scheduled";

const app = new Hono<AppEnv>();

// Middleware order is load-bearing:
// requestId -> secureHeaders -> cors -> withDb -> accessLog -> [rateLimit + redirectGuard on auth] -> csrfGuard -> requireSession -> requireRole(...) -> handler
app.use("*", requestId);
app.use("*", secureHeaders());
app.use("*", (c, next) =>
  cors({
    origin: parseTrustedOrigins(c.env.APP_ORIGIN, c.env.BETTER_AUTH_URL),
    credentials: true,
  })(c, next),
);
app.use("*", withDb);
app.use("*", accessLog);

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  const message = err instanceof Error ? err.message : String(err);
  logger.error("unhandled-error", {
    requestId: c.get("requestId"),
    path: new URL(c.req.url).pathname,
    method: c.req.method,
    message,
  });
  c.executionCtx.waitUntil(reportError(c.env, err, { path: c.req.path }));
  return c.json({ error: "internal-error" }, 500);
});

// Better Auth mounts at /api/auth/*; every other route mounts at the root
// (the /api prefix the browser uses is stripped by the same-origin proxy —
// see apps/web/functions/api/[[path]].ts and vite.config.ts). get-session is
// excluded from the rate limit: it's a read-only cookie check with no
// credential-testing/enumeration value to protect, but every page mount's
// useSession()/useMe() fires it, so leaving it in the same bucket as
// sign-in/sign-up/magic-link/reset-password means routine navigation alone
// can exhaust the budget and lock a real user out of actually signing in —
// exactly the false-positive this rewrite closes.
const authRateLimit = rateLimit({ bucket: "auth", limit: 20, windowSec: 60 });
app.use("/api/auth/*", (c, next) =>
  c.req.path === "/api/auth/get-session" ? next() : authRateLimit(c, next),
);
app.use("/api/auth/*", redirectGuard);
app.on(["GET", "POST"], "/api/auth/*", (c) =>
  createAuth(c.get("db"), c.env).handler(c.req.raw),
);

// Public, no auth:
app.route("/health", health);

// Public set-aside calculator (marketing site + Money screen preview) — no
// auth, no DB write, but still rate-limited per non-negotiable: per-IP
// fixed-window AND a daily cap, two independent layers on the same factory.
app.use(
  "/calculator/*",
  rateLimit({ bucket: "calculator-window", limit: 30, windowSec: 60 }),
);
app.use(
  "/calculator/*",
  rateLimit({ bucket: "calculator-day", limit: 500, windowSec: 86400 }),
);
app.route("/calculator", calculator);

// Public Stripe webhook — signature-verified instead of session-gated, so it
// deliberately skips csrfGuard (Stripe never sends a matching Origin) and
// requireSession (no session exists for a server-to-server call).
app.route("/webhooks/stripe", billingWebhook);

// Public bookkeeper-invite preview (the invitee isn't authenticated yet) —
// returns only org name + invited email, never anything else.
app.route("/invite-preview", invitePreview);

// Authenticated: CSRF guard then session gate, per-route RBAC inside
// modules. requireProForMutations gates every non-GET request on the
// mounts below (Free: calendar/reminders/calculator/glossary — everything
// else is Pro, per locked decision #5); it's a no-op for the trial's first
// quarter (firstQuarterClosedAt is still null) and for an active
// subscriber.
app.use("/orgs/*", csrfGuard, requireSession);
app.route("/orgs", orgs);

app.use("/onboarding/*", csrfGuard, requireSession);
app.route("/onboarding", onboarding);

app.use("/quarters/*", csrfGuard, requireSession, requireProForMutations);
app.route("/quarters", quarters);

app.use("/deadlines/*", csrfGuard, requireSession);
app.route("/deadlines", deadlines);

app.use("/glossary/*", csrfGuard, requireSession);
app.route("/glossary", glossary);

app.use("/income-tax/*", csrfGuard, requireSession);
app.route("/income-tax", incomeTax);

app.use("/hours-entries/*", csrfGuard, requireSession, requireProForMutations);
app.route("/hours-entries", hours);

app.use("/km-entries/*", csrfGuard, requireSession, requireProForMutations);
app.route("/km-entries", km);

app.use("/money/*", csrfGuard, requireSession, requireProForMutations);
app.route("/money", money);

app.use("/receipts/*", csrfGuard, requireSession, requireProForMutations);
app.route("/receipts", receipts);

app.use("/export-jobs/*", csrfGuard, requireSession, requireProForMutations);
app.route("/export-jobs", exportJobs);

app.use("/startup-costs/*", csrfGuard, requireSession);
app.route("/startup-costs", startupCosts);

// Billing itself is never Pro-gated — checkout is how a lapsed/free org
// BECOMES Pro, and portal/status must work regardless of current
// entitlement so a lapsed subscriber can always get back to paying.
app.use("/billing/*", csrfGuard, requireSession);
app.route("/billing", billing);

// The bookkeeper seat itself is the Pro feature (locked decision #5:
// "Pro includes one bookkeeper seat") — listing stays free, sending one doesn't.
app.use("/invites/*", csrfGuard, requireSession, requireProForMutations);
app.route("/invites", invites);

app.notFound((c) => c.json({ error: "not-found" }, 404));

export default {
  fetch: app.fetch,
  queue: handleQueue,
  scheduled: handleScheduled,
};
