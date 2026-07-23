import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  formatCents,
  splitInvoice,
  type OnboardingCompleteRequest,
} from "@kwartaal/core";
import { apiFetch } from "../lib/api";
import { useMe } from "../hooks/useMe";

type LegalForm = "eenmanszaak" | "vof" | "bv";
type ReminderCadence = "calm" | "persistent";

interface WizardState {
  step: number; // 0 welcome, 1 business, 2 btw/KOR, 3 money, 4 reminders, 5 done
  legalForm: LegalForm;
  kvkYear: number | null; // null = "earlier / not tracked"
  turnoverCents: number; // 0 - 10,000,000 (€0 - €100.000)
  korOptIn: boolean | null;
  reserveBps: number; // 2500 - 3500
  reminderCadence: ReminderCadence;
}

const STEP_LABELS = ["Welcome", "Your business", "Btw", "Money", "Reminders", "Done"];
const KOR_LIMIT_CENTS = 2_000_000;

function euros(cents: number): string {
  return `€${Math.round(cents / 100).toLocaleString("nl-NL")}`;
}

export function Onboarding() {
  const navigate = useNavigate();
  const { refetch } = useMe();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [state, setState] = useState<WizardState>({
    step: 0,
    legalForm: "eenmanszaak",
    kvkYear: new Date().getFullYear(),
    turnoverCents: 4_500_000,
    korOptIn: null,
    reserveBps: 3000,
    reminderCadence: "persistent",
  });

  const set = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));
  const korEligible = state.turnoverCents <= KOR_LIMIT_CENTS;
  const usesKor = korEligible && state.korOptIn !== false;

  async function completeOnboarding() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: OnboardingCompleteRequest = {
        legalForm: state.legalForm,
        kvkRegisteredAt: state.kvkYear ? `${state.kvkYear}-01-01` : null,
        turnoverEstimateCents: state.turnoverCents,
        korOptIn: usesKor,
        defaultSetAsideRateBps: state.reserveBps,
        reminderCadence: state.reminderCadence,
      };
      await apiFetch("/onboarding/complete", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refetch();
      set({ step: 5 });
    } catch {
      setSubmitError("Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (state.step === 4) {
      void completeOnboarding();
      return;
    }
    set({ step: Math.min(5, state.step + 1) });
  }
  function back() {
    set({ step: Math.max(0, state.step - 1) });
  }

  const split = splitInvoice(242000, 21, state.reserveBps);

  return (
    <div className="flex min-h-screen">
      <aside className="box-border flex w-64 flex-none flex-col border-r border-border p-8">
        <div className="mb-9 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="relative block h-[26px] w-[26px] rounded-full border-[1.5px] border-ink bg-surface"
          >
            <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 bg-accent [border-radius:0_10px_0_0]" />
          </span>
          <span className="text-base font-bold tracking-tight">Kwartaal</span>
        </div>
        <div className="flex flex-col gap-1">
          {STEP_LABELS.map((label, i) => {
            const done = i < state.step;
            const now = i === state.step;
            return (
              <button
                key={label}
                type="button"
                disabled={i > state.step}
                onClick={() => i <= state.step && set({ step: i })}
                className={`flex items-center gap-3 rounded-control px-2.5 py-2 text-left text-[13.5px] font-semibold ${
                  now ? "bg-wash" : ""
                } ${i > state.step ? "cursor-default text-faint" : "cursor-pointer text-ink"}`}
              >
                {done ? (
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md bg-state-settled text-white">
                    ✓
                  </span>
                ) : now ? (
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 border-accent">
                    <span className="h-[7px] w-[7px] rounded-full bg-accent" />
                  </span>
                ) : (
                  <span className="h-5 w-5 flex-none rounded-full border-2 border-dashed border-border-strong" />
                )}
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-auto text-xs leading-relaxed text-faint">
          About 5 minutes. Everything can be changed later in Settings.
        </div>
      </aside>

      <main className="flex flex-1 items-start justify-center p-16">
        <div className="w-full max-w-xl">
          {state.step === 0 && (
            <div>
              <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                Welcome
              </div>
              <h1 className="m-0 mb-3.5 text-[34px] font-semibold leading-tight tracking-tight">
                Taxes become four dates a year.
              </h1>
              <p className="mb-6 max-w-md text-[15px] leading-relaxed text-body">
                Five questions set up your tax year. Kwartaal then guides, estimates and
                reminds — it never files for you. Mijn Belastingdienst or your bookkeeper
                has the final word.
              </p>
              <div className="mb-7 flex gap-2.5">
                <div className="flex-1 rounded-control border border-border bg-surface p-3.5">
                  <div className="text-xl font-semibold">4×</div>
                  <div className="mt-0.5 text-xs text-body">
                    quarterly btw, ~25 min each
                  </div>
                </div>
                <div className="flex-1 rounded-control border border-border bg-surface p-3.5">
                  <div className="text-xl font-semibold">1×</div>
                  <div className="mt-0.5 text-xs text-body">
                    annual return, guided in March
                  </div>
                </div>
                <div className="flex-1 rounded-control border border-border bg-surface p-3.5">
                  <div className="text-xl font-semibold">0</div>
                  <div className="mt-0.5 text-xs text-body">jargon left unexplained</div>
                </div>
              </div>
              <button
                type="button"
                onClick={next}
                className="rounded-control bg-accent px-5 py-3 text-[14.5px] font-semibold text-white hover:bg-accent-hover"
              >
                Set up my tax year
              </button>
            </div>
          )}

          {state.step === 1 && (
            <div>
              <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Step 1 of 5 · Your business
              </div>
              <h1 className="m-0 mb-2 text-[28px] font-semibold tracking-tight">
                What did you register at the KVK?
              </h1>
              <p className="mb-6 text-sm leading-relaxed text-body">
                This decides which taxes apply and how you log in to file.
              </p>
              <div className="mb-5 flex flex-col gap-2.5">
                {(
                  [
                    {
                      value: "eenmanszaak",
                      title: "Eenmanszaak",
                      desc: "Sole proprietorship — you and the business are one. Income tax on profit, btw per quarter. Log in with DigiD.",
                    },
                    {
                      value: "vof",
                      title: "VOF",
                      desc: "Partnership — each partner files their own income tax share. Filing needs eHerkenning.",
                    },
                    {
                      value: "bv",
                      title: "BV",
                      desc: "Private limited company — corporate tax, payroll for yourself. Kwartaal covers the basics; a bookkeeper is strongly advised.",
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set({ legalForm: option.value })}
                    className={`flex items-start gap-3.5 rounded-card border bg-surface p-5 text-left ${
                      state.legalForm === option.value ? "border-accent" : "border-border"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                        state.legalForm === option.value
                          ? "border-accent"
                          : "border-border-strong"
                      }`}
                    >
                      {state.legalForm === option.value && (
                        <span className="h-[9px] w-[9px] rounded-full bg-accent" />
                      )}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-body">
                        {option.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mb-6 rounded-card border border-border bg-surface p-4">
                <label className="mb-2 block text-[13px] font-semibold" htmlFor="ob-year">
                  Which year did you register?
                </label>
                <div id="ob-year" className="flex gap-1.5">
                  {[
                    new Date().getFullYear() - 1,
                    new Date().getFullYear(),
                    new Date().getFullYear() + 1,
                  ].map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => set({ kvkYear: year })}
                      className={`rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold ${
                        state.kvkYear === year ? "bg-ink text-white" : "text-ink"
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => set({ kvkYear: null })}
                    className={`rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold ${
                      state.kvkYear === null ? "bg-ink text-white" : "text-ink"
                    }`}
                  >
                    Earlier
                  </button>
                </div>
                {state.kvkYear !== null && (
                  <p className="mb-0 mt-3 text-[12.5px] font-semibold text-state-settled">
                    ✓ Within your first 5 years — the startersaftrek (extra €2.123
                    deduction) may apply up to 3 times.
                  </p>
                )}
              </div>
              <StepNav onBack={back} onNext={next} />
            </div>
          )}

          {state.step === 2 && (
            <div>
              <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Step 2 of 5 · Btw
              </div>
              <h1 className="m-0 mb-2 text-[28px] font-semibold tracking-tight">
                Roughly how much will you invoice this year?
              </h1>
              <p className="mb-6 text-sm leading-relaxed text-body">
                A rough guess is fine. It decides one thing: whether the small-business
                scheme (KOR) is worth considering.
              </p>
              <div className="mb-3.5 rounded-card border border-border bg-surface p-5">
                <div className="mb-2.5 flex items-baseline justify-between">
                  <span className="text-[13px] font-semibold text-body">
                    Expected turnover (ex btw)
                  </span>
                  <span className="text-xl font-semibold">
                    {state.turnoverCents >= 10_000_000
                      ? `${euros(10_000_000)}+`
                      : euros(state.turnoverCents)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10_000_000}
                  step={250_000}
                  value={state.turnoverCents}
                  onChange={(e) =>
                    set({ turnoverCents: Number(e.target.value), korOptIn: null })
                  }
                  aria-label="Expected turnover"
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[11px] text-faint">
                  <span>€0</span>
                  <span className="font-semibold text-accent">€20.000 — KOR limit</span>
                  <span>€100.000+</span>
                </div>
              </div>
              {korEligible ? (
                <div className="mb-3.5 rounded-card border border-accent-border bg-surface p-5">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    You could use the KOR
                  </div>
                  <p className="mb-3.5 text-[13.5px] leading-relaxed text-ink">
                    Under €20.000 you can opt out of btw entirely: no charging it, no
                    quarterly returns. The trade: you can't reclaim the btw on your own
                    purchases.
                  </p>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => set({ korOptIn: true })}
                      className={`rounded-control border border-border-strong px-3.5 py-2.5 text-[13px] font-semibold ${
                        usesKor ? "bg-ink text-white" : "text-ink"
                      }`}
                    >
                      Use the KOR
                    </button>
                    <button
                      type="button"
                      onClick={() => set({ korOptIn: false })}
                      className={`rounded-control border border-border-strong px-3.5 py-2.5 text-[13px] font-semibold ${
                        state.korOptIn === false ? "bg-ink text-white" : "text-ink"
                      }`}
                    >
                      File quarterly anyway
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-3.5 rounded-card border border-border bg-surface p-5">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                    Quarterly btw it is
                  </div>
                  <p className="m-0 text-[13.5px] leading-relaxed text-ink">
                    Above €20.000 the KOR doesn't apply. You'll charge btw on every
                    invoice and file four short returns a year — Kwartaal turns each one
                    into a ~25-minute checklist.
                  </p>
                </div>
              )}
              <div className="mt-6">
                <StepNav onBack={back} onNext={next} />
              </div>
            </div>
          )}

          {state.step === 3 && (
            <div>
              <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Step 3 of 5 · Money
              </div>
              <h1 className="m-0 mb-2 text-[28px] font-semibold tracking-tight">
                When an invoice is paid, how much should never feel like yours?
              </h1>
              <p className="mb-6 text-sm leading-relaxed text-body">
                The btw goes aside exactly. On top of that, a slice of every payment
                covers your income tax. Pick your reserve — 30% is a safe default.
              </p>
              <div className="mb-3.5 rounded-card border border-border bg-surface p-5">
                <div className="mb-2 flex justify-between text-xs font-semibold text-body">
                  <span>Income-tax reserve</span>
                  <span className="text-[15px] text-ink">{state.reserveBps / 100}%</span>
                </div>
                <input
                  type="range"
                  min={25}
                  max={35}
                  step={1}
                  value={state.reserveBps / 100}
                  onChange={(e) => set({ reserveBps: Number(e.target.value) * 100 })}
                  aria-label="Income tax reserve percentage"
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[11px] text-faint">
                  <span>25% — lean</span>
                  <span>30% — default</span>
                  <span>35% — extra margin</span>
                </div>
                <div className="mt-[18px]">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
                    A €2.420 invoice (incl. 21% btw) would split into
                  </div>
                  <div className="flex h-9 overflow-hidden rounded-control border border-border">
                    <div
                      className="bg-sand"
                      style={{ width: `${(split.yoursCents / 242000) * 100}%` }}
                    />
                    <div
                      className="bg-not-yours"
                      style={{ width: `${(split.vatCents / 242000) * 100}%` }}
                    />
                    <div
                      className="bg-reserve"
                      style={{ width: `${(split.reserveCents / 242000) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-5 text-[12.5px] text-body">
                    <span>
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-sand" />
                      Yours{" "}
                      <strong className="text-ink">
                        {formatCents(split.yoursCents)}
                      </strong>
                    </span>
                    <span>
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-not-yours" />
                      Btw — exact{" "}
                      <strong className="text-ink">{formatCents(split.vatCents)}</strong>
                    </span>
                    <span>
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-reserve" />
                      Tax reserve{" "}
                      <strong className="text-ink">
                        {formatCents(split.reserveCents)}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
              <StepNav onBack={back} onNext={next} />
            </div>
          )}

          {state.step === 4 && (
            <div>
              <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Step 4 of 5 · Reminders
              </div>
              <h1 className="m-0 mb-2 text-[28px] font-semibold tracking-tight">
                How loudly should we remind you?
              </h1>
              <p className="mb-6 text-sm leading-relaxed text-body">
                Deadlines only — never marketing. Missing a btw deadline risks a fine, so
                we default to persistent.
              </p>
              <div className="mb-6 flex flex-col gap-2.5">
                {[
                  {
                    value: "calm" as const,
                    title: "Calm",
                    desc: "Email only — 14 and 2 days before each deadline, and one overdue notice.",
                  },
                  {
                    value: "persistent" as const,
                    title: "Persistent",
                    badge: "recommended",
                    desc: "Email — 14 and 7 days before, on the day, and weekly while overdue.",
                  },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set({ reminderCadence: option.value })}
                    className={`flex items-start gap-3.5 rounded-card border bg-surface p-5 text-left ${
                      state.reminderCadence === option.value
                        ? "border-accent"
                        : "border-border"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                        state.reminderCadence === option.value
                          ? "border-accent"
                          : "border-border-strong"
                      }`}
                    >
                      {state.reminderCadence === option.value && (
                        <span className="h-[9px] w-[9px] rounded-full bg-accent" />
                      )}
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold">
                        {option.title}
                        {option.badge && (
                          <span className="ml-1.5 text-[11px] font-semibold text-accent">
                            {option.badge}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-body">
                        {option.desc}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {submitError && (
                <p className="mb-4 text-sm text-state-overdue">{submitError}</p>
              )}
              <StepNav
                onBack={back}
                onNext={next}
                nextLabel={submitting ? "Setting up…" : "Continue"}
                nextDisabled={submitting}
              />
            </div>
          )}

          {state.step === 5 && (
            <div>
              <div className="mb-[18px] flex h-11 w-11 items-center justify-center rounded-card bg-state-settled">
                <span className="text-white">✓</span>
              </div>
              <h1 className="m-0 mb-2 text-[28px] font-semibold tracking-tight">
                Your tax year is set up.
              </h1>
              <p className="mb-3.5 text-sm leading-relaxed text-body">
                Here's your {new Date().getFullYear()} —{" "}
                {usesKor
                  ? "one annual return, and we watch the KOR limit for you."
                  : "four quarterly drawers and one annual return."}
              </p>
              <div className="mb-6 overflow-hidden rounded-card border border-border bg-surface text-[13.5px]">
                <SummaryRow
                  label="Legal form"
                  value={`${state.legalForm}${state.kvkYear ? ` · since ${state.kvkYear}` : ""}`}
                />
                <SummaryRow
                  label="Btw"
                  value={
                    usesKor ? "KOR — no quarterly returns" : "Quarterly btw-aangifte"
                  }
                />
                <SummaryRow
                  label="Income-tax reserve"
                  value={`${state.reserveBps / 100}% of every payment`}
                />
                <SummaryRow
                  label="Reminders"
                  value={
                    state.reminderCadence === "persistent"
                      ? "Email · 14, 7 days before, day-of, weekly overdue"
                      : "Email · 14 and 2 days before"
                  }
                  last
                />
              </div>
              <button
                type="button"
                onClick={() => navigate("/app/today")}
                className="rounded-control bg-accent px-5 py-3 text-[14.5px] font-semibold text-white hover:bg-accent-hover"
              >
                Open Today
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StepNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled = false,
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex gap-2.5">
      <button
        type="button"
        onClick={onBack}
        className="rounded-control border border-border-strong px-[18px] py-3 text-sm font-semibold text-ink hover:bg-wash"
      >
        Back
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="rounded-control bg-accent px-[18px] py-3 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex justify-between px-5 py-3.5 ${last ? "" : "border-b border-border-hairline"}`}
    >
      <span className="font-semibold">{label}</span>
      <span className="text-body">{value}</span>
    </div>
  );
}
