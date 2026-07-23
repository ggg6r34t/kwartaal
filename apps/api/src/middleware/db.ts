import { createMiddleware } from "hono/factory";
import { createDb } from "@kwartaal/db";
import type { AppEnv } from "../bindings";

/** Attaches a per-request Drizzle client. Must run before any other middleware that touches the DB. */
export const withDb = createMiddleware<AppEnv>(async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});
