import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, AuthFooterLinks, AuthGdprNote } from "../components/AuthShell";
import { signIn, useSession } from "../lib/auth-client";
import { sanitizeReturnTo } from "../lib/return-to";

/** Matches apps/api/src/index.ts's `rateLimit({ bucket: "auth", windowSec: 60 })` — informational only, the server is the real enforcement. */
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60;

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white"
    />
  );
}

/**
 * docs/design's Auth surfaces §1: magic link is the hero path, password is
 * a quiet disclosure behind "Use password instead." Open self-serve signup
 * (locked decision #1) means this same magic-link form signs up a new
 * account too — SignUp.tsx exists as a separate screen only because the
 * design treats first-contact copy differently, not because the mechanism
 * differs.
 */
export function SignIn() {
  const { data, isPending } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const sessionExpired = searchParams.get("sessionExpired") === "1";

  const [passwordMode, setPasswordMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const errorRef = useRef<HTMLParagraphElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rateLimitedUntil) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [rateLimitedUntil]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (!isPending && data?.session) {
    return <Navigate to={returnTo} replace />;
  }

  const cooldownRemaining = rateLimitedUntil
    ? Math.max(0, Math.ceil((rateLimitedUntil - now) / 1000))
    : 0;
  const passwordRateLimited = rateLimitedUntil !== null && cooldownRemaining > 0;

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    const result = await signIn.magicLink({
      email,
      callbackURL: `${window.location.origin}/app`,
      errorCallbackURL: `${window.location.origin}/link-expired?kind=signin&email=${encodeURIComponent(email)}`,
    });
    setSending(false);
    if (result.error) {
      if (result.error.status === 429) {
        setRateLimitedUntil(Date.now() + AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000);
        return;
      }
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    navigate(`/check-your-inbox?kind=signin&email=${encodeURIComponent(email)}`);
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result = await signIn.email({ email, password });
    if (result.error) {
      if (result.error.status === 429) {
        setRateLimitedUntil(Date.now() + AUTH_RATE_LIMIT_WINDOW_SECONDS * 1000);
        return;
      }
      setError("That password didn’t match.");
      return;
    }
    navigate(returnTo, { replace: true });
  }

  const cooldownLabel = `${Math.floor(cooldownRemaining / 60)}:${String(
    cooldownRemaining % 60,
  ).padStart(2, "0")}`;

  return (
    <AuthShell footer={<AuthFooterLinks />}>
      {sessionExpired && (
        <div
          role="status"
          className="mb-3.5 rounded-control border border-border bg-wash px-3.5 py-2.5 text-center text-[13px] text-body"
        >
          Signed out for your security &mdash; sign back in below.
        </div>
      )}

      <h1 className="m-0 mb-4 text-xl font-semibold tracking-tight">Sign in</h1>

      {passwordRateLimited && (
        <div
          role="status"
          className="mb-4 rounded-control border border-amber-border bg-amber-bg px-3.5 py-3 text-[13px] leading-relaxed text-amber-ink"
        >
          <strong>Too many tries.</strong> Wait a minute, or use a sign-in link instead
          &mdash; it skips the password entirely.
        </div>
      )}

      <form onSubmit={passwordMode ? submitPassword : sendMagicLink} noValidate>
        <label className="mb-1.5 block text-[12.5px] font-semibold" htmlFor="si-email">
          Email
        </label>
        <input
          id="si-email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@studio.nl"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={sending}
          className="w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink disabled:bg-wash disabled:text-body"
        />

        {passwordMode && (
          <>
            <div className="mb-1.5 mt-3.5 flex items-baseline justify-between">
              <label className="text-[12.5px] font-semibold" htmlFor="si-password">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-accent no-underline hover:text-accent-hover"
              >
                Forgot password?
              </Link>
            </div>
            <input
              ref={passwordRef}
              id="si-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "si-error" : undefined}
              className={`w-full rounded-control border bg-surface px-3.5 py-2.5 text-[15px] text-ink ${
                error ? "border-[1.5px] border-state-overdue" : "border-border-strong"
              }`}
            />
            {error && (
              <p
                id="si-error"
                ref={errorRef}
                tabIndex={-1}
                className="mb-0 mt-1.5 text-[12.5px] leading-relaxed text-state-overdue"
              >
                <strong>{error}</strong> Try again, or{" "}
                <Link
                  to="/forgot-password"
                  className="font-semibold text-accent underline"
                >
                  reset it
                </Link>{" "}
                &mdash; takes about a minute.
              </p>
            )}
          </>
        )}

        {!passwordMode && error && (
          <p
            ref={errorRef}
            tabIndex={-1}
            className="mb-0 mt-1.5 text-[13px] text-state-overdue"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending || (passwordMode && passwordRateLimited)}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-control bg-accent py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:bg-accent-hover disabled:opacity-90"
        >
          {sending ? (
            <>
              <Spinner />
              Sending your link&hellip;
            </>
          ) : passwordMode ? (
            "Sign in"
          ) : (
            "Email me a sign-in link"
          )}
        </button>

        <div className="mt-3.5 flex justify-center">
          {passwordMode ? (
            <button
              type="button"
              onClick={() => {
                setPasswordMode(false);
                setError(null);
              }}
              className="border-0 bg-transparent p-0 text-[13px] font-semibold text-accent hover:text-accent-hover"
            >
              Email me a link instead
            </button>
          ) : passwordRateLimited ? (
            <span className="text-[13px] font-semibold text-faint" aria-live="polite">
              Password available again in {cooldownLabel}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPasswordMode(true);
                setError(null);
              }}
              className="border-0 bg-transparent p-0 text-[13px] font-semibold text-accent hover:text-accent-hover"
            >
              Use password instead
            </button>
          )}
        </div>
      </form>

      {!sending && <AuthGdprNote />}

      <p className="mb-0 mt-4 text-center text-[12.5px] text-body">
        New here?{" "}
        <Link
          to="/signup"
          className="font-semibold text-accent no-underline hover:text-accent-hover"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
