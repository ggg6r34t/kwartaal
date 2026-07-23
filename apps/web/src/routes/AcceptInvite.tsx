import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { signIn } from "../lib/auth-client";

interface InvitePreview {
  orgName: string;
  email: string;
}

/**
 * The bookkeeper-invite landing page. Doesn't do the org-attachment itself —
 * that happens server-side in Better Auth's user.create.after hook the
 * moment this email's magic link is clicked (see
 * apps/api/src/lib/consume-invite.ts). This page only shows who invited
 * them and sends the same magic link SignIn.tsx sends.
 */
export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<InvitePreview>(`/invite-preview/${token}`)
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [token]);

  async function accept() {
    if (!preview) return;
    setError(null);
    const result = await signIn.magicLink({ email: preview.email, callbackURL: "/app" });
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    setSent(true);
  }

  if (preview === undefined) {
    return (
      <main className="mx-auto max-w-sm px-6 py-24 text-sm text-body">Loading…</main>
    );
  }

  if (preview === null) {
    return (
      <main className="mx-auto max-w-sm px-6 py-24">
        <h1 className="m-0 text-2xl font-semibold tracking-tight">Invite not found</h1>
        <p className="mt-4 text-sm leading-relaxed text-body">
          This invite has expired or was already used. Ask the org owner to send a new
          one.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="m-0 text-2xl font-semibold tracking-tight">
        You're invited to {preview.orgName}
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-body">
        As a bookkeeper — read and export, no mutations. Sign in with{" "}
        <strong className="text-ink">{preview.email}</strong> to accept.
      </p>
      {sent ? (
        <p className="mt-6 text-sm leading-relaxed text-body">
          Check your email for a sign-in link — clicking it accepts the invite.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void accept()}
          className="mt-6 rounded-control bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Send sign-in link
        </button>
      )}
      {error && <p className="mt-3 text-[13px] text-state-overdue">{error}</p>}
    </main>
  );
}
