import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { resendAuthLink, authStartUrlFor, type AuthLinkKind } from "../lib/auth-resend";
import { AUTH_LINK_EXPIRY_MINUTES } from "../lib/auth-constants";

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * docs/design's Auth surfaces §3: the anti-enumeration state, pixel-
 * identical for known and unknown addresses — the copy never confirms
 * either. One screen reused by magic-link sign-in, magic-link sign-up, and
 * password-reset requests, distinguished only by `kind` (drives the resend
 * action and the "wrong address" destination).
 */
export function CheckYourInbox() {
  const [searchParams] = useSearchParams();
  const kind = (searchParams.get("kind") as AuthLinkKind | null) ?? "signin";
  const email = searchParams.get("email") ?? "";

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function handleResend() {
    setResending(true);
    await resendAuthLink(kind, email);
    setResending(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  const cooldownLabel = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`;
  const linkNoun = kind === "reset" ? "reset link" : "sign-in link";

  return (
    <AuthShell>
      <div
        aria-hidden="true"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-accent-tint"
      >
        <span className="block h-3.5 w-5 rounded-sm border-2 border-accent" />
      </div>
      <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">Check your inbox</h1>
      <p className="m-0 mb-1.5 text-sm leading-relaxed text-body">
        If an account exists for <strong className="text-ink">{email}</strong>, a{" "}
        {linkNoun} is on its way.
      </p>
      <p className="m-0 mb-4 text-[13px] text-faint">
        The link works once and expires in {AUTH_LINK_EXPIRY_MINUTES} minutes.
      </p>

      <button
        type="button"
        onClick={() => void handleResend()}
        disabled={cooldown > 0 || resending}
        aria-live="polite"
        className="w-full rounded-control border border-border-strong bg-transparent py-3 text-sm font-semibold text-ink tabular-nums hover:bg-wash disabled:cursor-not-allowed disabled:border-none disabled:bg-border-hairline disabled:text-faint disabled:hover:bg-border-hairline"
      >
        {cooldown > 0 ? `Resend in ${cooldownLabel}` : "Resend link"}
      </button>

      <div className="mt-3.5 flex justify-center">
        <Link
          to={authStartUrlFor(kind)}
          className="text-[13px] font-semibold text-accent no-underline hover:text-accent-hover"
        >
          Wrong address? Start over
        </Link>
      </div>

      <div className="mt-4 border-t border-border-hairline pt-3.5 text-center text-xs leading-relaxed text-faint">
        No email after a minute? Check spam &mdash; search for{" "}
        <span className="font-mono text-[11.5px] text-body">mail.kwartaal.app</span>.
      </div>
    </AuthShell>
  );
}
