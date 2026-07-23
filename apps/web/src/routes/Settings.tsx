import { useCallback, useEffect, useState } from "react";
import type {
  BillingInterval,
  BillingStatusResponse,
  CheckoutSessionResponse,
  Invite,
  PortalSessionResponse,
  ReminderCadence,
} from "@kwartaal/core";
import { apiFetch, ApiError } from "../lib/api";
import { useMe } from "../hooks/useMe";
import { DataExportButton } from "../components/DataExportButton";

export function Settings() {
  const { me, refetch } = useMe();

  if (!me) return <p className="text-sm text-body">Loading…</p>;

  return (
    <div>
      <h1 className="m-0 mb-6 text-[30px] font-semibold tracking-tight">Settings</h1>

      <div className="mb-7 overflow-hidden rounded-card border border-border bg-surface">
        <Row label="Legal form" value={me.businessProfile?.legalForm ?? "—"} />
        <Row
          label="KOR"
          value={me.businessProfile?.korOptIn ? "On — no btw filings" : "Off"}
        />
        <Row
          label="Bookkeeper handoff"
          value={
            me.role === "owner" ? "You're the owner" : "You're a bookkeeper (read-only)"
          }
          last
        />
      </div>

      {me.role === "owner" && (
        <>
          <RemindersSection
            cadence={me.businessProfile?.reminderCadence ?? "persistent"}
            onSaved={refetch}
          />
          <BillingSection />
          <BookkeeperSection />
          <DataSection />
          <DeletionSection
            deletionRequestedAt={me.deletionRequestedAt}
            onChanged={refetch}
          />
        </>
      )}
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className={`flex justify-between px-6 py-4 text-sm ${last ? "" : "border-b border-border-hairline"}`}
    >
      <span className="font-semibold">{label}</span>
      <span className="text-body">{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 mt-8 text-[11px] font-semibold uppercase tracking-wide text-faint">
      {children}
    </div>
  );
}

function RemindersSection({
  cadence,
  onSaved,
}: {
  cadence: ReminderCadence;
  onSaved: () => Promise<unknown>;
}) {
  const [value, setValue] = useState<ReminderCadence>(cadence);
  const [saving, setSaving] = useState(false);

  async function save(next: ReminderCadence) {
    setValue(next);
    setSaving(true);
    try {
      await apiFetch("/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          legalForm: "eenmanszaak",
          kvkRegisteredAt: null,
          turnoverEstimateCents: 0,
          korOptIn: false,
          defaultSetAsideRateBps: 3000,
          reminderCadence: next,
        }),
      });
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SectionHeading>Reminders</SectionHeading>
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex gap-2">
          {(["calm", "persistent"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={saving}
              onClick={() => void save(option)}
              className={`rounded-control border px-3.5 py-2 text-[13px] font-semibold capitalize ${
                value === option
                  ? "border-ink bg-ink text-white"
                  : "border-border-strong text-ink"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="mt-2.5 text-xs text-body">
          Calm: T-14 and T-2, plus one overdue notice. Persistent: every stage, weekly
          while overdue.
        </p>
      </section>
    </>
  );
}

function BillingSection() {
  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("annual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setStatus(await apiFetch<BillingStatusResponse>("/billing/status"));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<CheckoutSessionResponse>(
        "/billing/checkout-session",
        {
          method: "POST",
          body: JSON.stringify({ interval: billingInterval }),
        },
      );
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "billing-not-configured"
          ? "Billing isn't set up yet — check back soon."
          : "Couldn't start checkout. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await apiFetch<PortalSessionResponse>("/billing/portal-session", {
        method: "POST",
      });
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "billing-not-configured"
          ? "Billing isn't set up yet — check back soon."
          : "Couldn't open the billing portal.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <>
      <SectionHeading>Plan &amp; billing</SectionHeading>
      <section className="rounded-card border border-border bg-surface p-5">
        {status.subscription ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold capitalize">
                {status.subscription.plan} · {status.subscription.status}
              </div>
              <div className="text-xs text-body">
                Manage your plan, invoices, and payment method.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={busy}
              className="rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-wash disabled:opacity-50"
            >
              Manage billing
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-3 text-sm">
              {status.firstQuarterClosedAt === null
                ? "You're in your free first-quarter trial."
                : "Your trial has ended."}
            </div>
            <div className="mb-3 flex gap-1.5">
              <button
                type="button"
                onClick={() => setBillingInterval("annual")}
                className={`rounded-control px-3 py-1.5 text-[12.5px] font-semibold ${billingInterval === "annual" ? "bg-ink text-white" : "border border-border-strong text-ink"}`}
              >
                Yearly — €10/mo
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval("monthly")}
                className={`rounded-control px-3 py-1.5 text-[12.5px] font-semibold ${billingInterval === "monthly" ? "bg-ink text-white" : "border border-border-strong text-ink"}`}
              >
                Monthly — €12/mo
              </button>
            </div>
            <button
              type="button"
              onClick={() => void checkout()}
              disabled={busy}
              className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Continue with Pro
            </button>
          </div>
        )}
        {error && <p className="mt-2.5 text-xs text-state-overdue">{error}</p>}
      </section>
    </>
  );
}

function BookkeeperSection() {
  const [invites, setInvitesList] = useState<Invite[] | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setInvitesList(await apiFetch<Invite[]>("/invites"));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function send() {
    setError(null);
    setSending(true);
    try {
      await apiFetch("/invites", { method: "POST", body: JSON.stringify({ email }) });
      setEmail("");
      await refetch();
    } catch (err) {
      if (err instanceof ApiError && err.code === "email-already-has-account") {
        setError("That email already has a Kwartaal account.");
      } else if (!(err instanceof ApiError && err.status === 402)) {
        setError("Couldn't send the invite. Try again.");
      }
    } finally {
      setSending(false);
    }
  }

  async function revoke(id: string) {
    await apiFetch(`/invites/${id}`, { method: "DELETE" });
    await refetch();
  }

  return (
    <>
      <SectionHeading>Bookkeeper seat</SectionHeading>
      <section className="rounded-card border border-border bg-surface p-5">
        <p className="mb-3 text-xs text-body">
          One read-only bookkeeper seat is included with Pro. They can view and export,
          never mutate.
        </p>
        {invites && invites.length > 0 && (
          <div className="mb-3 flex flex-col gap-1.5">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between rounded-control border border-border-hairline px-3 py-2 text-[13px]"
              >
                <span>{invite.email}</span>
                <button
                  type="button"
                  onClick={() => void revoke(invite.id)}
                  className="border-0 bg-transparent p-0 text-xs font-semibold text-state-overdue"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="bookkeeper@example.com"
            aria-label="Bookkeeper email"
            className="flex-1 rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !email.trim()}
            className="rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-wash disabled:opacity-50"
          >
            Invite
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-state-overdue">{error}</p>}
      </section>
    </>
  );
}

function DataSection() {
  return (
    <>
      <SectionHeading>Your data</SectionHeading>
      <section className="flex items-center justify-between rounded-card border border-border bg-surface p-5">
        <p className="m-0 max-w-md text-xs text-body">
          Everything the Belastingdienst can ask for, as a machine-readable zip — your own
          7-year retention obligation, one download.
        </p>
        <DataExportButton label="Export everything (.zip)" />
      </section>
    </>
  );
}

function DeletionSection({
  deletionRequestedAt,
  onChanged,
}: {
  deletionRequestedAt: number | null;
  onChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);

  async function request() {
    if (
      !confirm(
        "Request account deletion? Your data will be permanently deleted in 30 days.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch("/orgs/deletion-request", { method: "POST" });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await apiFetch("/orgs/deletion-cancel", { method: "POST" });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionHeading>Account deletion</SectionHeading>
      <section className="mb-4 rounded-card border border-border bg-surface p-5">
        {deletionRequestedAt ? (
          <div>
            <p className="mb-3 text-sm text-state-overdue">
              Deletion requested on{" "}
              {new Date(deletionRequestedAt).toLocaleDateString("en-GB")}. Your account
              and all data will be permanently deleted 30 days after that date.
            </p>
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={busy}
              className="rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-wash disabled:opacity-50"
            >
              Cancel deletion
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs text-body">
              Deletes your account and all data 30 days from now — a full export is
              generated immediately so you always have your records. This can be cancelled
              any time before then.
            </p>
            <button
              type="button"
              onClick={() => void request()}
              disabled={busy}
              className="rounded-control border border-state-overdue-border px-3.5 py-2 text-[13px] font-semibold text-state-overdue hover:bg-state-overdue-bg disabled:opacity-50"
            >
              Request account deletion
            </button>
          </div>
        )}
      </section>
    </>
  );
}
