import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { requestPasswordReset } from "../lib/auth-client";

/** docs/design's Auth surfaces §5 (request half) — success reuses CheckYourInbox, the same anti-enumeration screen the magic-link path uses. */
export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}`,
    });
    setSending(false);
    navigate(`/check-your-inbox?kind=reset&email=${encodeURIComponent(email)}`);
  }

  return (
    <AuthShell>
      <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">
        Reset your password
      </h1>
      <p className="m-0 mb-4 text-[13.5px] leading-relaxed text-body">
        We&rsquo;ll email you a reset link. It takes about a minute.
      </p>
      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <label className="mb-1.5 block text-[12.5px] font-semibold" htmlFor="fp-email">
          Email
        </label>
        <input
          id="fp-email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@studio.nl"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={sending}
          className="w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink disabled:bg-wash disabled:text-body"
        />
        <button
          type="submit"
          disabled={sending}
          className="mt-3.5 w-full rounded-control bg-accent py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-90"
        >
          {sending ? "Sending…" : "Email me a reset link"}
        </button>
        <div className="mt-3.5 flex justify-center">
          <Link
            to="/signin"
            className="text-[13px] font-semibold text-accent no-underline hover:text-accent-hover"
          >
            Back to sign in
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
