import { createMiddleware } from "hono/factory";
import { sql } from "drizzle-orm";
import { schema } from "@kwartaal/db/schema";
import type { AppEnv } from "../bindings";

export interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowSec: number;
}

/**
 * D1-backed fixed window, keyed by cf-connecting-ip, atomic
 * INSERT...ON CONFLICT DO UPDATE. rate_limits is global (not tenant-scoped —
 * keyed by IP, not org), so this reads the raw db from context directly;
 * that's fine for middleware (the no-raw-db rule targets route modules).
 */
export function rateLimit(options: RateLimitOptions) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const db = c.get("db");
    const ip = c.req.header("cf-connecting-ip") ?? "unknown";
    const key = `${options.bucket}:${ip}`;
    const windowStart =
      Math.floor(Date.now() / 1000 / options.windowSec) * options.windowSec;

    const result = await db
      .insert(schema.rateLimits)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: [schema.rateLimits.key, schema.rateLimits.windowStart],
        set: { count: sql`${schema.rateLimits.count} + 1` },
      })
      .returning({ count: schema.rateLimits.count });

    const count = result[0]?.count ?? 1;
    if (count > options.limit) {
      c.res.headers.set("retry-after", String(options.windowSec));
      return c.json({ error: "rate-limited" }, 429);
    }
    await next();
  });
}
