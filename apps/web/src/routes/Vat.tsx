import { useEffect, useMemo, useState } from "react";
import {
  computeQuarter,
  formatCents,
  korRollingTurnover,
  parseAmountToCents,
  type ExpenseLine,
  type IncomeLine,
  type PayQuarterResponse,
  type Quarter,
  type QuarterDetail,
  type VatRate,
} from "@kwartaal/core";
import { apiFetch } from "../lib/api";
import { useMe } from "../hooks/useMe";
import { useQuarters } from "../hooks/useQuarters";
import { TermChip } from "../components/TermChip";

const VAT_RATES: VatRate[] = [21, 9, 0];

export function Vat() {
  const { me } = useMe();
  const year = new Date().getFullYear();
  const {
    quarters,
    loading: quartersLoading,
    refetch: refetchQuarters,
  } = useQuarters(year);

  const korOptIn = me?.businessProfile?.korOptIn ?? false;

  const focusQuarter = useMemo(() => {
    if (!quarters) return null;
    return (
      quarters
        .filter((q) => q.status !== "handled_elsewhere")
        .sort((a, b) => a.q - b.q)
        .find((q) => q.status !== "paid") ??
      quarters.filter((q) => q.status === "paid").sort((a, b) => b.q - a.q)[0] ??
      null
    );
  }, [quarters]);

  if (quartersLoading || !quarters) {
    return <p className="text-sm text-body">Loading…</p>;
  }

  if (korOptIn) {
    return <KorScreen quarters={quarters} />;
  }

  if (!focusQuarter) {
    return <p className="text-sm text-body">Nothing to show yet.</p>;
  }

  return (
    <QuarterChecklist
      key={focusQuarter.id}
      quarterSummary={focusQuarter}
      onQuarterChanged={refetchQuarters}
    />
  );
}

function KorScreen({ quarters }: { quarters: Quarter[] }) {
  const [incomeLines, setIncomeLines] = useState<
    { amountExVatCents: number; date: string }[]
  >([]);

  useEffect(() => {
    // Aggregate this year's income across every non-handled-elsewhere quarter for the rolling-turnover bar.
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        quarters
          .filter((q) => q.status !== "handled_elsewhere")
          .map((q) => apiFetch<QuarterDetail>(`/quarters/${q.id}`)),
      );
      if (!cancelled) {
        setIncomeLines(results.flatMap((detail) => detail.incomeLines));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quarters]);

  const limitCents = 2_000_000;
  const progress = korRollingTurnover(incomeLines, new Date().getFullYear(), limitCents);
  const pct = Math.min(progress.pctBps / 100, 100);

  return (
    <div>
      <h1 className="m-0 mb-1.5 text-[30px] font-semibold tracking-tight">VAT — btw</h1>
      <p className="mb-7 max-w-xl text-sm leading-relaxed text-body">
        You're on the{" "}
        <TermChip
          nlTerm="KOR"
          definition="Kleineondernemersregeling — the small-business scheme."
        />{" "}
        — the small-business scheme.
      </p>
      <section className="mb-5 rounded-card border border-border bg-surface p-8">
        <h2 className="m-0 mb-2 text-xl font-semibold tracking-tight">
          Nothing to file this quarter.
        </h2>
        <p className="mb-6 max-w-lg text-sm leading-relaxed text-body">
          No btw on your invoices, no quarterly return. Kwartaal watches one number for
          you:
        </p>
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
          Rolling turnover · calendar year {new Date().getFullYear()}
        </div>
        <div className="mb-3 flex items-baseline gap-2.5">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatCents(progress.rollingTurnoverCents)}
          </span>
          <span className="text-sm text-body">
            of the {formatCents(limitCents)} limit
          </span>
        </div>
        <div className="mb-3 h-2 max-w-lg overflow-hidden rounded-full bg-wash">
          <div
            className="h-full rounded-full bg-state-settled"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="m-0 max-w-lg text-[13px] leading-relaxed text-body">
          Cross {formatCents(limitCents)} and the KOR ends: you charge btw from that
          invoice onward and quarterly returns start again. We'll flag it at 90%.
        </p>
      </section>
      <div className="mb-5 rounded-card border border-border bg-surface p-5 text-[13.5px] leading-relaxed text-body">
        The trade you accepted: no filings — and no{" "}
        <TermChip
          nlTerm="voorbelasting"
          definition="The btw you paid on business purchases — reclaimable, unless you're on the KOR."
        />{" "}
        reclaim on purchases.
      </div>
      <footer className="border-t border-border pt-4 text-xs text-faint">
        Estimates only. Figures: tax year {new Date().getFullYear()}.
      </footer>
    </div>
  );
}

type ChecklistStep = 1 | 2 | 3 | 4;

function QuarterChecklist({
  quarterSummary,
  onQuarterChanged,
}: {
  quarterSummary: Quarter;
  onQuarterChanged: () => void;
}) {
  const [detail, setDetail] = useState<QuarterDetail | null>(null);
  const [step, setStep] = useState<ChecklistStep>(1);
  const [whyOpen, setWhyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justClosed, setJustClosed] = useState(false);

  async function loadDetail() {
    const data = await apiFetch<QuarterDetail>(`/quarters/${quarterSummary.id}`);
    setDetail(data);
    return data;
  }

  // Reload only when the focus quarter itself changes (loadDetail is
  // recreated each render but isn't a real dependency of "which quarter").
  useEffect(() => {
    void loadDetail();
  }, [quarterSummary.id]);

  if (!detail) return <p className="text-sm text-body">Loading…</p>;

  const isClosed = detail.status === "filed" || detail.status === "paid";
  const computed = computeQuarter(detail.incomeLines, detail.expenseLines);

  async function reopen() {
    setBusy(true);
    try {
      await apiFetch(`/quarters/${quarterSummary.id}/reopen`, { method: "POST" });
      await loadDetail();
      onQuarterChanged();
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  if (detail.status === "paid" && !justClosed) {
    return (
      <ClosedCard quarter={detail} computed={computed} onReopen={reopen} busy={busy} />
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h1 className="m-0 text-[30px] font-semibold tracking-tight">
          VAT — Q{detail.q} {detail.year}
        </h1>
      </div>
      <p className="mb-7 max-w-xl text-sm leading-relaxed text-body">
        A guided checklist, not a form. It produces the numbers you type into Mijn
        Belastingdienst — nothing is filed from here. About 25 minutes.
      </p>

      <ChecklistCard
        stepNumber={1}
        title="Confirm income for the quarter"
        active={step === 1}
        done={step > 1}
        summary={
          step > 1
            ? `${detail.incomeLines.length} line(s) · ex btw ${formatCents(
                detail.incomeLines.reduce((s, l) => s + l.amountExVatCents, 0),
              )} · btw ${formatCents(computed.rubriek1aCents + computed.rubriek1bCents)}`
            : undefined
        }
        onEdit={() => setStep(1)}
        disabled={isClosed}
      >
        <LineEntry
          kind="income"
          quarterId={detail.id}
          lines={detail.incomeLines}
          onAdded={async () => {
            await loadDetail();
            onQuarterChanged();
          }}
        />
        <div className="flex px-6 pb-5 pt-2">
          <button
            type="button"
            disabled={detail.incomeLines.length === 0}
            onClick={() => setStep(2)}
            className="ml-auto rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            These are right → expenses
          </button>
        </div>
      </ChecklistCard>

      <ChecklistCard
        stepNumber={2}
        title="Confirm expenses with reclaimable btw"
        active={step === 2}
        done={step > 2}
        locked={step < 2}
        summary={
          step > 2 ? `voorbelasting ${formatCents(computed.rubriek5bCents)}` : undefined
        }
        onEdit={() => setStep(2)}
        disabled={isClosed}
      >
        <LineEntry
          kind="expense"
          quarterId={detail.id}
          lines={detail.expenseLines}
          onAdded={async () => {
            await loadDetail();
            onQuarterChanged();
          }}
        />
        <div className="flex px-6 pb-5 pt-2">
          <button
            type="button"
            onClick={() => setStep(3)}
            className="ml-auto rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-hover"
          >
            These are right → the mirror
          </button>
        </div>
      </ChecklistCard>

      <ChecklistCard
        stepNumber={3}
        title="The mirror"
        active={step === 3}
        done={step > 3}
        locked={step < 3}
        summary={
          step > 3
            ? `${formatCents(computed.rubriek1aCents + computed.rubriek1bCents)} − ${formatCents(computed.rubriek5bCents)} = you owe ${formatCents(computed.rubriek5cCents)}`
            : undefined
        }
        onEdit={() => setStep(3)}
        disabled={isClosed}
      >
        <p className="px-6 pb-1 text-xs text-body">
          What came in, what went out, what you owe.
        </p>
        <div className="grid grid-cols-2 gap-3.5 px-6 pt-2">
          <div className="rounded-control border border-border-hairline p-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              Btw you received
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatCents(computed.rubriek1aCents + computed.rubriek1bCents)}
            </div>
          </div>
          <div className="rounded-control border border-border-hairline p-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              Btw you paid
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatCents(computed.rubriek5bCents)}
            </div>
          </div>
        </div>
        <div className="mx-6 mt-3.5 flex items-center justify-between rounded-control border border-accent-border bg-accent-tint p-4">
          <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">
              You owe the Belastingdienst
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatCents(computed.rubriek5cCents)}
            </div>
          </div>
          <span className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
            estimate
          </span>
        </div>
        <button
          type="button"
          onClick={() => setWhyOpen((v) => !v)}
          className="mx-6 mt-3 block border-0 bg-transparent p-0 text-[12.5px] font-semibold text-accent"
        >
          Why these numbers?
        </button>
        {whyOpen && (
          <div className="mx-6 mt-2.5 text-[13px] leading-loose text-body tabular-nums">
            {detail.incomeLines.map((line) => (
              <div key={line.id}>
                {line.vatRate}% of {formatCents(line.amountExVatCents)} ={" "}
                {formatCents(line.vatCents)}
              </div>
            ))}
            <div>
              Received:{" "}
              <strong className="text-ink">
                {formatCents(computed.rubriek1aCents + computed.rubriek1bCents)}
              </strong>
            </div>
            <div>
              Minus voorbelasting:{" "}
              {formatCents(computed.rubriek1aCents + computed.rubriek1bCents)} −{" "}
              {formatCents(computed.rubriek5bCents)} ={" "}
              <strong className="text-ink">{formatCents(computed.rubriek5cCents)}</strong>
            </div>
          </div>
        )}
        <div className="flex px-6 pb-5 pt-4">
          <button
            type="button"
            onClick={() => setStep(4)}
            className="ml-auto rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-hover"
          >
            Looks right → prepare the handoff
          </button>
        </div>
      </ChecklistCard>

      <ChecklistCard
        stepNumber={4}
        title="Handoff to Mijn Belastingdienst"
        active={step === 4}
        done={false}
        locked={step < 4}
        onEdit={() => setStep(4)}
        disabled={false}
      >
        <HandoffPanel
          quarter={detail}
          computed={computed}
          onFiled={async () => {
            setBusy(true);
            try {
              await apiFetch(`/quarters/${quarterSummary.id}/file`, { method: "POST" });
              await loadDetail();
              onQuarterChanged();
            } finally {
              setBusy(false);
            }
          }}
          onPaid={async () => {
            setBusy(true);
            try {
              const response = await apiFetch<PayQuarterResponse>(
                `/quarters/${quarterSummary.id}/pay`,
                { method: "POST" },
              );
              await loadDetail();
              onQuarterChanged();
              if (response.firstQuarterJustClosed) setJustClosed(true);
            } finally {
              setBusy(false);
            }
          }}
          busy={busy}
        />
      </ChecklistCard>

      {justClosed && (
        <div
          role="status"
          className="animate-drawer-settle mb-5 rounded-card border border-state-settled-border bg-state-settled-bg p-6"
        >
          <h2 className="m-0 mb-1.5 text-lg font-semibold tracking-tight">
            Q{detail.q} is closed — that's your first quarter with Kwartaal.
          </h2>
          <p className="m-0 text-sm text-state-settled-ink">
            Filed, paid, and in the Vault for seven years.
          </p>
        </div>
      )}

      <footer className="border-t border-border pt-4 text-xs text-faint">
        Estimates only — Mijn Belastingdienst or your bookkeeper has the final word.
        Figures: tax year {detail.year}.
      </footer>
    </div>
  );
}

function ClosedCard({
  quarter,
  computed,
  onReopen,
  busy,
}: {
  quarter: QuarterDetail;
  computed: ReturnType<typeof computeQuarter>;
  onReopen: () => void;
  busy: boolean;
}) {
  return (
    <div>
      <h1 className="m-0 mb-6 text-[30px] font-semibold tracking-tight">
        VAT — Q{quarter.q} {quarter.year}
      </h1>
      <section className="animate-drawer-settle mb-5 flex items-start gap-5 rounded-card border border-state-settled-border bg-state-settled-bg p-7">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-state-settled text-white">
          ✓
        </div>
        <div className="flex-1">
          <h2 className="m-0 mb-1.5 text-xl font-semibold tracking-tight">
            Q{quarter.q} is closed.
          </h2>
          <p className="mb-3.5 text-sm text-state-settled-ink">
            Filed and paid. The numbers stay in your Vault for 7 years. Nothing to do
            until the next quarter.
          </p>
          <div className="mb-4 text-[13px] tabular-nums text-state-settled-ink">
            1a {formatCents(computed.rubriek1aCents)} · 1b{" "}
            {formatCents(computed.rubriek1bCents)} · 5b{" "}
            {formatCents(computed.rubriek5bCents)} · 5c{" "}
            {formatCents(computed.rubriek5cCents)}
          </div>
          <button
            type="button"
            onClick={onReopen}
            disabled={busy}
            className="rounded-control border border-state-settled-border px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-white disabled:opacity-50"
          >
            Reopen Q{quarter.q}
          </button>
        </div>
      </section>
    </div>
  );
}

function ChecklistCard({
  stepNumber,
  title,
  active,
  done,
  locked,
  summary,
  onEdit,
  disabled,
  children,
}: {
  stepNumber: number;
  title: string;
  active: boolean;
  done: boolean;
  locked?: boolean;
  summary?: string;
  onEdit: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (locked) {
    return (
      <div className="mb-3.5 overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex items-center gap-3.5 px-6 py-4 text-faint">
          <span className="text-xs font-bold tabular-nums">
            {String(stepNumber).padStart(2, "0")}
          </span>
          <span className="text-sm font-semibold">{title}</span>
          <span className="ml-auto text-xs">after step {stepNumber - 1}</span>
        </div>
      </div>
    );
  }

  if (done && !active) {
    return (
      <div className="mb-3.5 overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex items-center gap-3.5 px-6 py-4">
          <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-state-settled text-white">
            ✓
          </span>
          <div className="flex-1">
            <span className="text-sm font-semibold">{title}</span>
            {summary && (
              <span className="ml-2 text-[13px] tabular-nums text-body">· {summary}</span>
            )}
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={onEdit}
              className="border-0 bg-transparent p-0 text-[12.5px] font-semibold text-accent"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3.5 overflow-hidden rounded-card border border-border bg-surface">
      <div className="flex items-start gap-3.5 px-6 pb-3.5 pt-[18px]">
        <span className="pt-0.5 text-xs font-bold tabular-nums text-accent">
          {String(stepNumber).padStart(2, "0")}
        </span>
        <div className="text-[15px] font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

function LineEntry({
  kind,
  quarterId,
  lines,
  onAdded,
}: {
  kind: "income" | "expense";
  quarterId: string;
  lines: (IncomeLine | ExpenseLine)[];
  onAdded: () => Promise<void>;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [vatRate, setVatRate] = useState<VatRate>(21);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addLine() {
    setError(null);
    let amountExVatCents: number;
    try {
      amountExVatCents = parseAmountToCents(amountInput);
    } catch {
      setError("Enter a valid amount.");
      return;
    }
    if (!label.trim()) {
      setError(kind === "income" ? "Enter a description." : "Enter a supplier.");
      return;
    }

    setSubmitting(true);
    try {
      if (kind === "income") {
        await apiFetch(`/quarters/${quarterId}/income-lines`, {
          method: "POST",
          body: JSON.stringify({ date, description: label, amountExVatCents, vatRate }),
        });
      } else {
        await apiFetch(`/quarters/${quarterId}/expense-lines`, {
          method: "POST",
          body: JSON.stringify({
            date,
            supplier: label,
            amountExVatCents,
            vatRate,
            vatReclaimable: vatRate !== 0,
            isStartupCost: false,
            deductionMode: "expense",
          }),
        });
      }
      setLabel("");
      setAmountInput("");
      await onAdded();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {lines.length > 0 && (
        <div className="px-6">
          <div className="grid grid-cols-[1fr_100px_60px_100px] gap-3 border-b border-border-hairline pb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            <span>{kind === "income" ? "Invoice" : "Expense"}</span>
            <span className="text-right">Ex btw</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Btw</span>
          </div>
          {lines.map((line) => (
            <div
              key={line.id}
              className="grid grid-cols-[1fr_100px_60px_100px] gap-3 border-b border-border-hairline py-2.5 text-[13.5px] tabular-nums"
            >
              <span>{"description" in line ? line.description : line.supplier}</span>
              <span className="text-right">{formatCents(line.amountExVatCents)}</span>
              <span className="text-right text-body">{line.vatRate}%</span>
              <span className="text-right">{formatCents(line.vatCents)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2.5 px-6 py-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className="rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
        />
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={kind === "income" ? "Description" : "Supplier"}
          aria-label={kind === "income" ? "Description" : "Supplier"}
          className="min-w-[160px] flex-1 rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
        />
        <input
          type="text"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="0,00"
          aria-label="Amount ex btw"
          className="w-28 rounded-control border border-border-strong bg-surface px-3 py-2 text-right text-[13px] tabular-nums"
        />
        <div className="flex gap-1.5">
          {VAT_RATES.map((rate) => (
            <button
              key={String(rate)}
              type="button"
              onClick={() => setVatRate(rate)}
              className={`rounded-control border border-border-strong px-3 py-2 text-[13px] font-semibold ${
                vatRate === rate ? "bg-ink text-white" : "text-ink"
              }`}
            >
              {rate}%
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          disabled={submitting}
          className="rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-wash disabled:opacity-50"
        >
          Add {kind === "income" ? "invoice" : "expense"}
        </button>
      </div>
      {error && <p className="px-6 pb-3 text-xs text-state-overdue">{error}</p>}
    </div>
  );
}

function HandoffPanel({
  quarter,
  computed,
  onFiled,
  onPaid,
  busy,
}: {
  quarter: Quarter;
  computed: ReturnType<typeof computeQuarter>;
  onFiled: () => Promise<void>;
  onPaid: () => Promise<void>;
  busy: boolean;
}) {
  const filed = quarter.status === "filed" || quarter.status === "paid";
  const paid = quarter.status === "paid";

  return (
    <div>
      <p className="px-6 pb-1 text-xs text-body">
        Laid out exactly like the form — type these into the matching fields.
      </p>
      <div className="mx-6 mt-3 overflow-hidden rounded-control border border-border">
        <div className="grid grid-cols-[52px_1fr_100px_100px] gap-3 border-b border-border-hairline bg-paper px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
          <span>Rubriek</span>
          <span>Omschrijving</span>
          <span className="text-right">Omzet</span>
          <span className="text-right">Btw</span>
        </div>
        <HandoffRow
          code="1a"
          label="Hoog tarief (21%)"
          amount={computed.rubriek1aCents}
        />
        <HandoffRow code="1b" label="Laag tarief (9%)" amount={computed.rubriek1bCents} />
        <HandoffRow
          code="5b"
          label="Voorbelasting — btw you paid"
          amount={-computed.rubriek5bCents}
        />
        <div className="grid grid-cols-[52px_1fr_100px_100px] gap-3 bg-accent-tint px-4 py-3.5 text-sm font-semibold tabular-nums">
          <span className="font-mono text-xs">5c</span>
          <span>Totaal te betalen</span>
          <span />
          <span className="text-right">{formatCents(computed.rubriek5cCents)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2.5 px-6 pt-4">
        <a
          href="https://mijn.belastingdienst.nl"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-hover"
        >
          Open Mijn Belastingdienst ↗
        </a>
      </div>
      <div className="mx-6 mb-1.5 mt-4 overflow-hidden rounded-control border border-border-hairline">
        <button
          type="button"
          role="checkbox"
          aria-checked={filed}
          disabled={filed || busy}
          onClick={() => void onFiled()}
          className="flex w-full items-start gap-3 border-b border-border-hairline px-4 py-3.5 text-left hover:bg-paper disabled:cursor-default"
        >
          {filed ? (
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-state-settled text-white">
              ✓
            </span>
          ) : (
            <span className="h-[22px] w-[22px] flex-none rounded-md border-2 border-border-strong" />
          )}
          <span>
            <span className="block text-sm font-semibold">I filed it</span>
            <span className="mt-0.5 block text-xs text-body">
              The numbers are in Mijn Belastingdienst.
            </span>
          </span>
        </button>
        <button
          type="button"
          role="checkbox"
          aria-checked={paid}
          disabled={!filed || paid || busy}
          onClick={() => void onPaid()}
          className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-paper disabled:cursor-default disabled:opacity-50"
        >
          {paid ? (
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-state-settled text-white">
              ✓
            </span>
          ) : (
            <span className="h-[22px] w-[22px] flex-none rounded-md border-2 border-border-strong" />
          )}
          <span>
            <span className="block text-sm font-semibold">I paid it</span>
            <span className="mt-0.5 block text-xs tabular-nums text-body">
              {formatCents(computed.rubriek5cCents)} transferred with the payment
              reference.
            </span>
          </span>
        </button>
      </div>
      <p className="px-6 pb-5 text-xs text-faint">
        Two separate acts — filing tells them, paying settles it.
      </p>
    </div>
  );
}

function HandoffRow({
  code,
  label,
  amount,
}: {
  code: string;
  label: string;
  amount: number;
}) {
  return (
    <div className="grid grid-cols-[52px_1fr_100px_100px] gap-3 border-b border-border-hairline px-4 py-3 text-[13.5px] tabular-nums">
      <span className="font-mono text-xs font-semibold">{code}</span>
      <span>{label}</span>
      <span />
      <span className="text-right">{formatCents(amount)}</span>
    </div>
  );
}
