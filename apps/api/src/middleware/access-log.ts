import { createMiddleware } from "hono/factory";
import { logger } from "../lib/logger";
import type { AppEnv } from "../bindings";

/** Structured JSON access log for every request, including request-id and org-id when known. */
export const accessLog = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now();
  await next();
  const session = c.get("session");
  logger.info("request", {
    requestId: c.get("requestId"),
    orgId: session?.orgId,
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});
