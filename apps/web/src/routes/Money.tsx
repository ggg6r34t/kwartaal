import { useCallback, useEffect, useState } from "react";
import {
  formatCents,
  parseAmountToCents,
  splitInvoice,
  type Pot,
  type VoorlopigeAanslag,
} from "@kwartaal/core";
import { apiFetch } from "../lib/api";
import { TermChip } from "../components/TermChip";

const VAT_RATES = [21, 9, 0] as const;
type VatRate = (typeof VAT_RATES)[number];

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function Money() {
  const year = new Date().getFullYear();

  return (
    <div>
      <h1 className="m-0 mb-1.5 text-[30px] font-semibold tracking-tight">Money</h1>
      <p className="mb-7 max-w-xl text-sm leading-relaxed text-body">
        When an invoice is paid, split it before it feels like yours: the btw exactly,
        plus your income-tax reserve. No bank connection — a 30-second ritual, not
        bookkeeping.
      </p>

      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        1 · When an invoice is paid
      </div>
      <Splitter onLogged={() => {}} />

      <PotsSection />

      <VoorlopigeAanslagSection year={year} />

      <footer className="border-t border-border pt-4 text-xs text-faint">
        Estimates only. Figures: tax year {year}.
      </footer>
    </div>
  );
}

function Splitter({ onLogged }: { onLogged: () => void }) {
  const [totalInput, setTotalInput] = useState("2.420,00");
  const [vatRate, setVatRate] = useState<VatRate>(21);
  const [reservePct, setReservePct] = useState(30);
  const [invoiceRef, setInvoiceRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<"confirmed" | "pending" | null>(null);
  const [error, setError] = useState<string | null>(null);

  let totalCents = 0;
  try {
    totalCents = parseAmountToCents(totalInput);
  } catch {
    totalCents = 0;
  }
  const split = splitInvoice(totalCents, vatRate, reservePct * 100);
  const yoursPct = totalCents ? (split.yoursCents / totalCents) * 100 : 0;
  const btwPct = totalCents ? (split.vatCents / totalCents) * 100 : 0;
  const resPct = totalCents ? (split.reserveCents / totalCents) * 100 : 0;
  const toMoveCents = split.vatCents + split.reserveCents;

  async function logSplit(status: "confirmed" | "pending") {
    setError(null);
    if (!invoiceRef.trim()) {
      setError("Add an invoice reference to log this split.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/money/set-aside-entries", {
        method: "POST",
        body: JSON.stringify({
          invoiceRef,
          totalCents,
          vatRate,
          reserveRateBps: reservePct * 100,
          status,
        }),
      });
      setSaved(status);
      setInvoiceRef("");
      onLogged();
      setTimeout(() => setSaved(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-7 rounded-card border border-border bg-surface p-6">
      <div className="mb-5 text-[13px] text-body">
        A client just paid you{" "}
        <strong className="text-ink">
          {totalCents > 0 ? formatCents(totalCents) : "€…"}
        </strong>
        ?
      </div>
      <div className="mb-5 flex flex-wrap items-end gap-6">
        <div>
          <label
            htmlFor="calc-amt"
            className="mb-1.5 block text-xs font-semibold text-body"
          >
            Invoice total (incl. btw)
          </label>
          <input
            id="calc-amt"
            value={totalInput}
            onChange={(e) => setTotalInput(e.target.value)}
            inputMode="decimal"
            className="w-40 rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-[15px] font-semibold tabular-nums"
          />
          <div className="mt-1 text-[11px] text-faint">
            1.234,56 — comma or period both work
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-semibold text-body">Btw rate</div>
          <div className="flex gap-1.5">
            {VAT_RATES.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setVatRate(rate)}
                className={`rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold ${
                  vatRate === rate ? "bg-ink text-white" : "text-ink"
                }`}
              >
                {rate}%
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="mb-1.5 flex justify-between text-xs font-semibold text-body">
            <span>Income-tax reserve</span>
            <span className="tabular-nums text-ink">{reservePct}% of ex-btw</span>
          </div>
          <input
            type="range"
            min={25}
            max={35}
            step={1}
            value={reservePct}
            onChange={(e) => setReservePct(Number(e.target.value))}
            aria-label="Income tax reserve percentage"
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[11px] text-faint">
            <span>25%</span>
            <span>default 30%</span>
            <span>35%</span>
          </div>
        </div>
      </div>

      <div className="flex h-11 overflow-hidden rounded-control border border-border">
        <div className="bg-sand" style={{ width: `${yoursPct}%` }} />
        <div className="bg-not-yours" style={{ width: `${btwPct}%` }} />
        <div className="bg-reserve" style={{ width: `${resPct}%` }} />
      </div>
      <div className="mt-3.5 flex flex-wrap gap-6 tabular-nums">
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 translate-y-px rounded-[4px] bg-sand"
          />
          <span className="text-[13px] text-body">Yours</span>
          <span className="text-[15px] font-semibold">
            {formatCents(split.yoursCents)}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="bg-not-yours h-2.5 w-2.5 translate-y-px rounded-[4px]"
          />
          <span className="text-[13px] text-body">Btw — exact, never yours</span>
          <span className="text-[15px] font-semibold">{formatCents(split.vatCents)}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 translate-y-px rounded-[4px] bg-reserve"
          />
          <span className="text-[13px] text-body">Tax reserve</span>
          <span className="text-[15px] font-semibold">
            {formatCents(split.reserveCents)}
          </span>
        </div>
      </div>
      <div className="mb-4 mt-3.5 rounded-control border border-accent-border bg-accent-tint px-4 py-3 text-[13.5px] font-semibold text-ink">
        Move {formatCents(toMoveCents)} to the Taxes pot.
      </div>
      <div className="border-t border-border-hairline pt-4">
        <input
          value={invoiceRef}
          onChange={(e) => setInvoiceRef(e.target.value)}
          placeholder="Invoice reference"
          aria-label="Invoice reference"
          className="mb-2.5 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
        />
        {saved ? (
          <div className="rounded-control border border-state-settled-border bg-state-settled-bg px-4 py-3 text-[13px] font-semibold text-state-settled-ink">
            {saved === "confirmed"
              ? "Split and set aside. The rest is yours."
              : "Tonight at 19:00. The split stays pinned to Today until it's moved."}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => void logSplit("confirmed")}
              disabled={saving || totalCents <= 0}
              className="min-h-[44px] flex-1 rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              I moved it — done
            </button>
            <button
              type="button"
              onClick={() => void logSplit("pending")}
              disabled={saving || totalCents <= 0}
              className="min-h-[44px] flex-1 rounded-control border border-border-strong px-4 py-2.5 text-[13.5px] font-semibold text-ink hover:bg-wash disabled:opacity-50"
            >
              Remind me tonight
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-state-overdue">{error}</p>}
    </section>
  );
}

function PotsSection() {
  const [pots, setPots] = useState<Pot[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<Pot["kind"]>("business");

  const refetch = useCallback(async () => {
    setPots(await apiFetch<Pot[]>("/money/pots"));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function addPot() {
    let targetCents = 0;
    try {
      targetCents = target ? parseAmountToCents(target) : 0;
    } catch {
      targetCents = 0;
    }
    await apiFetch("/money/pots", {
      method: "POST",
      body: JSON.stringify({ name, targetCents, kind }),
    });
    setName("");
    setTarget("");
    setShowAdd(false);
    await refetch();
  }

  if (!pots) return null;

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          2 · Pots
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="border-0 bg-transparent p-0 text-[12.5px] font-semibold text-accent"
        >
          {showAdd ? "Cancel" : "Add a pot"}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 flex flex-wrap items-end gap-2.5 rounded-card border border-border bg-surface p-4">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pot name"
            aria-label="Pot name"
            className="min-w-[140px] flex-1 rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
          />
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target (optional)"
            aria-label="Target amount"
            className="w-36 rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px] tabular-nums"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Pot["kind"])}
            aria-label="Pot kind"
            className="rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
          >
            <option value="business">Business</option>
            <option value="private">Private</option>
          </select>
          <button
            type="button"
            onClick={() => void addPot()}
            disabled={!name.trim()}
            className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}

      {pots.length === 0 ? (
        <p className="mb-7 text-sm text-body">
          No pots yet — add one to start the monthly review ritual.
        </p>
      ) : (
        <div className="mb-7 grid grid-cols-1 gap-3.5 tabular-nums sm:grid-cols-2 md:grid-cols-3">
          {pots.map((pot) => (
            <PotCard key={pot.id} pot={pot} onReviewed={refetch} />
          ))}
        </div>
      )}
    </>
  );
}

function PotCard({ pot, onReviewed }: { pot: Pot; onReviewed: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() =>
    (pot.currentCents / 100).toFixed(2).replace(".", ","),
  );
  const isTaxes =
    pot.name.toLowerCase() === "taxes" || pot.name.toLowerCase() === "belasting";
  const pct =
    pot.targetCents > 0 ? Math.min(100, (pot.currentCents / pot.targetCents) * 100) : 100;

  async function save() {
    let currentCents = pot.currentCents;
    try {
      currentCents = parseAmountToCents(value);
    } catch {
      // keep previous value on parse failure
    }
    await apiFetch(`/money/pots/${pot.id}`, {
      method: "PATCH",
      body: JSON.stringify({ currentCents }),
    });
    setEditing(false);
    await onReviewed();
  }

  return (
    <section
      className={`rounded-card border p-[18px] ${
        isTaxes
          ? "bg-not-yours border-accent-border bg-accent-tint"
          : "border-border bg-surface"
      }`}
    >
      <div className="mb-2 text-[13px] font-semibold">
        {pot.name}{" "}
        {isTaxes && (
          <span className="text-[11px] font-semibold text-faint">· not yours</span>
        )}
      </div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`${pot.name} current amount`}
            className="w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-[15px] font-semibold tabular-nums"
          />
          <button
            type="button"
            onClick={() => void save()}
            className="text-[12px] font-semibold text-accent"
          >
            Save
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="block border-0 bg-transparent p-0 text-left"
        >
          <div className="text-[19px] font-semibold">{formatCents(pot.currentCents)}</div>
        </button>
      )}
      <div className="mb-2.5 mt-0.5 text-xs text-body">
        {pot.targetCents > 0
          ? `of ${formatCents(pot.targetCents)} target`
          : "no target set"}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-border-hairline">
        <div
          className={`h-full ${isTaxes ? "bg-not-yours" : "bg-sand"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}

function VoorlopigeAanslagSection({ year }: { year: number }) {
  const [va, setVa] = useState<VoorlopigeAanslag | null | undefined>(undefined);
  const [monthly, setMonthly] = useState("1.280,00");
  const [startMonth, setStartMonth] = useState(new Date().getMonth() + 2);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    const row = await apiFetch<VoorlopigeAanslag | null>(
      `/money/voorlopige-aanslag/${year}`,
    );
    setVa(row);
    if (row) {
      setMonthly((row.monthlyCents / 100).toFixed(2).replace(".", ","));
      setStartMonth(row.startMonth);
    }
  }, [year]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  async function save(active: boolean) {
    setSaving(true);
    let monthlyCents = 0;
    try {
      monthlyCents = parseAmountToCents(monthly);
    } catch {
      monthlyCents = 0;
    }
    try {
      await apiFetch("/money/voorlopige-aanslag", {
        method: "PUT",
        body: JSON.stringify({ year, monthlyCents, startMonth, active }),
      });
      await refetch();
    } finally {
      setSaving(false);
    }
  }

  if (va === undefined) return null;

  const months = Array.from(
    { length: 12 - startMonth + 1 },
    (_, i) => startMonth + i,
  ).filter((m) => m <= 12);

  return (
    <>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        3 · Pay monthly instead?
      </div>
      <section className="mb-5 rounded-card border border-border bg-surface p-6">
        <div className="mb-4 text-base font-semibold">
          The{" "}
          <TermChip
            nlTerm="voorlopige aanslag"
            definition="A provisional assessment — pay next year's estimated income tax in monthly installments instead of one lump sum after filing."
          />{" "}
          decision
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="rounded-control border border-border-hairline p-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-state-settled">
              What you gain
            </div>
            <p className="m-0 text-[13.5px] leading-relaxed tabular-nums">
              Your {year} income tax spread over monthly payments — no single large bill
              months after the year ends.
            </p>
          </div>
          <div className="rounded-control border border-border-hairline p-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber">
              What you lose
            </div>
            <p className="m-0 text-[13.5px] leading-relaxed">
              Flexibility. Overpay and the refund waits until after filing; underpay and a
              top-up still comes. You must update it if income shifts.
            </p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-end gap-2.5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-body">
              Monthly amount
            </span>
            <input
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="w-32 rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px] font-semibold tabular-nums"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-body">
              Start month
            </span>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void save(true)}
            disabled={saving}
            className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {va?.active ? "Update" : "Activate"}
          </button>
          {va?.active && (
            <button
              type="button"
              onClick={() => void save(false)}
              disabled={saving}
              className="rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-wash disabled:opacity-50"
            >
              Deactivate
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <a
            href="https://mijn.belastingdienst.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-control border border-border-strong px-3.5 py-2.5 text-[13px] font-semibold text-ink hover:bg-wash"
          >
            Request it in Mijn Belastingdienst ↗
          </a>
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="border-0 bg-transparent p-0 text-[12.5px] font-semibold text-accent"
          >
            Preview the schedule
          </button>
        </div>
        {previewOpen && (
          <div className="mt-4 border-t border-border-hairline pt-3.5 tabular-nums">
            <div className="mb-2.5 text-[13px] font-semibold">
              {months.length} monthly payments of{" "}
              {formatCents(
                (() => {
                  try {
                    return parseAmountToCents(monthly);
                  } catch {
                    return 0;
                  }
                })(),
              )}{" "}
              · {MONTH_NAMES[startMonth - 1]} – Dec {year}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {months.map((m) => (
                <span
                  key={m}
                  className="rounded-md bg-wash px-2.5 py-1.5 text-[11.5px] font-semibold text-body"
                >
                  {MONTH_NAMES[m - 1]}
                </span>
              ))}
            </div>
            <div className="mt-2.5 text-xs text-faint">
              Each payment lands as a deadline on your Today timeline once enabled.
            </div>
          </div>
        )}
      </section>
    </>
  );
}
