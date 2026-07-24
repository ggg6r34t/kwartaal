import { useEffect, useRef, useState } from "react";
import {
  formatCents,
  type ExportJob,
  type IncomeTaxStudioResponse,
} from "@kwartaal/core";
import { apiFetch, apiUrl } from "../lib/api";
import { useIncomeTax } from "../hooks/useIncomeTax";
import { TermChip } from "../components/TermChip";

/** Every figures-dependent field is non-null once figuresPending is false — narrowed once here so Studio doesn't repeat the null checks. */
type ResolvedIncomeTax = IncomeTaxStudioResponse & {
  figuresPending: false;
  waterfall: NonNullable<IncomeTaxStudioResponse["waterfall"]>;
  taxableCents: number;
  bracketFills: NonNullable<IncomeTaxStudioResponse["bracketFills"]>;
  zvwCents: number;
  creditsCents: number;
  setAsideCents: number;
};

export function IncomeTax() {
  const year = new Date().getFullYear();
  const { data, loading } = useIncomeTax(year);

  if (loading || !data) {
    return <p className="text-sm text-body">Loading…</p>;
  }

  if (data.figuresPending || !data.waterfall || !data.bracketFills) {
    return (
      <FiguresPending
        year={year}
        revenueCents={data.revenueCents}
        costsCents={data.costsCents}
        hoursLogged={data.hoursLogged}
      />
    );
  }

  return <Studio year={year} data={data as ResolvedIncomeTax} />;
}

function Bar({ pct, className }: { pct: number; className: string }) {
  return (
    <div className="h-5 overflow-hidden rounded-md bg-wash">
      <div
        className={`h-full rounded-md ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function FiguresPending({
  year,
  revenueCents,
  costsCents,
  hoursLogged,
}: {
  year: number;
  revenueCents: number;
  costsCents: number;
  hoursLogged: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h1 className="m-0 text-[30px] font-semibold tracking-tight">Income tax</h1>
        <span className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
          Figures: tax year {year} — pending
        </span>
      </div>
      <p className="mb-7 max-w-xl text-sm leading-relaxed text-body">
        Your income-tax year, walked through — once the official rates exist.
      </p>
      <section className="mb-6 flex max-w-2xl items-start gap-4 rounded-card border border-pending-callout-border bg-pending-callout-bg p-6">
        <span
          aria-hidden="true"
          className="mt-0.5 h-[22px] w-[22px] flex-none rounded-full border-2 border-dashed bg-paper"
          style={{ borderColor: "var(--color-pending-callout-icon)" }}
        />
        <div>
          <div className="mb-1 text-[14.5px] font-semibold">
            The {year} rates haven't been published into Kwartaal yet.
          </div>
          <p className="m-0 text-[13.5px] leading-relaxed text-body">
            Your calendar and btw quarters are unaffected — they don't depend on these
            figures. We'll email you the day the studio opens for {year}, usually within
            days of the Belastingdienst publishing.
          </p>
        </div>
      </section>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="rounded-card border border-dashed border-pending-border bg-surface p-6">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Revenue so far
          </div>
          <div className="text-2xl font-semibold tabular-nums text-pending-figure">
            {formatCents(revenueCents)}
          </div>
        </div>
        <div className="rounded-card border border-dashed border-pending-border bg-surface p-6">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Costs so far
          </div>
          <div className="text-2xl font-semibold tabular-nums text-pending-figure">
            {formatCents(costsCents)}
          </div>
          <div className="mt-3 text-xs text-faint">
            Hours logged: <span className="tabular-nums text-body">{hoursLogged}</span> so
            far toward the urencriterium.
          </div>
        </div>
      </div>
      <footer className="mt-8 border-t border-border pt-4 text-xs text-faint">
        Estimates only. Figures: tax year {year}.
      </footer>
    </div>
  );
}

function Studio({ year, data }: { year: number; data: ResolvedIncomeTax }) {
  const revenueCents = data.revenueCents;
  const bracketFills = data.bracketFills ?? [];
  const incomeTaxBeforeCredits = bracketFills.reduce(
    (sum, fill) => sum + fill.taxCents,
    0,
  );
  const incomeTaxAfterCredits = Math.max(0, incomeTaxBeforeCredits - data.creditsCents);
  const keptOutOfTax = data.profitCents - data.taxableCents;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h1 className="m-0 text-[30px] font-semibold tracking-tight">
          Income tax — {year}
        </h1>
      </div>
      <p className="mb-7 max-w-xl text-sm leading-relaxed text-body">
        The annual sit-down. Profit, then the deductions in their legal order, then one
        number to set aside. Every figure here is an estimate — the{" "}
        <TermChip
          nlTerm="aangifte"
          definition="The tax return itself — filed in Mijn Belastingdienst, not here."
        />{" "}
        itself happens in Mijn Belastingdienst.
      </p>

      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        1 · Profit
      </div>
      <section className="mb-7 rounded-card border border-border bg-surface p-6 tabular-nums">
        <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[160px_1fr_140px] sm:items-center sm:gap-4 py-2">
          <div className="text-sm font-semibold">Revenue</div>
          <Bar pct={100} className="bg-border-strong" />
          <div className="text-right text-sm font-semibold">
            {formatCents(revenueCents)}
          </div>
        </div>
        <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[160px_1fr_140px] sm:items-center sm:gap-4 py-2">
          <div>
            <div className="text-sm font-semibold">Costs</div>
            <div className="text-xs text-faint">from your Vault — {year} so far</div>
          </div>
          <Bar
            pct={revenueCents ? (data.costsCents / revenueCents) * 100 : 0}
            className="bg-border-strong"
          />
          <div className="text-right text-sm text-body">
            −{formatCents(data.costsCents)}
          </div>
        </div>
        <div className="mt-1.5 grid grid-cols-1 items-start gap-1 sm:grid-cols-[160px_1fr_140px] sm:items-center sm:gap-4 border-t border-border-hairline py-2 pt-3.5">
          <div className="text-sm font-semibold">Profit</div>
          <Bar
            pct={revenueCents ? (data.profitCents / revenueCents) * 100 : 0}
            className="bg-sand"
          />
          <div className="text-right text-[15px] font-semibold">
            {formatCents(data.profitCents)}
          </div>
        </div>
      </section>

      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        2 · The deduction stack — in this order
      </div>
      <section className="mb-3.5 rounded-card border border-border bg-surface p-6 tabular-nums">
        {data.waterfall.map((step, i) => (
          <div
            key={i}
            className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[230px_1fr_190px] sm:items-center sm:gap-4 border-b border-border-hairline py-3 last:border-b-0"
          >
            <div>
              <div className="text-sm font-semibold">{step.label}</div>
              <div
                className={`mt-0.5 text-xs font-semibold ${step.eligible ? "text-state-settled" : "text-body"}`}
              >
                {step.eligible ? "✓ " : ""}
                {step.reason ?? (step.eligible ? "Eligible" : "Not eligible")}
              </div>
            </div>
            <Bar
              pct={
                data.profitCents ? (step.runningTotalCents / data.profitCents) * 100 : 0
              }
              className="bg-state-settled"
            />
            <div className="text-right">
              <span className="text-[13.5px] font-semibold text-state-settled">
                −{formatCents(step.amountCents)}
              </span>
              <span className="text-[13.5px] text-body">
                {" "}
                → {formatCents(step.runningTotalCents)}
              </span>
            </div>
          </div>
        ))}
        <div className="mt-1.5 grid grid-cols-1 items-start gap-1 sm:grid-cols-[230px_1fr_190px] sm:items-center sm:gap-4 border-t border-border-hairline py-3 pt-4">
          <div className="text-sm font-semibold">Taxable income</div>
          <Bar
            pct={data.profitCents ? (data.taxableCents / data.profitCents) * 100 : 0}
            className="bg-ink"
          />
          <div className="text-right text-[15px] font-semibold">
            ± {formatCents(data.taxableCents)}
          </div>
        </div>
      </section>
      <div className="mb-7 flex items-baseline gap-2 text-[13px] text-body">
        <span
          aria-hidden="true"
          className="h-3 w-3 flex-none translate-y-0.5 rounded-[4px] bg-state-settled"
        />
        The deductions keep{" "}
        <strong className="text-ink">{formatCents(keptOutOfTax)}</strong> of profit out of
        the tax entirely.
      </div>

      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        3 · Poured through the {year} brackets
      </div>
      <section className="mb-3.5 rounded-card border border-border bg-surface p-6 tabular-nums">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
          {bracketFills.map((fill, i) => (
            <div key={i}>
              <div className="mb-2.5 flex h-[110px] items-end overflow-hidden rounded-b-[10px] rounded-t-none border border-t-0 border-border-strong">
                <div
                  className={`w-full ${fill.filledCents > 0 ? "bg-wash" : ""}`}
                  style={{
                    height: `${bracketFills[0] && bracketFills[0].uptoCents ? Math.min(100, (fill.filledCents / bracketFills[0].uptoCents) * 100 || (fill.filledCents > 0 ? 100 : 0)) : fill.filledCents > 0 ? 100 : 0}%`,
                  }}
                />
              </div>
              <div className="text-[13px] font-semibold">
                {(fill.rateBps / 100).toLocaleString("nl-NL")}%{" "}
                <span className="font-normal text-body">
                  {fill.uptoCents === null
                    ? "and above"
                    : `to ${formatCents(fill.uptoCents)}`}
                </span>
              </div>
              <div className="text-[12.5px] text-body">
                tax here: {formatCents(fill.taxCents)}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border-hairline pt-1.5">
          <div className="flex justify-between py-2.5 text-sm">
            <span>Income tax before credits</span>
            <span className="font-semibold">{formatCents(incomeTaxBeforeCredits)}</span>
          </div>
          <div className="flex justify-between py-2.5 text-sm text-body">
            <span>Credits (general tax credit + arbeidskorting, est.)</span>
            <span>−{formatCents(data.creditsCents)}</span>
          </div>
          <div className="flex justify-between border-t border-border-hairline py-2.5 text-sm">
            <span className="font-semibold">Income tax</span>
            <span className="font-semibold">{formatCents(incomeTaxAfterCredits)}</span>
          </div>
          <div className="flex justify-between py-2.5 text-sm">
            <span>
              <TermChip
                nlTerm="Zvw-bijdrage"
                definition="Income-dependent healthcare-insurance contribution — 4,85% of profit, billed separately."
              />{" "}
              <span className="text-xs text-faint">
                4,85% of profit — its own separate bill
              </span>
            </span>
            <span>+{formatCents(data.zvwCents)}</span>
          </div>
        </div>
      </section>

      <section className="bg-not-yours mb-7 rounded-card border border-accent-border bg-accent-tint p-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              Estimated tax to set aside for {year}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-[34px] font-semibold tracking-tight tabular-nums">
                {formatCents(data.setAsideCents)}
              </span>
              <span className="text-sm tabular-nums text-body">
                ≈ {formatCents(Math.round(data.setAsideCents / 12))} per month
              </span>
            </div>
            <p className="mb-0 mt-2.5 max-w-lg text-[13px] leading-relaxed text-body">
              This is an estimate; your bookkeeper or the Belastingdienst has the final
              word.
            </p>
          </div>
          <span className="flex-none rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
            estimate
          </span>
        </div>
      </section>

      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        4 · Handoff
      </div>
      <section className="mb-5 overflow-hidden rounded-card border border-border bg-surface">
        <HandoffRow>
          File from <strong>1 March {year + 1}</strong> in Mijn Belastingdienst — log in
          with <strong>DigiD</strong> (eenmanszaak). VOF and BV use eHerkenning.
        </HandoffRow>
        <HandoffRow>
          Check the pre-filled return line by line: bank balances, any{" "}
          <TermChip
            nlTerm="voorlopige aanslag"
            definition="A provisional assessment — income tax paid in monthly installments during the year instead of one lump sum after filing."
          />{" "}
          payments already made, and your Zvw assessment.
        </HandoffRow>
        <HandoffRow>
          Need more time? Request an extension (<em>uitstel</em>) before 1 May — it's
          routine, not a red flag.
        </HandoffRow>
        <BookkeeperExportRow year={year} />
      </section>
      <footer className="border-t border-border pt-4 text-xs text-faint">
        Estimates only — your bookkeeper or the Belastingdienst has the final word.
        Figures: tax year {year}.
      </footer>
    </div>
  );
}

function HandoffRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 border-b border-border-hairline px-6 py-4 last:border-b-0">
      <span
        aria-hidden="true"
        className="mt-1.5 h-2 w-2 flex-none rounded-full border-2 border-border-strong"
      />
      <div className="text-[13.5px] leading-relaxed">{children}</div>
    </div>
  );
}

function BookkeeperExportRow({ year }: { year: number }) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function requestExport() {
    setError(null);
    try {
      const created = await apiFetch<ExportJob>("/export-jobs", {
        method: "POST",
        body: JSON.stringify({ kind: "bookkeeper_summary", year }),
      });
      setJob(created);
      pollRef.current = setInterval(async () => {
        const jobs = await apiFetch<ExportJob[]>("/export-jobs");
        const latest = jobs.find((j) => j.id === created.id);
        if (latest && (latest.status === "completed" || latest.status === "failed")) {
          setJob(latest);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 3000);
    } catch {
      setError("Couldn't start the export. Try again.");
    }
  }

  return (
    <div className="flex items-center gap-3.5 px-6 py-4">
      <span
        aria-hidden="true"
        className="h-2 w-2 flex-none rounded-full border-2 border-border-strong"
      />
      <div className="flex-1 text-[13.5px] leading-relaxed">Or hand it off entirely:</div>
      {!job && (
        <button
          type="button"
          onClick={() => void requestExport()}
          className="rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-wash"
        >
          Export this summary for my bookkeeper
        </button>
      )}
      {job && job.status !== "completed" && job.status !== "failed" && (
        <span className="text-[13px] text-body">Preparing…</span>
      )}
      {job && job.status === "completed" && (
        <a
          href={apiUrl(`/export-jobs/${job.id}/file`)}
          className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover"
        >
          Download PDF
        </a>
      )}
      {job && job.status === "failed" && (
        <span className="text-[13px] text-state-overdue">Export failed — try again.</span>
      )}
      {error && <span className="text-[13px] text-state-overdue">{error}</span>}
    </div>
  );
}
