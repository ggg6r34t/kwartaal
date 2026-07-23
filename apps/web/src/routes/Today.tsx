import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { daysUntilDue, formatCents } from "@kwartaal/core";
import type { Quarter } from "@kwartaal/core";
import { apiFetch } from "../lib/api";
import { useQuarters } from "../hooks/useQuarters";
import { useDeadlines } from "../hooks/useDeadlines";
import { TermChip } from "../components/TermChip";
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
  const { deadlines, loading: deadlinesLoading } = useDeadlines();
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

  const now = useMemo(() => new Date(), []);

  const deadlineForQuarter = (quarterId: string) =>
    deadlines?.find((d) => d.quarterId === quarterId)?.dueDate;

  const incomeTaxDeadline = deadlines?.find((d) => d.kind === "income_tax");

  const focusQuarter = useMemo(() => {
    if (!quarters) return null;
    const actionable = quarters
      .filter((q) => q.status !== "handled_elsewhere" && q.status !== "paid")
      .sort((a, b) => a.q - b.q);
    return actionable[0] ?? null;
  }, [quarters]);

  const focusDueDate = focusQuarter ? deadlineForQuarter(focusQuarter.id) : undefined;
  const focusDays = focusDueDate ? daysUntilDue(focusDueDate, now) : null;

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
          <HeroCard
            quarter={focusQuarter}
            dueDate={focusDueDate}
            days={focusDays}
            onGoVat={() => navigate("/app/vat")}
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

          <SetAsideCard quarter={focusQuarter} />

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

function HeroCard({
  quarter,
  dueDate,
  days,
  onGoVat,
}: {
  quarter: Quarter | null;
  dueDate: string | undefined;
  days: number | null;
  onGoVat: () => void;
}) {
  if (!quarter || !dueDate || days === null) {
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

  return (
    <section
      aria-label="Next deadline"
      className={`mb-5 flex items-center gap-7 rounded-card border p-7 ${
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
          is due by {formatDueDate(dueDate)}.
        </h2>
        <p className="mb-[18px] text-sm leading-relaxed text-body">
          {overdue
            ? "Nothing is lost — the checklist still takes about 20 minutes."
            : "You'll need about 25 minutes."}
        </p>
        <button
          type="button"
          onClick={onGoVat}
          className={
            overdue || urgent
              ? "rounded-control bg-accent px-[18px] py-3 text-sm font-semibold text-white hover:bg-accent-hover"
              : "rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-ink hover:bg-wash"
          }
        >
          {overdue
            ? `Fix ${label} now`
            : urgent
              ? `Start the ${label} btw checklist`
              : `Preview the ${label} checklist`}
        </button>
      </div>
      <div className="flex-none text-right">
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

function SetAsideCard({ quarter }: { quarter: Quarter | null }) {
  // No Money/Pot tracking yet (Pillar 4) — before a quarter closes there's
  // no persisted rubriek total to show yet, so this stays informational.
  if (!quarter || quarter.rubriek5cCents === null) {
    return (
      <section className="mb-7 rounded-card border border-accent-border bg-accent-tint p-6">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Set aside for the Belastingdienst
        </div>
        <p className="m-0 text-sm text-body">
          Once you log invoices in {quarter ? `Q${quarter.q}` : "a quarter"}, the exact
          btw and your income-tax reserve show up here.
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
        Per-invoice set-aside tracking (the Money screen's running "yours / btw / reserve"
        split) lands in Pillar 4 — this is what Q{quarter.q}'s filed numbers came to.
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
