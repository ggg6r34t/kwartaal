import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../bindings";

/** Every request gets a request-id, both for the response header and for structured logs (observability non-negotiable). */
export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const id = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.set("requestId", id);
  c.res.headers.set("x-request-id", id);
  await next();
});
