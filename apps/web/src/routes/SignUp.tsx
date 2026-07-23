import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell, AuthFooterLinks } from "../components/AuthShell";
import { signIn, signUp, useSession } from "../lib/auth-client";
import { sanitizeReturnTo } from "../lib/return-to";

const MIN_PASSWORD_LENGTH = 10;

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white"
    />
  );
}

/**
 * docs/design's Auth surfaces §2. Where each path lands is intentionally
 * different: magic link → check-your-inbox (no session yet, needs the
 * click-through); password → straight into /app, which RequireOnboarded
 * bounces to /onboarding automatically since a fresh org's
 * businessProfile.onboardedAt is null — no separate "create workspace"
 * step or verification gate, matching the design's own diagram.
 */
export function SignUp() {
  const { data, isPending } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  const [passwordMode, setPasswordMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  if (!isPending && data?.session) {
    return <Navigate to={returnTo} replace />;
  }

  async function sendMagicLink(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    const result = await signIn.magicLink({
      email,
      callbackURL: `${window.location.origin}/app`,
      errorCallbackURL: `${window.location.origin}/link-expired?kind=signup&email=${encodeURIComponent(email)}`,
    });
    setSending(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    navigate(`/check-your-inbox?kind=signup&email=${encodeURIComponent(email)}`);
  }

  async function createWithPassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSending(true);
    const result = await signUp.email({ email, password, name: "" });
    setSending(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    navigate(returnTo, { replace: true });
  }

  return (
    <AuthShell footer={<AuthFooterLinks />}>
      <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">
        Create your account
      </h1>
      <p className="m-0 mb-4 text-[13.5px] leading-relaxed text-body">
        Free until you close your first quarter. No card.
      </p>

      <form onSubmit={passwordMode ? createWithPassword : sendMagicLink} noValidate>
        <label className="mb-1.5 block text-[12.5px] font-semibold" htmlFor="su-email">
          Email
        </label>
        <input
          id="su-email"
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
            <label
              className="mb-1.5 mt-3.5 block text-[12.5px] font-semibold"
              htmlFor="su-password"
            >
              Password
            </label>
            <input
              id="su-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="su-password-hint"
              className="w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink"
            />
            <p
              id="su-password-hint"
              className={`mb-0 mt-1.5 flex items-center gap-1.5 text-xs ${
                password.length >= MIN_PASSWORD_LENGTH
                  ? "text-state-settled"
                  : "text-faint"
              }`}
            >
              {password.length >= MIN_PASSWORD_LENGTH && (
                <span aria-hidden="true" className="font-bold">
                  ✓
                </span>
              )}
              {password.length >= MIN_PASSWORD_LENGTH
                ? `Good length — ${password.length} characters.`
                : `At least ${MIN_PASSWORD_LENGTH} characters.`}
            </p>
          </>
        )}

        {error && (
          <p
            ref={errorRef}
            tabIndex={-1}
            className="mb-0 mt-2.5 text-[12.5px] text-state-overdue"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-control bg-accent py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-90"
        >
          {sending ? (
            <>
              <Spinner />
              {passwordMode ? "Setting up your workspace…" : "Sending your link…"}
            </>
          ) : passwordMode ? (
            "Create account"
          ) : (
            "Create account — email me a link"
          )}
        </button>

        <div className="mt-3.5 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setPasswordMode((v) => !v);
              setError(null);
            }}
            className="border-0 bg-transparent p-0 text-[13px] font-semibold text-accent hover:text-accent-hover"
          >
            {passwordMode
              ? "Skip the password — email me a link"
              : "Set a password instead"}
          </button>
        </div>
      </form>

      <p className="mb-0 mt-4 text-center text-xs leading-relaxed text-faint">
        By continuing you agree to the{" "}
        <Link to="/terms" className="text-body underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="text-body underline">
          Privacy Policy
        </Link>
        .
      </p>

      <div className="mt-3.5 border-t border-border-hairline pt-3.5 text-center text-[12.5px] text-body">
        Already have an account?{" "}
        <Link
          to="/signin"
          className="font-semibold text-accent no-underline hover:text-accent-hover"
        >
          Sign in
        </Link>
      </div>
    </AuthShell>
  );
}
