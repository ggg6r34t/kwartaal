import { useState } from "react";
import { Link } from "react-router-dom";
import { MarketingLayout } from "./MarketingLayout";

const FAQS: [string, string][] = [
  [
    "Do I still need my bookkeeper?",
    "Yes — different job. A bookkeeper keeps your books correct; Kwartaal makes sure you understand them and never meet a deadline by surprise. Pro includes a seat so your bookkeeper sees what you see.",
  ],
  [
    "Can Kwartaal file for me?",
    "No — by design. Filing happens in Mijn Belastingdienst, by you. Tools that file on your behalf ask you to trust a black box; Kwartaal mirrors the form and explains every figure, so the five minutes of typing are the easiest part.",
  ],
  [
    "What happens when my free quarter ends?",
    "You decide. Choose Pro, or stay on the free layer — calendar, reminders, calculator, and glossary stay free forever. Everything you entered stays readable and exportable.",
  ],
  [
    "Are the numbers official?",
    "They're estimates, clearly marked, computed from published rates for the tax year shown on every figure. Mijn Belastingdienst has the final word — Kwartaal never claims otherwise.",
  ],
  [
    "I invoice with Moneybird / Declair. Does that clash?",
    "No — Kwartaal works alongside it. Keep invoicing where you invoice; import the numbers (or a CSV) and Kwartaal handles deadlines, explanations, and estimates.",
  ],
  [
    "Can I cancel?",
    "Any time. Annual plans run out their year; monthly stops at the next cycle. Your data remains readable and exportable after either.",
  ],
];

export function Pricing() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <MarketingLayout current="/pricing">
      <div className="mx-auto max-w-[1120px] px-10 py-16">
        <div className="mb-12 max-w-[620px]">
          <h1 className="m-0 mb-3.5 text-[42px] font-semibold leading-tight tracking-tight">
            One price. The year included.
          </h1>
          <p className="m-0 text-base leading-relaxed text-body">
            Four quarters, one annual return, every reminder and every explanation.
            Kwartaal costs less than the coffee you'd drink worrying about it.
          </p>
        </div>

        <div className="mb-5 grid grid-cols-[1.25fr_1fr] items-stretch gap-5">
          <section
            aria-label="Pro plan"
            className="flex flex-col rounded-card border-[1.5px] border-accent bg-surface p-9 shadow-card"
          >
            <div className="mb-4 flex items-center gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                Kwartaal Pro
              </span>
              <span className="rounded-pill bg-accent-tint px-2.5 py-1 text-[11px] font-semibold text-accent">
                annual — most choose this
              </span>
            </div>
            <div className="mb-1 flex items-baseline gap-2.5 tabular-nums">
              <span className="text-[46px] font-semibold tracking-tight">€10</span>
              <span className="text-body">/month · billed yearly (€120)</span>
            </div>
            <div className="mb-6 text-[13px] text-faint">
              Prefer flexible? €12/month, cancel any time.
            </div>
            <div className="mb-6 flex flex-col gap-2.5 text-sm">
              {[
                "Quarter checklists — the guided close, start to drawer",
                "Annual studio — your income-tax year, explained",
                "Money — set-aside tracking against the estimate",
                "Vault — receipts and invoices, checked and kept 7 years",
                "Exports + a seat for your bookkeeper",
              ].map((line) => (
                <div key={line} className="flex gap-2.5">
                  <span aria-hidden="true" className="font-bold text-state-settled">
                    ✓
                  </span>
                  {line}
                </div>
              ))}
            </div>
            <Link
              to="/signin"
              className="mt-auto block rounded-control bg-accent py-3.5 text-center text-[15px] font-semibold text-white no-underline hover:bg-accent-hover"
            >
              Start free — decide after your first quarter
            </Link>
          </section>

          <section
            aria-label="First quarter free"
            className="flex flex-col rounded-card border border-border bg-surface p-9"
          >
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-faint">
              The free first quarter
            </div>
            <div className="mb-4 flex items-center gap-4">
              <div
                aria-hidden="true"
                className="flex h-11 w-11 flex-none items-center justify-center rounded-control border border-state-settled-border bg-state-settled-bg"
              >
                <span className="flex flex-col items-center gap-0.5">
                  <span className="block h-2 w-5 rounded-sm border-[1.5px] border-state-settled" />
                  <span className="block h-0.5 w-3 rounded-sm bg-state-settled" />
                </span>
              </div>
              <div className="text-[19px] font-semibold leading-snug tracking-tight">
                Full access until you close your first quarter.
              </div>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-body">
              No card. Not a 14-day timer — a real milestone. You set up, work the
              quarter, file it, pay it, and feel the drawer close. Then you decide.
            </p>
            <p className="m-0 text-[13px] leading-relaxed text-faint">
              Whatever you decide, your calendar and reminders stay free, and everything
              you entered stays readable and exportable.
            </p>
            <div className="mt-auto border-t border-border-hairline pt-4 text-xs text-faint">
              Free forever: calendar · reminders · set-aside calculator · glossary
            </div>
          </section>
        </div>

        <section
          aria-label="Deductibility"
          className="bg-not-yours mb-14 rounded-card border border-accent-border bg-accent-tint p-9"
        >
          <div className="grid grid-cols-[300px_1fr] items-center gap-10">
            <div>
              <h2 className="m-0 mb-2.5 text-xl font-semibold tracking-tight">
                What it really costs a ZZP'er
              </h2>
              <p className="m-0 text-[13.5px] leading-relaxed text-body">
                Kwartaal is a business expense. The btw comes back, and the rest reduces
                your taxable profit.
              </p>
            </div>
            <div>
              <div className="flex items-end gap-0.5 tabular-nums">
                <div className="flex-[1.4]">
                  <div className="mb-1.5 text-xs text-body">You pay / year</div>
                  <div className="flex h-16 items-center justify-center rounded-[8px_0_0_8px] bg-sand text-[15px] font-semibold">
                    €120
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-1.5 text-xs text-body">btw back · rubriek 5b</div>
                  <div className="bg-not-yours flex h-16 items-center justify-center text-xs font-semibold">
                    −€20,83
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-1.5 text-xs text-body">off your profit</div>
                  <div className="flex h-16 items-end">
                    <div className="mt-3.5 flex h-6 flex-1 items-center justify-center bg-reserve text-xs font-semibold">
                      −€99 deductible
                    </div>
                  </div>
                </div>
                <div className="flex-[1.1]">
                  <div className="mb-1.5 text-xs font-semibold text-accent">
                    effectively
                  </div>
                  <div className="flex h-16 flex-col items-center justify-center rounded-[0_8px_8px_0] border-[1.5px] border-accent bg-surface">
                    <span className="text-[17px] font-semibold">±€6–7</span>
                    <span className="text-[11.5px] text-body">/month</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
                  estimate
                </span>
                <span className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
                  Figures: tax year 2026
                </span>
                <span className="text-xs text-faint">
                  — at a marginal rate around 40%; yours may differ.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Free versus Pro" className="mb-16">
          <h2 className="m-0 mb-5 text-2xl font-semibold tracking-tight">
            What's free, what's Pro
          </h2>
          <div className="grid grid-cols-2 gap-5">
            <div className="rounded-card border border-border bg-surface p-7">
              <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Free — the safety layer
              </div>
              <div className="flex flex-col gap-2.5 text-sm leading-relaxed">
                <div>
                  <strong>Deadline calendar</strong>{" "}
                  <span className="text-body">
                    — all four quarters + the annual return
                  </span>
                </div>
                <div>
                  <strong>Reminders</strong>{" "}
                  <span className="text-body">— email, in time, in plain language</span>
                </div>
                <div>
                  <strong>Set-aside calculator</strong>{" "}
                  <span className="text-body">— yours / btw / reserve on any amount</span>
                </div>
                <div>
                  <strong>Glossary</strong>{" "}
                  <span className="text-body">
                    — every Dutch term, explained once and dotted ever after
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-card border border-border bg-surface p-7">
              <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                Pro — the understanding layer
              </div>
              <div className="flex flex-col gap-2.5 text-sm leading-relaxed">
                <div>
                  <strong>Quarter checklists</strong>{" "}
                  <span className="text-body">— the guided 25-minute close</span>
                </div>
                <div>
                  <strong>Annual studio</strong>{" "}
                  <span className="text-body">
                    — your income-tax year, walked through
                  </span>
                </div>
                <div>
                  <strong>Money</strong>{" "}
                  <span className="text-body">
                    — set-aside tracked against the live estimate
                  </span>
                </div>
                <div>
                  <strong>Vault</strong>{" "}
                  <span className="text-body">
                    — receipts checked for the six required elements, kept 7 years
                  </span>
                </div>
                <div>
                  <strong>Exports &amp; bookkeeper seat</strong>{" "}
                  <span className="text-body">— your data travels with you</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Frequently asked questions" className="max-w-[760px]">
          <h2 className="m-0 mb-5 text-2xl font-semibold tracking-tight">
            Questions people actually ask
          </h2>
          <div className="flex flex-col border-t border-border">
            {FAQS.map(([q, a], i) => (
              <div key={q} className="border-b border-border">
                <button
                  type="button"
                  aria-expanded={open === i}
                  onClick={() => setOpen(open === i ? null : i)}
                  className="flex w-full items-center gap-3.5 border-0 bg-transparent px-1 py-4 text-left text-[15px] font-semibold hover:text-accent"
                >
                  <span className="flex-1">{q}</span>
                  <span aria-hidden="true" className="text-lg font-normal text-accent">
                    {open === i ? "−" : "+"}
                  </span>
                </button>
                {open === i && (
                  <p className="m-0 max-w-xl px-1 pb-5 text-sm leading-relaxed text-body">
                    {a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
