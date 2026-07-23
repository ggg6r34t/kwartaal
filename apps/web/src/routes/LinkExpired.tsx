import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { resendAuthLink, authStartUrlFor, type AuthLinkKind } from "../lib/auth-resend";
import { AUTH_LINK_EXPIRY_MINUTES } from "../lib/auth-constants";

/**
 * docs/design's Auth surfaces §4: Better Auth collapses "expired,"
 * "already used," and "invalid/tampered" into one INVALID_TOKEN error (see
 * apps/api/src/email/rewrite-auth-link.ts's neighbor,
 * apps/api/src/middleware/redirect-guard.ts, for the related origin-check
 * note) — it never tells us which. The `email` query param is never
 * decoded from the token; it's one WE attached to errorCallbackURL when
 * this browser itself sent the link (see lib/auth-resend.ts), so its
 * presence means "we know what this browser was trying to do" (the amber,
 * targeted-resend state) and its absence means a stale bookmark, a
 * forwarded link, or a forged token — cases the design says must stay
 * "deliberately vague — the copy never reveals whether the token was
 * malformed, consumed, or forged."
 */
export function LinkExpired() {
  const [searchParams] = useSearchParams();
  const kind = (searchParams.get("kind") as AuthLinkKind | null) ?? "signin";
  const email = searchParams.get("email");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!email) {
    return (
      <AuthShell>
        <div
          aria-hidden="true"
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-border-hairline"
        >
          <span className="block h-0.5 w-4 rounded-sm bg-faint" />
        </div>
        <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">
          This link didn&rsquo;t work
        </h1>
        <p className="m-0 mb-4 text-sm leading-relaxed text-body">
          Request a new one and you&rsquo;ll be in within a minute.
        </p>
        <Link
          to={authStartUrlFor(kind)}
          className="block w-full rounded-control bg-accent py-3 text-center text-[15px] font-semibold text-white no-underline hover:bg-accent-hover"
        >
          Start over
        </Link>
      </AuthShell>
    );
  }

  const noun = kind === "reset" ? "reset link" : "sign-in link";
  const heading =
    kind === "reset" ? "This reset link has expired" : "This link has expired";

  return (
    <AuthShell>
      <div
        aria-hidden="true"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-control border border-amber-border bg-amber-bg"
      >
        <span className="block h-3.5 w-3.5 rotate-45 rounded-full border-2 border-amber border-r-transparent" />
      </div>
      <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">{heading}</h1>
      <p className="m-0 mb-4 text-sm leading-relaxed text-body">
        {kind === "reset" ? "Reset" : "Sign-in"} links work once and expire after{" "}
        {AUTH_LINK_EXPIRY_MINUTES} minutes &mdash; it keeps your account safe. A fresh one
        takes seconds.
      </p>

      {sent ? (
        <p role="status" className="m-0 text-sm text-body">
          Check your email for a fresh {noun}.
        </p>
      ) : (
        <>
          <button
            type="button"
            disabled={sending}
            onClick={async () => {
              setSending(true);
              await resendAuthLink(kind, email);
              setSending(false);
              setSent(true);
            }}
            className="w-full rounded-control bg-accent py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-80"
          >
            {sending ? "Sending…" : `Send a fresh link to ${email}`}
          </button>
          <div className="mt-3.5 flex justify-center">
            <Link
              to={authStartUrlFor(kind)}
              className="text-[13px] font-semibold text-accent no-underline hover:text-accent-hover"
            >
              Use a different address
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
