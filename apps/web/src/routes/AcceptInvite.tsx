import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { signIn, signUp } from "../lib/auth-client";
import { apiUrl } from "../lib/api";

const MIN_PASSWORD_LENGTH = 10;

interface InvitePreview {
  orgName: string;
  invitedByName: string;
  legalForm: string | null;
  email: string;
}

type PreviewState =
  | { status: "loading" }
  | { status: "valid"; preview: InvitePreview }
  | { status: "expired"; invitedByName: string }
  | { status: "not-found" }
  | { status: "declined" };

const LEGAL_FORM_LABELS: Record<string, string> = {
  eenmanszaak: "Sole proprietorship",
  vof: "Partnership (vof)",
  bv: "Private limited (bv)",
  other: "Business",
};

/**
 * docs/design's Auth surfaces §6: a professional third party's first
 * contact with the brand. Accepting binds role=bookkeeper to the inviting
 * org server-side (apps/api/src/lib/consume-invite.ts, on the same
 * user.create.after hook normal signup uses) — this page only surfaces
 * who invited them and sends the same magic-link/password paths SignIn and
 * SignUp use; it never creates a new org itself.
 */
export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<PreviewState>({ status: "loading" });
  const [passwordMode, setPasswordMode] = useState(false);
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // Raw fetch, not apiFetch: apiFetch's ApiError only carries status +
    // `body.error`, but the 410 (expired) response's useful field is
    // `invitedByName`, not `error` — reading the body directly for every
    // status is simpler than widening ApiError for one caller.
    fetch(apiUrl(`/invite-preview/${token}`), { credentials: "include" })
      .then(async (res) => {
        if (cancelled) return;
        const body = (await res.json().catch(() => ({}))) as Partial<InvitePreview> & {
          invitedByName?: string;
        };
        if (res.status === 200) {
          setState({ status: "valid", preview: body as InvitePreview });
        } else if (res.status === 410) {
          setState({ status: "expired", invitedByName: body.invitedByName ?? "" });
        } else {
          setState({ status: "not-found" });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "not-found" });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function acceptWithMagicLink() {
    if (state.status !== "valid") return;
    setError(null);
    setSending(true);
    const result = await signIn.magicLink({
      email: state.preview.email,
      callbackURL: `${window.location.origin}/app`,
      errorCallbackURL: `${window.location.origin}/link-expired?kind=signin&email=${encodeURIComponent(state.preview.email)}`,
    });
    setSending(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    navigate(
      `/check-your-inbox?kind=signin&email=${encodeURIComponent(state.preview.email)}`,
    );
  }

  async function acceptWithPassword(event: FormEvent) {
    event.preventDefault();
    if (state.status !== "valid") return;
    setError(null);
    setSending(true);
    const result = await signUp.email({ email: state.preview.email, password, name: "" });
    setSending(false);
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    navigate("/app", { replace: true });
  }

  async function decline() {
    if (!token) return;
    setSending(true);
    await fetch(apiUrl(`/invite-preview/${token}/decline`), {
      method: "POST",
      credentials: "include",
    });
    setSending(false);
    setState({ status: "declined" });
  }

  if (state.status === "loading") {
    return (
      <AuthShell>
        <p className="m-0 text-sm text-body">Loading&hellip;</p>
      </AuthShell>
    );
  }

  if (state.status === "declined") {
    return (
      <AuthShell>
        <div
          aria-hidden="true"
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-control bg-border-hairline"
        >
          <span className="block h-0.5 w-4 rounded-sm bg-faint" />
        </div>
        <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">Invite declined</h1>
        <p className="m-0 text-sm leading-relaxed text-body">
          Nothing was shared, and they&rsquo;ve been notified. Changed your mind? Ask them
          to send a new invite.
        </p>
      </AuthShell>
    );
  }

  if (state.status === "expired") {
    return (
      <AuthShell>
        <div
          aria-hidden="true"
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-control border border-amber-border bg-amber-bg"
        >
          <span className="block h-3.5 w-3.5 rotate-45 rounded-full border-2 border-amber border-r-transparent" />
        </div>
        <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">
          This invite has expired
        </h1>
        <p className="m-0 text-sm leading-relaxed text-body">
          Invites expire after 7 days.{" "}
          {state.invitedByName
            ? `Ask ${state.invitedByName} to send a fresh one — it takes a few seconds.`
            : "Ask them to send a fresh one — it takes a few seconds."}
        </p>
      </AuthShell>
    );
  }

  if (state.status === "not-found") {
    return (
      <AuthShell>
        <h1 className="m-0 mb-2 text-xl font-semibold tracking-tight">
          Invite not found
        </h1>
        <p className="m-0 text-sm leading-relaxed text-body">
          This invite has expired or was already used. Ask the org owner to send a new
          one.
        </p>
      </AuthShell>
    );
  }

  const { preview } = state;
  const legalFormLabel = preview.legalForm ? LEGAL_FORM_LABELS[preview.legalForm] : null;

  return (
    <AuthShell>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        Invitation
      </div>
      <h1 className="m-0 mb-2.5 text-[19px] font-semibold leading-snug tracking-tight">
        {preview.invitedByName} invited you to view their administration
      </h1>
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <span className="text-[13.5px] font-semibold">{preview.invitedByName}</span>
        {legalFormLabel && (
          <span
            className="cursor-help border-b-2 border-dotted border-accent text-xs font-semibold"
            title={legalFormLabel}
          >
            {preview.legalForm}
          </span>
        )}
      </div>
      <div className="mb-4 rounded-control border border-border bg-wash px-3.5 py-2.5 text-[13px] leading-relaxed text-body">
        <strong className="text-ink">Read-only seat</strong> &mdash; view and export their
        quarters and figures. No changes, ever.
      </div>

      {passwordMode ? (
        <form onSubmit={(event) => void acceptWithPassword(event)} noValidate>
          <label className="mb-1.5 block text-[12.5px] font-semibold" htmlFor="in-email">
            Your email
          </label>
          <input
            id="in-email"
            type="email"
            readOnly
            value={preview.email}
            className="w-full rounded-control border border-border-strong bg-wash px-3.5 py-2.5 text-[14px] text-body"
          />
          <label
            className="mb-1.5 mt-3.5 block text-[12.5px] font-semibold"
            htmlFor="in-password"
          >
            Choose a password
          </label>
          <input
            id="in-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink"
          />
          {error && (
            <p className="mb-0 mt-2.5 text-[12.5px] text-state-overdue">{error}</p>
          )}
          <button
            type="submit"
            disabled={sending || password.length < MIN_PASSWORD_LENGTH}
            className="mt-3.5 w-full rounded-control bg-accent py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {sending ? "Accepting…" : "Accept"}
          </button>
          <div className="mt-3.5 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setPasswordMode(false)}
              className="border-0 bg-transparent p-0 text-[13px] font-semibold text-accent hover:text-accent-hover"
            >
              Email me a link instead
            </button>
          </div>
        </form>
      ) : (
        <>
          <label
            className="mb-1.5 block text-[12.5px] font-semibold"
            htmlFor="in-a-email"
          >
            Your email
          </label>
          <input
            id="in-a-email"
            type="email"
            readOnly
            value={preview.email}
            className="w-full rounded-control border border-border-strong bg-wash px-3.5 py-2.5 text-[14px] text-body"
          />
          {error && (
            <p className="mb-0 mt-2.5 text-[12.5px] text-state-overdue">{error}</p>
          )}
          <button
            type="button"
            disabled={sending}
            onClick={() => void acceptWithMagicLink()}
            className="mt-3.5 w-full rounded-control bg-accent py-3 text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {sending ? "Sending…" : "Accept — email me a sign-in link"}
          </button>
          <div className="mt-3.5 flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setPasswordMode(true)}
              className="border-0 bg-transparent p-0 text-[13px] font-semibold text-accent hover:text-accent-hover"
            >
              Use password instead
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => void decline()}
              className="border-0 bg-transparent p-0 text-[13px] font-medium text-faint hover:text-body"
            >
              Decline
            </button>
          </div>
        </>
      )}

      <div className="mt-4 border-t border-border-hairline pt-3.5 text-center font-explainer text-[13px] italic text-body">
        Invited by {preview.invitedByName} &middot; GDPR-native, EU data residency.
      </div>
    </AuthShell>
  );
}
