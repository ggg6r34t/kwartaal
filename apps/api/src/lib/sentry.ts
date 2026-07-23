import type { Bindings } from "../bindings";

/**
 * Minimal hand-rolled Sentry reporter (Store API), not the full SDK — keeps
 * the Worker bundle small. Degrades to a no-op when SENTRY_DSN is unset; the
 * structured console.error from lib/logger.ts is the fallback observability
 * path in that case (Workers Logs / `wrangler tail`, or Logpush if the
 * account has it configured) per the plan's explicit Sentry-or-Tail-Worker
 * non-negotiable. No SENTRY_DSN has been provided yet (see PROGRESS.md) —
 * this path is unexercised until one is.
 */
export async function reportError(
  env: Bindings,
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  if (!env.SENTRY_DSN) return;
  try {
    const dsn = new URL(env.SENTRY_DSN);
    const publicKey = dsn.username;
    const projectId = dsn.pathname.replace(/^\//, "");
    const ingestUrl = `${dsn.protocol}//${dsn.host}/api/${projectId}/store/`;
    const err = error instanceof Error ? error : new Error(String(error));

    await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=kwartaal-worker/0.0.0`,
      },
      body: JSON.stringify({
        message: err.message,
        level: "error",
        platform: "javascript",
        extra: context,
        exception: { values: [{ type: err.name, value: err.message }] },
      }),
    });
  } catch {
    // Error reporting must never itself throw into the request path.
  }
}
