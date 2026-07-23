import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { signIn, useSession } from "../lib/auth-client";

/** Open self-serve signup (locked decision #1): the same magic-link form both signs in and signs up. */
export function SignIn() {
  const { data, isPending } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPending && data?.session) {
    return <Navigate to="/app" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result = await signIn.magicLink({ email, callbackURL: "/app" });
    if (result.error) {
      setError(result.error.message ?? "Something went wrong.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto max-w-sm px-6 py-24">
      <h1 className="m-0 text-2xl font-semibold tracking-tight">Sign in to Kwartaal</h1>
      {sent ? (
        <p className="mt-4 text-sm leading-relaxed text-body">
          Check your email for a sign-in link. New here? The same link creates your
          account.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <label className="text-[13px] font-medium text-ink" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] text-ink"
          />
          {error && <p className="m-0 text-[13px] text-state-overdue">{error}</p>}
          <button
            type="submit"
            className="mt-2 rounded-control bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Send sign-in link
          </button>
        </form>
      )}
    </main>
  );
}
