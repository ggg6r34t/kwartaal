import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { daysUntilDue, formatCents } from "@kwartaal/core";
import type { DeadlineRow, Quarter, SetAsideEntry } from "@kwartaal/core";
import { apiFetch } from "../lib/api";
import { useQuarters } from "../hooks/useQuarters";
import { useDeadlines } from "../hooks/useDeadlines";
import { useSetAsideEntries } from "../hooks/useSetAsideEntries";
import { useIncomeTax } from "../hooks/useIncomeTax";
import { TermChip } from "../components/TermChip";
import { ExplainNote } from "../components/ExplainNote";
import { YearTimeline, type TimelineNode } from "../components/YearTimeline";
import { quarterTimelineState } from "../lib/quarter-timeline";

const QUARTER_LABELS: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4" };

export function Today() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const {
    quarters,
    loading: quartersLoading,
    refetch: refetchQuarters,
  } = useQuarters(year);
  const {
    deadlines,
    loading: deadlinesLoading,
    refetch: refetchDeadlines,
  } = useDeadlines();
  const { entries: setAsideEntries, refetch: refetchSetAsideEntries } =
    useSetAsideEntries();
  const { data: incomeTaxData } = useIncomeTax(year);
  const [reopening, setReopening] = useState<string | null>(null);

  async function reopenQuarter(quarterId: string) {
    setReopening(quarterId);
    try {
      await apiFetch(`/quarters/${quarterId}/reopen`, { method: "POST" });
      await refetchQuarters();
    } finally {
      setReopening(null);
    }
  }

  async function requestRemindTonight(deadlineId: string) {
    await apiFetch(`/deadlines/${deadlineId}/remind-tonight`, { method: "POST" });
    await refetchDeadlines();
  }

  async function undoRemindTonight(deadlineId: string) {
    await apiFetch(`/deadlines/${deadlineId}/remind-tonight`, { method: "DELETE" });
    await refetchDeadlines();
  }

  async function confirmSetAsideEntry(entryId: string) {
    await apiFetch(`/money/set-aside-entries/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "confirmed" }),
    });
    await refetchSetAsideEntries();
  }

  const now = useMemo(() => new Date(), []);

  const deadlineForQuarter = (quarterId: string): DeadlineRow | undefined =>
    deadlines?.find((d) => d.quarterId === quarterId);

  const incomeTaxDeadline = deadlines?.find((d) => d.kind === "income_tax");

  const focusQuarter = useMemo(() => {
    if (!quarters) return null;
    const actionable = quarters
      .filter((q) => q.status !== "handled_elsewhere" && q.status !== "paid")
      .sort((a, b) => a.q - b.q);
    return actionable[0] ?? null;
  }, [quarters]);

  const focusDeadline = focusQuarter ? deadlineForQuarter(focusQuarter.id) : undefined;
  const focusDays = focusDeadline ? daysUntilDue(focusDeadline.dueDate, now) : null;

  const loading = quartersLoading || deadlinesLoading;

  return (
    <div>
      <div className="mb-7 flex items-baseline justify-between">
        <h1 className="m-0 text-[30px] font-semibold tracking-tight">Today</h1>
        <div className="text-[13px] tabular-nums text-body">
          {now.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </div>
      </div>

      {loading && <p className="text-sm text-body">Loading…</p>}

      {!loading && quarters && (
        <>
          <ExplainNote>
            One card, one action. Kwartaal never asks two things at once — everything
            below the hero card is orientation, not obligation.
          </ExplainNote>

          <PinnedSplitsBanner
            entries={setAsideEntries ?? []}
            onConfirm={confirmSetAsideEntry}
          />

          <HeroCard
            quarter={focusQuarter}
            deadline={focusDeadline}
            days={focusDays}
            onGoVat={() => navigate("/app/vat")}
            onRemindTonight={requestRemindTonight}
            onUndoRemindTonight={undoRemindTonight}
          />

          <section
            aria-label="Year timeline"
            className="mb-5 rounded-card border border-border bg-surface p-6"
          >
            <div className="mb-5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              {year} at a glance
            </div>
            <YearTimeline
              nodes={buildTimelineNodes(
                quarters,
                deadlines ?? [],
                incomeTaxDeadline?.dueDate,
                now,
                reopenQuarter,
              )}
            />
            {reopening && (
              <p className="mt-3 text-xs text-faint">
                Logging this quarter into Kwartaal…
              </p>
            )}
          </section>

          <ExplainNote>
            The year is the interface: four drawers and one annual return. A closed drawer
            is the whole reward — no badges, no streaks.
          </ExplainNote>

          <SetAsideCard quarter={focusQuarter} entries={setAsideEntries ?? []} />

          <ExplainNote>
            Btw is hatched everywhere in Kwartaal: it passes through your account, but it
            was never yours.
          </ExplainNote>

          <HoursTallyRow
            logged={incomeTaxData?.hoursLogged ?? 0}
            target={incomeTaxData?.hoursTarget ?? 1225}
            onLog={() => navigate("/app/vault")}
          />

          <footer className="border-t border-border pt-4 text-xs leading-relaxed text-faint">
            Kwartaal guides, estimates and reminds. It never files for you — Mijn
            Belastingdienst or your bookkeeper has the final word. · Figures: tax year{" "}
            {year}.
          </footer>
        </>
      )}
    </div>
  );
}

/** Moment 3.5 — a payment split logged as "remind me tonight" pins here until confirmed moved. */
export function PinnedSplitsBanner({
  entries,
  onConfirm,
}: {
  entries: SetAsideEntry[];
  onConfirm: (entryId: string) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const pending = entries.filter((e) => e.status === "pending");
  if (pending.length === 0) return null;

  // Unbounded growth here (every "remind me tonight" that's never
  // confirmed stays pinned) would eventually crowd out the rest of
  // Today — show the most recent few by default, with an explicit
  // opt-in to see the rest rather than silently truncating them.
  const VISIBLE_CAP = 3;
  const visible = showAll ? pending : pending.slice(0, VISIBLE_CAP);
  const hiddenCount = pending.length - visible.length;
  const hiddenCents = pending
    .slice(VISIBLE_CAP)
    .reduce((sum, e) => sum + e.vatCents + e.reserveCents, 0);

  async function confirm(id: string) {
    setConfirming(id);
    try {
      await onConfirm(id);
    } finally {
      setConfirming(null);
    }
  }

  return (
    <section
      aria-label="Pinned split"
      className="mb-5 rounded-card border border-accent-border bg-accent-tint p-6"
    >
      <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        Not yet moved
      </div>
      {visible.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-col gap-2.5 border-b border-border-hairline py-2.5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="m-0 text-sm text-body">
            {entry.invoiceRef} — move{" "}
            <strong className="text-ink">
              {formatCents(entry.vatCents + entry.reserveCents)}
            </strong>{" "}
            to the Taxes pot.
          </p>
          <button
            type="button"
            disabled={confirming === entry.id}
            onClick={() => void confirm(entry.id)}
            className="min-h-[44px] flex-none rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            I moved it — done
          </button>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2.5 border-0 bg-transparent p-0 text-[13px] font-semibold text-accent"
        >
          +{hiddenCount} more · {formatCents(hiddenCents)} total →
        </button>
      )}
    </section>
  );
}

function HoursTallyRow({
  logged,
  target,
  onLog,
}: {
  logged: number;
  target: number;
  onLog: () => void;
}) {
  const onPace = target > 0 ? logged / target >= 0.5 : true;
  return (
    <section
      aria-label="Hours tally"
      className="mb-7 flex items-center justify-between rounded-card border border-border bg-surface px-6 py-4"
    >
      <p className="m-0 text-[13.5px] tabular-nums text-body">
        Hours: <strong className="text-ink">{logged}</strong> of {target}
        {onPace ? " — on pace" : ""}
      </p>
      <button
        type="button"
        onClick={onLog}
        className="border-0 bg-transparent p-0 text-[13px] font-semibold text-accent"
      >
        Log →
      </button>
    </section>
  );
}

function HeroCard({
  quarter,
  deadline,
  days,
  onGoVat,
  onRemindTonight,
  onUndoRemindTonight,
}: {
  quarter: Quarter | null;
  deadline: DeadlineRow | undefined;
  days: number | null;
  onGoVat: () => void;
  onRemindTonight: (deadlineId: string) => Promise<void>;
  onUndoRemindTonight: (deadlineId: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  if (!quarter || !deadline || days === null) {
    return (
      <section className="mb-5 rounded-card border border-border bg-surface p-7">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
          All caught up
        </div>
        <h2 className="m-0 mb-2 text-xl font-semibold tracking-tight">
          Nothing needs you right now.
        </h2>
        <p className="m-0 text-sm text-body">
          Kwartaal will let you know when it's time.
        </p>
      </section>
    );
  }

  const label = QUARTER_LABELS[quarter.q] ?? `Q${quarter.q}`;
  const urgent = days <= 14;
  const overdue = days < 0;
  const reminderPending = !!deadline.sameDayReminderRequestedAt;

  async function remindTonight() {
    setBusy(true);
    try {
      await onRemindTonight(deadline!.id);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    try {
      await onUndoRemindTonight(deadline!.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Next deadline"
      className={`mb-5 flex flex-col gap-6 rounded-card border p-7 md:flex-row md:items-center md:gap-7 ${
        overdue
          ? "border-state-overdue-border bg-state-overdue-bg"
          : urgent
            ? "border-accent-border bg-surface"
            : "border-border bg-surface"
      }`}
    >
      <div className="flex-1">
        <div
          className={`mb-2.5 text-[11px] font-semibold uppercase tracking-wide ${
            overdue ? "text-state-overdue" : urgent ? "text-accent" : "text-faint"
          }`}
        >
          {overdue ? "Overdue" : `Next deadline · ${days} days`}
        </div>
        <h2 className="m-0 mb-2 text-xl font-semibold leading-tight tracking-tight">
          {label}{" "}
          <TermChip nlTerm="btw" definition="Belasting toegevoegde waarde — Dutch VAT." />{" "}
          is due by {formatDueDate(deadline.dueDate)}.
        </h2>
        <p className="mb-[18px] text-sm leading-relaxed text-body">
          {overdue
            ? "Nothing is lost — the checklist still takes about 20 minutes."
            : "You'll need about 25 minutes."}
        </p>

        {urgent && !overdue ? (
          reminderPending ? (
            <div className="rounded-control border border-state-settled-border bg-state-settled-bg p-4">
              <p className="m-0 mb-2 text-sm font-semibold text-state-settled-ink">
                Reminder set for 19:00. It reopens this checklist on your laptop.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void undo()}
                className="border-0 bg-transparent p-0 text-[13px] font-semibold text-accent underline disabled:opacity-50"
              >
                Undo
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <button
                type="button"
                disabled={busy}
                onClick={() => void remindTonight()}
                className="min-h-[44px] flex-1 rounded-control bg-accent px-[18px] py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                Remind me at my laptop tonight
              </button>
              <button
                type="button"
                onClick={onGoVat}
                className="min-h-[44px] flex-1 rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-wash"
              >
                Start on the phone anyway
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={onGoVat}
            className={
              overdue
                ? "min-h-[44px] rounded-control bg-accent px-[18px] py-3 text-sm font-semibold text-white hover:bg-accent-hover"
                : "min-h-[44px] rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-wash"
            }
          >
            {overdue ? `Fix ${label} now` : `Preview the ${label} checklist`}
          </button>
        )}
      </div>
      <div className="flex-none md:text-right">
        <div className="text-[44px] font-semibold leading-none tracking-tight tabular-nums">
          {overdue ? "!" : days}
        </div>
        <div className="mt-1 text-xs text-body">
          {overdue ? "days overdue" : "days left"}
        </div>
      </div>
    </section>
  );
}

function SetAsideCard({
  quarter,
  entries,
}: {
  quarter: Quarter | null;
  entries: SetAsideEntry[];
}) {
  if (!quarter) {
    return (
      <section className="mb-7 rounded-card border border-accent-border bg-accent-tint p-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Set aside for the Belastingdienst
        </div>
        <p className="m-0 text-sm text-body">
          Once you log invoices in a quarter, the exact btw and your income-tax reserve
          show up here.
        </p>
      </section>
    );
  }

  // Before a quarter is filed, "set aside so far" is a running register
  // against the Money splits logged this cycle: confirmed entries are
  // money actually moved; pending entries (still pinned — see
  // PinnedSplitsBanner) are what's identified but not yet moved, so they
  // count toward the target without counting toward progress.
  if (quarter.rubriek5cCents === null) {
    const confirmedCents = entries
      .filter((e) => e.status === "confirmed")
      .reduce((sum, e) => sum + e.vatCents + e.reserveCents, 0);
    const targetCents = entries.reduce((sum, e) => sum + e.vatCents + e.reserveCents, 0);
    const remainingCents = Math.max(0, targetCents - confirmedCents);
    const pct = targetCents > 0 ? Math.min(100, (confirmedCents / targetCents) * 100) : 0;

    if (targetCents === 0) {
      return (
        <section className="mb-7 rounded-card border border-accent-border bg-accent-tint p-6">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Set aside for the Belastingdienst
          </div>
          <p className="m-0 text-sm text-body">
            Once you log invoices in Q{quarter.q}, the exact btw and your income-tax
            reserve show up here.
          </p>
        </section>
      );
    }

    return (
      <section className="mb-7 rounded-card border border-accent-border bg-accent-tint p-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Set aside for the Belastingdienst
        </div>
        <div className="mb-2.5 flex items-baseline gap-2 text-sm text-body">
          <span className="text-xl font-semibold tabular-nums text-ink">
            {formatCents(confirmedCents)}
          </span>
          <span>of {formatCents(targetCents)}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2.5 overflow-hidden rounded-pill bg-surface"
        >
          <div
            className="h-full rounded-pill bg-accent [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,0.35)_3px,rgba(255,255,255,0.35)_6px)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="m-0 mt-2.5 text-sm text-body">
          {remainingCents > 0
            ? `Move ${formatCents(remainingCents)} more and Q${quarter.q} is covered.`
            : `Q${quarter.q} is covered.`}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-7 rounded-card border border-accent-border bg-accent-tint p-6">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        {quarter.status === "paid" ? `Q${quarter.q} — settled` : `Q${quarter.q} — filed`}
      </div>
      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {formatCents(quarter.rubriek5cCents)}
        </span>
        <span className="text-sm text-body">
          {quarter.status === "paid" ? "paid to the Belastingdienst" : "to pay"}
        </span>
      </div>
      <p className="m-0 text-sm text-body">
        This is what Q{quarter.q}'s filed numbers came to.
      </p>
    </section>
  );
}

function formatDueDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${day} ${months[(month ?? 1) - 1]}`;
}

function buildTimelineNodes(
  quarters: Quarter[],
  deadlines: { quarterId: string | null; dueDate: string }[],
  incomeTaxDueDate: string | undefined,
  now: Date,
  onReopen: (quarterId: string) => void,
): TimelineNode[] {
  const nodes: TimelineNode[] = quarters
    .sort((a, b) => a.q - b.q)
    .map((quarter) => {
      const dueDate = deadlines.find((d) => d.quarterId === quarter.id)?.dueDate ?? "";
      const { state, stateLabel, daysLeft } = dueDate
        ? quarterTimelineState(quarter, dueDate, now)
        : { state: "future" as const, stateLabel: "" as string, daysLeft: undefined };
      return {
        key: quarter.id,
        label: QUARTER_LABELS[quarter.q] ?? `Q${quarter.q}`,
        dueLabel: dueDate ? formatDueDate(dueDate) : "",
        state,
        stateLabel,
        daysLeft,
        // "Log this quarter in Kwartaal instead" — the only action a
        // handled_elsewhere node offers (App Additions design). Never
        // wired for other states here; filing/paying happens on the VAT
        // screen, not from the timeline node itself.
        onClick: state === "handledElsewhere" ? () => onReopen(quarter.id) : undefined,
      };
    });

  if (incomeTaxDueDate) {
    nodes.push({
      key: "income-tax",
      label: `IB ${new Date().getFullYear()}`,
      dueLabel: formatDueDate(incomeTaxDueDate),
      state: "future",
      stateLabel: "",
    });
  }

  return nodes;
}
