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
import { handleQueue } from "./queue";
import { handleScheduled } from "./scheduled";

const app = new Hono<AppEnv>();

// Middleware order is load-bearing:
// requestId -> secureHeaders -> cors -> withDb -> accessLog -> [rateLimit on auth] -> csrfGuard -> requireSession -> requireRole(...) -> handler
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
// see apps/web/functions/api/[[path]].ts and vite.config.ts).
app.use("/api/auth/*", rateLimit({ bucket: "auth", limit: 20, windowSec: 60 }));
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

// Authenticated: CSRF guard then session gate, per-route RBAC inside modules.
app.use("/orgs/*", csrfGuard, requireSession);
app.route("/orgs", orgs);

app.use("/onboarding/*", csrfGuard, requireSession);
app.route("/onboarding", onboarding);

app.use("/quarters/*", csrfGuard, requireSession);
app.route("/quarters", quarters);

app.use("/deadlines/*", csrfGuard, requireSession);
app.route("/deadlines", deadlines);

app.use("/glossary/*", csrfGuard, requireSession);
app.route("/glossary", glossary);

app.notFound((c) => c.json({ error: "not-found" }, 404));

export default {
  fetch: app.fetch,
  queue: handleQueue,
  scheduled: handleScheduled,
};
