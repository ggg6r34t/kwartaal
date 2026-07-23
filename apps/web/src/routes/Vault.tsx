import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatCents,
  parseAmountToCents,
  RECEIPT_CHECKLIST_ELEMENTS,
  type KmEntry,
  type Receipt,
  type ReceiptChecklistElement,
  type StartupCost,
  type VatRate,
} from "@kwartaal/core";
import { apiFetch } from "../lib/api";
import { useQuarters } from "../hooks/useQuarters";
import { useIncomeTax } from "../hooks/useIncomeTax";
import { DataExportButton } from "../components/DataExportButton";

const CHECKLIST_LABELS: Record<ReceiptChecklistElement, string> = {
  date: "Date",
  supplierDetails: "Supplier name + address",
  vatNumber: "VAT number",
  description: "Description of goods/service",
  amountExVat: "Amount",
  vatAmount: "Btw amount",
};

export function Vault() {
  const year = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState(year);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-3.5">
        <h1 className="m-0 text-[30px] font-semibold tracking-tight">Vault</h1>
        <div className="ml-auto">
          <DataExportButton />
        </div>
      </div>
      <p className="mb-6 max-w-xl text-sm leading-relaxed text-body">
        Everything the Belastingdienst can ask for, kept for 7 years without you thinking
        about it.
      </p>

      <div className="mb-7 flex items-center gap-2.5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search receipts, invoices, notes…"
          aria-label="Search the Vault"
          className="flex-1 rounded-control border border-border bg-surface px-4 py-2.5 text-[13.5px]"
        />
        {[year, year - 1].map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => setYearFilter(y)}
            className={`rounded-pill px-3.5 py-2 text-[12.5px] font-semibold ${
              yearFilter === y
                ? "bg-ink text-white"
                : "border border-border text-body hover:bg-wash"
            }`}
          >
            {y}
          </button>
        ))}
      </div>

      <div className="mb-7 grid grid-cols-[1.5fr_1fr] gap-5">
        <ReceiptCapture year={yearFilter} />
        <HoursRing year={yearFilter} />
      </div>

      <RecentRecords year={yearFilter} search={search} />
      <StartupCostsCorner />

      <footer className="border-t border-border pt-4 text-xs text-faint">
        Records are kept 7 years — the legal retention period. Figures: tax year{" "}
        {yearFilter}.
      </footer>
    </div>
  );
}

function ReceiptCapture({ year }: { year: number }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onFileSelected(file: File) {
    setError(null);
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const created = await apiFetch<Receipt>("/receipts", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: buffer,
      });
      setReceipt(created);
    } catch {
      setError(
        "Couldn't upload that file — check it's a jpeg, png, webp, or pdf under 8 MB.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function toggle(element: ReceiptChecklistElement) {
    if (!receipt) return;
    const current = receipt.checklist?.[element]?.confirmed ?? false;
    const updated = await apiFetch<Receipt>(`/receipts/${receipt.id}/checklist`, {
      method: "PATCH",
      body: JSON.stringify({ checklist: { [element]: { confirmed: !current } } }),
    });
    setReceipt(updated);
  }

  return (
    <section className="rounded-card border border-border bg-surface p-6">
      <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
        New receipt — checked before it saves
      </div>
      <div className="flex gap-5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-[200px] w-[150px] flex-none items-center justify-center rounded-card border border-border bg-wash text-center text-[11px] text-faint"
        >
          {uploading
            ? "Uploading…"
            : receipt
              ? "Uploaded ✓"
              : "Tap to add a photo or PDF"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFileSelected(file);
          }}
        />
        <div className="flex-1 text-[13px] leading-relaxed">
          {!receipt && (
            <p className="text-body">
              A photo of the receipt, checked against the six elements the Belastingdienst
              wants on file, before it's kept for seven years.
            </p>
          )}
          {receipt && (
            <>
              {RECEIPT_CHECKLIST_ELEMENTS.map((element) => {
                const confirmed = receipt.checklist?.[element]?.confirmed ?? false;
                return (
                  <button
                    key={element}
                    type="button"
                    onClick={() => void toggle(element)}
                    className="flex w-full items-center gap-2.5 border-0 bg-transparent p-0 py-1.5 text-left"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded-[5px] ${
                        confirmed ? "bg-state-settled" : "border-2 border-amber"
                      }`}
                    >
                      {confirmed && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                    {CHECKLIST_LABELS[element]}
                  </button>
                );
              })}
              <div className="mt-2 text-xs text-faint">
                {receipt.missingCount === 0
                  ? "All six confirmed."
                  : `${receipt.missingCount} still missing.`}
              </div>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="mt-2.5 rounded-control border border-border-strong px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:bg-wash"
              >
                Add another
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-3 text-xs text-state-overdue">{error}</p>}
      <p className="mt-3 text-[11px] text-faint">
        Showing captures for {year} and after.
      </p>
    </section>
  );
}

function HoursRing({ year }: { year: number }) {
  const { data } = useIncomeTax(year);
  const [showLog, setShowLog] = useState(false);
  const [hours, setHours] = useState("8");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const logged = data?.hoursLogged ?? 0;
  const target = data?.hoursTarget ?? 1225;
  const pct = target > 0 ? Math.min(1, logged / target) : 0;
  const circumference = 2 * Math.PI * 46;
  const dash = circumference * pct;

  async function logHours() {
    await apiFetch("/hours-entries", {
      method: "POST",
      body: JSON.stringify({ date, hours: Number(hours), note: note || null }),
    });
    setShowLog(false);
    setNote("");
  }

  return (
    <section className="flex flex-col items-center rounded-card border border-border bg-surface p-6 text-center">
      <div className="mb-3.5 self-start text-[11px] font-semibold uppercase tracking-wide text-faint">
        Hours · urencriterium
      </div>
      <div className="relative h-[110px] w-[110px]">
        <svg width="110" height="110" viewBox="0 0 110 110" aria-hidden="true">
          <circle
            cx="55"
            cy="55"
            r="46"
            fill="none"
            stroke="var(--color-border-hairline)"
            strokeWidth="9"
          />
          <circle
            cx="55"
            cy="55"
            r="46"
            fill="none"
            stroke="var(--color-state-settled)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            transform="rotate(-90 55 55)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[19px] font-semibold tabular-nums">{logged}</span>
          <span className="text-[10.5px] text-body">of {target}</span>
        </div>
      </div>
      <p className="mb-3.5 mt-3 max-w-[220px] text-[12.5px] leading-relaxed text-body">
        {Math.max(0, target - logged)} hours to go. The Belastingdienst may ask for this
        log.
      </p>
      {!showLog ? (
        <button
          type="button"
          onClick={() => setShowLog(true)}
          className="rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-wash"
        >
          Log this week's hours
        </button>
      ) : (
        <div className="w-full text-left">
          <label className="mb-2 block">
            <span className="mb-1 block text-xs font-semibold text-body">Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-control border border-border-strong bg-surface px-2.5 py-1.5 text-[13px]"
            />
          </label>
          <label className="mb-2 block">
            <span className="mb-1 block text-xs font-semibold text-body">Hours</span>
            <input
              type="number"
              min={0}
              max={24}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full rounded-control border border-border-strong bg-surface px-2.5 py-1.5 text-[13px] tabular-nums"
            />
          </label>
          <label className="mb-3 block">
            <span className="mb-1 block text-xs font-semibold text-body">
              Note (optional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-control border border-border-strong bg-surface px-2.5 py-1.5 text-[13px]"
            />
          </label>
          <button
            type="button"
            onClick={() => void logHours()}
            className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover"
          >
            Save
          </button>
        </div>
      )}
    </section>
  );
}

function RecentRecords({ year, search }: { year: number; search: string }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [kmEntries, setKmEntries] = useState<KmEntry[]>([]);

  useEffect(() => {
    void apiFetch<Receipt[]>(`/receipts?year=${year}`).then(setReceipts);
    void apiFetch<KmEntry[]>(`/km-entries?year=${year}`).then(setKmEntries);
  }, [year]);

  const rows = useMemo(() => {
    const receiptRows = receipts.map((r) => ({
      type: "receipt" as const,
      key: r.id,
      label: r.r2Key.split("/").pop() ?? r.id,
      date: new Date(r.capturedAt).toISOString().slice(0, 10),
      sortAt: r.capturedAt,
    }));
    const kmRows = kmEntries.map((k) => ({
      type: "km log" as const,
      key: k.id,
      label: k.purpose ?? "Trip",
      date: k.date,
      sortAt: new Date(k.date).getTime(),
    }));
    const all = [...receiptRows, ...kmRows].sort((a, b) => b.sortAt - a.sortAt);
    if (!search.trim()) return all;
    const q = search.trim().toLowerCase();
    return all.filter((r) => r.label.toLowerCase().includes(q) || r.date.includes(q));
  }, [receipts, kmEntries, search]);

  return (
    <>
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-faint">
        Recent records
      </div>
      <section className="mb-7 overflow-hidden rounded-card border border-border bg-surface">
        <div className="grid grid-cols-[88px_1fr_90px] gap-3 border-b border-border-hairline px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
          <span>Type</span>
          <span>Item</span>
          <span>Date</span>
        </div>
        {rows.length === 0 && (
          <div className="px-6 py-5 text-sm text-body">
            Nothing recorded for {year} yet.
          </div>
        )}
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[88px_1fr_90px] items-baseline gap-3 border-b border-border-hairline px-6 py-3 text-[13.5px] last:border-b-0"
          >
            <span className="w-fit rounded-pill bg-wash px-2 py-0.5 text-[11px] font-semibold text-body">
              {row.type}
            </span>
            <span>{row.label}</span>
            <span className="text-body">{row.date}</span>
          </div>
        ))}
      </section>
    </>
  );
}

const VAT_RATES: VatRate[] = [21, 9, 0];
const STARTUP_COST_THRESHOLD_CENTS = 45000;

function StartupCostsCorner() {
  const { quarters } = useQuarters();
  const [costs, setCosts] = useState<StartupCost[] | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [vatRate, setVatRate] = useState<VatRate>(21);
  const [vatReclaimable, setVatReclaimable] = useState(true);

  const refetch = useCallback(async () => {
    setCosts(await apiFetch<StartupCost[]>("/startup-costs"));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const earliestQuarter = useMemo(() => {
    if (!quarters || quarters.length === 0) return null;
    return [...quarters].sort((a, b) => a.year - b.year || a.q - b.q)[0]!;
  }, [quarters]);

  async function addCost() {
    if (!earliestQuarter) return;
    let amountExVatCents = 0;
    try {
      amountExVatCents = parseAmountToCents(amountInput);
    } catch {
      return;
    }
    const isDepreciate = amountExVatCents > STARTUP_COST_THRESHOLD_CENTS;
    const startMonth = new Date(date).getMonth() + 1;
    await apiFetch(`/quarters/${earliestQuarter.id}/expense-lines`, {
      method: "POST",
      body: JSON.stringify({
        date,
        supplier,
        amountExVatCents,
        vatRate,
        vatReclaimable,
        isStartupCost: true,
        deductionMode: isDepreciate ? "depreciate" : "expense",
        ...(isDepreciate
          ? { depreciation: { years: 5, residualCents: 0, startMonth } }
          : {}),
      }),
    });
    setSupplier("");
    setAmountInput("");
    setShowAdd(false);
    await refetch();
  }

  return (
    <>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          Start-up costs — spent before registering
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          disabled={!earliestQuarter}
          className="border-0 bg-transparent p-0 text-[12.5px] font-semibold text-accent disabled:opacity-50"
        >
          {showAdd ? "Cancel" : "Add a start-up cost"}
        </button>
      </div>
      <section className="mb-4 rounded-card border border-border bg-surface p-6 tabular-nums">
        <p className="mb-4 max-w-2xl text-[13.5px] leading-relaxed text-body">
          Spent money before registering? Good news — most of it is deductible. One rule
          to watch:{" "}
          <strong className="text-ink">over €450 and used longer than a year?</strong>{" "}
          Then it's an investment, spread over up to 5 years, max 20% per year.
        </p>

        {showAdd && (
          <div className="mb-4 flex flex-wrap items-end gap-2.5 rounded-control border border-border-hairline p-4">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date"
              className="rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
            />
            <input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="What was it?"
              aria-label="Description"
              className="min-w-[140px] flex-1 rounded-control border border-border-strong bg-surface px-3 py-2 text-[13px]"
            />
            <input
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
            <label className="flex items-center gap-1.5 text-[13px] text-body">
              <input
                type="checkbox"
                checked={vatReclaimable}
                onChange={(e) => setVatReclaimable(e.target.checked)}
              />
              Reclaimed the btw
            </label>
            <button
              type="button"
              onClick={() => void addCost()}
              disabled={!supplier.trim() || !amountInput.trim()}
              className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Add
            </button>
          </div>
        )}

        {!costs || costs.length === 0 ? (
          <p className="text-sm text-body">No start-up costs logged yet.</p>
        ) : (
          costs.map(({ line, depreciation }) => (
            <div
              key={line.id}
              className="mb-3 rounded-control border border-border-hairline p-4 last:mb-0"
            >
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="text-sm font-semibold">{line.supplier}</span>
                <span className="text-[13px] text-body">
                  {formatCents(line.amountExVatCents)} · {line.date}
                </span>
                <span
                  className={`ml-auto rounded-pill px-2.5 py-1 text-[11px] font-semibold ${
                    depreciation
                      ? "bg-amber-bg text-amber-ink"
                      : "bg-sage-bg text-sage-ink"
                  }`}
                >
                  {depreciation
                    ? `investment — spread over ${depreciation.years} years`
                    : "fully deductible"}
                </span>
              </div>
              {depreciation && (
                <div className="mt-3 flex gap-1.5">
                  {depreciation.schedule.map((entry) => (
                    <div
                      key={entry.year}
                      className="flex-1 rounded-md bg-wash py-1.5 text-center text-[11.5px]"
                    >
                      <strong>Y{entry.year}</strong>
                      <br />
                      <span className="text-body">{formatCents(entry.amountCents)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2.5 text-[12.5px] text-body">
                Reclaimed the btw on this?{" "}
                <strong className="text-ink">{line.vatReclaimable ? "Yes" : "No"}</strong>
              </div>
            </div>
          ))
        )}
      </section>
      <div className="mb-6 rounded-card border border-border bg-surface p-5">
        <p className="m-0 font-explainer text-[15px] italic leading-relaxed text-body">
          The sniff test: would you have bought it anyway? Then it's probably private.
          Work clothing for the studio — yes. Cake for your registration party — sadly,
          no.
        </p>
      </div>
    </>
  );
}
