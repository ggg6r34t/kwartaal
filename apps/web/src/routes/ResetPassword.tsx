import { useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { signIn, resetPassword } from "../lib/auth-client";
import { sanitizeReturnTo } from "../lib/return-to";

const MIN_PASSWORD_LENGTH = 10;

/**
 * docs/design's Auth surfaces §5 (reset half). Landed on from the emailed
 * link via Better Auth's own GET /reset-password/:token redirect (see
 * apps/api/src/email/deliver-password-reset.ts) — it preserves whatever
 * query params we put on `redirectTo` (here, `email`) and adds either
 * `token` (valid) or `error=INVALID_TOKEN` (expired/invalid), so both
 * survive the round trip without us needing to store anything.
 */
export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");
  const email = searchParams.get("email") ?? "";
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"));

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (error === "INVALID_TOKEN") {
    return (
      <Navigate
        to={`/link-expired?kind=reset&email=${encodeURIComponent(email)}`}
        replace
      />
    );
  }

  if (!token) {
    return <Navigate to="/forgot-password" replace />;
  }

  const mismatch = confirm.length > 0 && confirm !== newPassword;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (mismatch || newPassword.length < MIN_PASSWORD_LENGTH) return;
    setSubmitError(null);
    setSubmitting(true);
    const result = await resetPassword({ newPassword, token: token! });
    if (result.error) {
      setSubmitting(false);
      setSubmitError(result.error.message ?? "Something went wrong.");
      return;
    }
    if (email) {
      await signIn.email({ email, password: newPassword });
    }
    setSubmitting(false);
    navigate(returnTo, { replace: true });
  }

  return (
    <AuthShell>
      <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">
        Choose a new password
      </h1>
      {email && (
        <p className="m-0 mb-4 text-[13.5px] leading-relaxed text-body">
          For <strong className="text-ink">{email}</strong>
        </p>
      )}
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <label className="mb-1.5 block text-[12.5px] font-semibold" htmlFor="rp-new">
          New password
        </label>
        <input
          id="rp-new"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          aria-describedby="rp-new-hint"
          className="w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink"
        />
        <p
          id="rp-new-hint"
          className={`mb-0 mt-1.5 flex items-center gap-1.5 text-xs ${
            newPassword.length >= MIN_PASSWORD_LENGTH
              ? "text-state-settled"
              : "text-faint"
          }`}
        >
          {newPassword.length >= MIN_PASSWORD_LENGTH && (
            <span aria-hidden="true" className="font-bold">
              ✓
            </span>
          )}
          {newPassword.length >= MIN_PASSWORD_LENGTH
            ? `Good length — ${newPassword.length} characters.`
            : `At least ${MIN_PASSWORD_LENGTH} characters. Longer is stronger.`}
        </p>

        <label
          className="mb-1.5 mt-3.5 block text-[12.5px] font-semibold"
          htmlFor="rp-confirm"
        >
          Confirm password
        </label>
        <input
          id="rp-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          aria-invalid={mismatch || undefined}
          aria-describedby={mismatch ? "rp-confirm-err" : undefined}
          className={`w-full rounded-control border bg-surface px-3.5 py-2.5 text-[15px] text-ink ${
            mismatch ? "border-[1.5px] border-state-overdue" : "border-border-strong"
          }`}
        />
        {mismatch && (
          <p id="rp-confirm-err" className="mb-0 mt-1.5 text-[12.5px] text-state-overdue">
            These don&rsquo;t match yet &mdash; no rush.
          </p>
        )}

        {submitError && (
          <p className="mb-0 mt-2.5 text-[12.5px] text-state-overdue">{submitError}</p>
        )}

        <button
          type="submit"
          disabled={
            submitting || mismatch || newPassword.length < MIN_PASSWORD_LENGTH || !confirm
          }
          className="mt-4 w-full rounded-control bg-accent py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save password & sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
