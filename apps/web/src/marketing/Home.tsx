import { Link } from "react-router-dom";
import { formatCents, splitInvoice } from "@kwartaal/core";
import { TermChip } from "../components/TermChip";
import { SetAsideCalculator } from "../components/SetAsideCalculator";
import { MarketingLayout } from "./MarketingLayout";

const TIMELINE = [
  { label: "Q1", date: "30 Apr", status: "Settled", settled: true },
  { label: "Q2", date: "31 Jul", status: "Settled", settled: true },
  { label: "Q3", date: "31 Oct", status: "Due in 12 days", due: true },
  { label: "Q4", date: "31 Jan '27", status: "Opens 1 Oct", future: true },
  { label: "Annual return", date: "1 May '27", status: "Opens 1 Mar", future: true },
];

export function Home() {
  return (
    <MarketingLayout current="/">
      <section
        aria-label="Hero"
        className="mx-auto max-w-[1120px] px-5 pb-8 pt-10 sm:px-10 md:pt-16"
      >
        <div className="max-w-[640px]">
          <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
            For self-employed expats in the Netherlands
          </div>
          <h1 className="m-0 mb-5 text-[34px] font-semibold leading-[1.1] tracking-tight md:text-[52px] md:leading-[1.08]">
            Dutch taxes, minus the dread.
          </h1>
          <p className="mb-6 max-w-[540px] text-[15px] leading-relaxed text-body md:text-[17px]">
            Kwartaal guides you through the Dutch tax year — what's due, what every number
            means, and how much to set aside. It never files for you; it makes sure you
            understand what you file.
          </p>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
            <Link
              to="/pricing"
              className="min-h-[44px] rounded-control bg-accent px-5 py-3.5 text-[15px] font-semibold text-white no-underline hover:bg-accent-hover"
            >
              Start free — your first quarter is on us
            </Link>
            <Link to="/how-it-works" className="text-sm font-semibold no-underline">
              See how it works
            </Link>
          </div>
          <div className="mt-3 text-[12.5px] text-faint">
            No card. Full access until you close your first quarter.
          </div>
        </div>

        <div
          aria-label="The year at a glance"
          className="mt-10 rounded-card border border-border bg-surface p-5 pb-6 shadow-card sm:p-9 sm:pb-7 md:mt-14"
        >
          <div className="mb-6 flex items-baseline justify-between md:mb-7">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Your 2026, mid-October
            </div>
            <span className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
              Figures: tax year 2026
            </span>
          </div>
          <div className="flex flex-col gap-3.5 md:flex-row md:justify-between">
            {TIMELINE.map((step) => (
              <div
                key={step.label}
                className="flex items-center gap-3 md:min-w-[110px] md:flex-col md:items-center md:gap-2.5"
              >
                {step.settled ? (
                  <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-state-settled text-white">
                    ✓
                  </div>
                ) : step.due ? (
                  <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border-[2.5px] border-accent text-[12.5px] font-bold text-accent tabular-nums">
                    12
                  </div>
                ) : (
                  <div className="h-[34px] w-[34px] flex-none rounded-full border-2 border-dashed border-border-strong bg-paper" />
                )}
                <div className="flex flex-1 items-baseline justify-between gap-2 md:block md:text-center">
                  <div
                    className={`text-sm font-semibold ${step.future ? "text-body" : ""}`}
                  >
                    {step.label}
                  </div>
                  <div className="flex items-baseline gap-2 md:block">
                    <span className="text-xs tabular-nums text-body">{step.date}</span>
                    <span
                      className={`text-xs font-semibold md:mt-0.5 md:block ${
                        step.settled
                          ? "text-state-settled"
                          : step.due
                            ? "text-accent"
                            : "text-faint"
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-border-hairline pt-4 font-explainer text-[15px] italic text-body">
            <span className="text-accent">※</span> The year is the interface: four drawers
            and one annual return. A closed drawer is the whole reward.
          </div>
        </div>
      </section>

      <section
        aria-label="Set-aside calculator"
        className="mx-auto max-w-[1120px] px-5 py-8 sm:px-10 sm:py-10"
      >
        <div className="bg-not-yours rounded-card border border-accent-border bg-accent-tint p-5 sm:p-9">
          <h2 className="m-0 mb-2.5 text-lg font-semibold tracking-tight sm:text-[23px]">
            A client just paid you. Now what?
          </h2>
          <p className="mb-4 max-w-lg text-sm leading-relaxed text-body">
            Type the amount — Kwartaal shows what's yours, what's btw, and what to reserve
            for income tax.
          </p>
          <div className="hidden md:block">
            <SetAsideCalculator />
          </div>
          <div className="md:hidden">
            <SetAsideTeaser />
          </div>
        </div>
      </section>

      <section
        aria-label="What Kwartaal does"
        className="mx-auto flex max-w-[1120px] flex-col gap-10 px-5 py-10 sm:gap-14 sm:px-10 sm:py-16"
      >
        <FeatureRow
          eyebrow="Deadlines"
          title="Never meet a deadline by surprise"
          body="Four btw quarters and one annual return — that's the whole year. Kwartaal watches the calendar so you don't have to, and writes to you like a person when something needs doing."
        >
          <div className="rounded-card border border-border bg-surface shadow-card">
            <div className="flex items-center gap-2.5 border-b border-border-hairline px-6 py-3.5">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 bg-accent [border-radius:0_100%_0_0]"
              />
              <span className="text-[12.5px] font-semibold">Kwartaal</span>
              <span className="text-xs text-faint">hello@mail.kwartaal.app</span>
            </div>
            <div className="px-6 py-5">
              <div className="mb-2 text-[15px] font-semibold">
                Q3 btw — due by 31 October <span className="text-accent">(12 days)</span>
              </div>
              <p className="mb-3.5 text-[13.5px] leading-relaxed text-body">
                Hi Maya — Q3 closed on 30 September. Your checklist is ready: invoices and
                receipts are already in the Vault, so this takes about 25 minutes.
              </p>
              <span className="inline-block rounded-control bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-white">
                Open the Q3 checklist
              </span>
            </div>
          </div>
        </FeatureRow>

        <FeatureRow
          eyebrow="Understanding"
          title="Understand every number you file"
          body="Kwartaal mirrors the official form and explains each figure in plain language — before you type it into Mijn Belastingdienst. Estimates, clearly marked; the Belastingdienst has the final word."
          reverse
        >
          <div className="rounded-card border border-border bg-surface p-6 shadow-card tabular-nums">
            <div className="flex justify-between border-b border-border-hairline py-2 text-[13.5px]">
              <span className="text-body">Btw you received</span>
              <span className="font-semibold">€4.140,00</span>
            </div>
            <div className="flex justify-between border-b border-border-hairline py-2 text-[13.5px]">
              <span className="text-body">Btw you paid on costs (voorbelasting)</span>
              <span className="font-semibold">−€610,00</span>
            </div>
            <div className="flex items-baseline justify-between py-2.5">
              <span className="text-sm font-semibold">You'll owe</span>
              <span className="text-2xl font-semibold tracking-tight">€3.530,00</span>
            </div>
            <div className="mt-1.5 rounded-control bg-paper p-3.5">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                Why this number
              </div>
              <div className="font-explainer text-sm italic leading-relaxed text-body">
                You collected €4.140 of btw on Q3 invoices and paid €610 on business
                costs. The difference passes through you — it was never your money.
              </div>
            </div>
          </div>
        </FeatureRow>

        <FeatureRow
          eyebrow="Vocabulary"
          title="Learn the Dutch words as you go"
          body="The official forms are in Dutch — so Kwartaal keeps the Dutch terms, explains each one the first time, and dots it ever after. By your second quarter, the form reads like yours."
        >
          <div className="rounded-card border border-border bg-surface p-6 shadow-card">
            <p className="m-0 text-[14.5px] leading-relaxed">
              Your reclaimable{" "}
              <TermChip
                nlTerm="voorbelasting"
                definition="The btw you already paid on business costs — it reduces what you pass on to the Belastingdienst."
              />{" "}
              for Q3 is €610 — it comes off what you owe.
            </p>
          </div>
        </FeatureRow>
      </section>

      <section
        aria-label="What Kwartaal is not"
        className="border-y border-border bg-wash"
      >
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-4 px-5 py-10 sm:gap-11 sm:px-10 sm:py-16 md:grid-cols-[220px_1fr]">
          <div className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">
            What Kwartaal is not
          </div>
          <div>
            <p className="mb-5 max-w-2xl font-explainer text-lg italic leading-snug sm:text-[26px]">
              Kwartaal doesn't file your return, doesn't do your bookkeeping, and doesn't
              replace your bookkeeper. It guides, estimates, and reminds — you stay the
              one who files, and the one who understands why.
            </p>
            <div className="flex flex-wrap gap-4 text-[13px] text-body sm:gap-6">
              <span>Filing happens in Mijn Belastingdienst — by you</span>
              <span>Invoicing stays in the tool you already use</span>
              <span>Complex situations still deserve a professional</span>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Testimonial"
        className="mx-auto max-w-[1120px] px-5 py-10 sm:px-10 sm:py-16"
      >
        <div className="mx-auto max-w-2xl text-center">
          <span
            aria-hidden="true"
            className="mx-auto mb-5 block h-5 w-5 bg-accent [border-radius:0_100%_0_0]"
          />
          <blockquote className="m-0 mb-4 font-explainer text-[23px] italic leading-relaxed">
            "Placeholder testimonial — two sentences in the customer's own words about the
            first quarter they closed without dread."
          </blockquote>
          <div className="text-[13px] text-body">
            <strong className="text-ink">Name Placeholder</strong> · freelance designer,
            Amsterdam · ZZP since 2024
          </div>
        </div>
      </section>

      <section
        aria-label="Start"
        className="mx-auto max-w-[1120px] px-5 pb-16 pt-8 text-center sm:px-10 sm:pb-20 sm:pt-10"
      >
        <h2 className="m-0 mb-3 text-[34px] font-semibold tracking-tight">
          Your next deadline can feel like this.
        </h2>
        <p className="mb-6 text-[15px] text-body">
          Set up in ten minutes. Kwartaal takes it from there.
        </p>
        <Link
          to="/pricing"
          className="inline-block rounded-control bg-accent px-6 py-3.5 text-[15px] font-semibold text-white no-underline hover:bg-accent-hover"
        >
          Start free — your first quarter is on us
        </Link>
        <div className="mt-3 text-[12.5px] text-faint">
          No card. Your data stays exportable, always.
        </div>
      </section>
    </MarketingLayout>
  );
}

function FeatureRow({
  eyebrow,
  title,
  body,
  reverse,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  reverse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2 md:gap-12">
      <div className={reverse ? "md:order-2" : "md:order-1"}>
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
          {eyebrow}
        </div>
        <h2 className="m-0 mb-3 text-xl font-semibold leading-snug tracking-tight sm:text-[28px]">
          {title}
        </h2>
        <p className="m-0 text-[15px] leading-relaxed text-body">{body}</p>
      </div>
      <div className={reverse ? "md:order-1" : "md:order-2"}>{children}</div>
    </div>
  );
}

const TEASER_SPLIT = splitInvoice(242000, 21, 3000);

/**
 * The mobile pass's condensed split-teaser (Kwartaal Site Home.dc.html
 * annex): a compact, non-interactive one-line summary — not the full
 * calculator. Still computed via the real `splitInvoice`, on a fixed
 * example amount, so the numbers are real even though the widget isn't
 * interactive at this size.
 */
function SetAsideTeaser() {
  return (
    <div className="mt-6 rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="mb-3 text-sm font-semibold text-ink">
        A client just paid you €2.420?
      </div>
      <div className="flex h-3 overflow-hidden rounded-control border border-border">
        <div className="bg-sand" style={{ width: "58%" }} />
        <div className="bg-not-yours" style={{ width: "17%" }} />
        <div className="bg-reserve" style={{ width: "25%" }} />
      </div>
      <p className="m-0 mt-2.5 text-[13px] tabular-nums text-body">
        Yours {formatCents(TEASER_SPLIT.yoursCents)} · btw{" "}
        {formatCents(TEASER_SPLIT.vatCents)} · reserve{" "}
        {formatCents(TEASER_SPLIT.reserveCents)}
      </p>
    </div>
  );
}
