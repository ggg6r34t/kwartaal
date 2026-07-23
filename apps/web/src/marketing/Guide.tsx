import { Link } from "react-router-dom";
import { TermChip } from "../components/TermChip";
import { MarketingLayout } from "./MarketingLayout";

export function Guide() {
  return (
    <MarketingLayout current="/guide">
      <article className="mx-auto max-w-[680px] px-10 py-16">
        <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
          Expat tax guide · btw basics
        </div>
        <h1 className="m-0 mb-4 font-explainer text-[42px] font-medium leading-tight tracking-tight">
          Your first btw-aangifte, explained
        </h1>
        <p className="m-0 mb-2.5 font-explainer text-[19px] italic leading-relaxed text-body">
          The quarterly VAT return is the deadline expats meet first — and the one that
          teaches you how the whole Dutch system thinks.
        </p>
        <div className="mb-10 flex items-center gap-3.5 border-b border-border pb-6 text-[12.5px] text-faint">
          <span>By the Kwartaal team</span>
          <span>·</span>
          <span>8 min read</span>
          <span>·</span>
          <span>Updated October 2026</span>
          <span className="ml-auto rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
            Figures: tax year 2026
          </span>
        </div>

        <div className="flex flex-col gap-6 text-base leading-[1.75] text-ink">
          <p className="m-0">
            Somewhere in your first months as a ZZP'er, a quarter ends. Nothing dramatic
            happens — no letter, no alarm. But from that day you have one month to file a{" "}
            <TermChip
              nlTerm="btw-aangifte"
              definition="The quarterly VAT return — a short declaration of the VAT you collected and paid."
            />
            : a short declaration of the VAT you collected and the VAT you paid.
          </p>
          <p className="m-0">
            The good news: it's the same four numbers every quarter, and none of them are
            mysterious once you've seen where they come from. The btw on your invoices was
            never your money — you collected it on behalf of the Belastingdienst. The
            return is simply the moment you pass it on, minus the{" "}
            <TermChip
              nlTerm="voorbelasting"
              definition="The btw you already paid on business costs — reclaimable against what you owe."
            />{" "}
            you already paid on business costs.
          </p>

          <div className="rounded-control border border-accent-border bg-accent-tint p-6">
            <div className="mb-2 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-3 w-3 bg-accent [border-radius:0_100%_0_0]"
              />
              <span className="font-ui text-[11px] font-semibold uppercase tracking-wide text-accent">
                From your KVK registration
              </span>
            </div>
            <p className="m-0 text-[14.5px] leading-relaxed text-body">
              When you registered at the KVK, the Belastingdienst automatically gave you a
              btw-id and set your filing rhythm — for almost everyone, quarterly. Your
              first return covers the quarter in which you registered, even if you
              invoiced nothing.
            </p>
            <div className="mt-2.5 font-ui text-[11px] font-semibold text-faint">
              Tax year 2026 · verify against your own KVK letter
            </div>
          </div>

          <h2 className="m-0 mt-2 font-explainer text-[28px] font-medium tracking-tight">
            The four numbers
          </h2>
          <p className="m-0">
            The form organizes everything by{" "}
            <TermChip
              nlTerm="rubriek"
              definition="A numbered section on the btw-aangifte form."
            />{" "}
            — numbered sections. As a services freelancer you'll usually touch four:{" "}
            <span className="font-mono text-sm">1a</span> (income taxed at 21%),{" "}
            <span className="font-mono text-sm">1b</span> (the 9% rate, rare for
            services), <span className="font-mono text-sm">5b</span> (your voorbelasting),
            and <span className="font-mono text-sm">5c</span> — the difference, which is
            what you pay.
          </p>
          <p className="m-0">
            Take a concrete quarter: you invoiced €20.000 and collected €4.140 of btw. You
            bought a desk, software, and a monitor, paying €610 of btw along the way.
            Rubriek 5c reads €4.140 − €610 ={" "}
            <strong className="tabular-nums">€3.530</strong>. That's the whole return.
          </p>

          <h2 className="m-0 mt-2 font-explainer text-[28px] font-medium tracking-tight">
            Filing and paying are two acts
          </h2>
          <p className="m-0">
            You file in Mijn Belastingdienst Zakelijk — five minutes of typing once you
            have the numbers. Paying is separate: a bank transfer with a payment
            reference, due by the same deadline. Missing the payment while having filed on
            time is the most common first-year stumble; treat them as two boxes to tick,
            not one.
          </p>
          <p className="m-0">
            And if a quarter was zero — no invoices, no costs — you still file. A{" "}
            <em>nihilaangifte</em> takes two minutes and keeps the record clean.
          </p>
        </div>

        <aside
          aria-label="What this means for you"
          className="mt-10 rounded-card border border-border bg-surface p-7"
        >
          <div className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            What this means for you
          </div>
          <div className="flex flex-col gap-2.5 text-[14.5px] leading-relaxed">
            {[
              <>
                Your deadline is always <strong>one month after the quarter ends</strong>{" "}
                — 30 Apr, 31 Jul, 31 Oct, 31 Jan.
              </>,
              <>
                Set the btw aside <strong>when the invoice is paid</strong>, not when the
                deadline comes — it was never yours.
              </>,
              <>
                Keep receipts for anything with reclaimable btw — every €100 of
                voorbelasting is €100 off rubriek 5c.
              </>,
              <>
                File <strong>and</strong> pay — two acts, one deadline.
              </>,
            ].map((line, i) => (
              <div key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent"
                />
                <span>{line}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t border-border-hairline pt-3.5 text-xs leading-relaxed text-faint">
            This guide explains the system in general terms — it isn't tax advice, and
            your situation may differ. Mijn Belastingdienst has the final word.
          </div>
        </aside>

        <div className="bg-not-yours mt-9 flex flex-wrap items-center gap-5 rounded-control border border-accent-border bg-accent-tint p-6">
          <div className="min-w-[260px] flex-1">
            <div className="mb-1 text-[15px] font-semibold">
              Kwartaal walks you through this, live
            </div>
            <div className="text-[13px] leading-relaxed text-body">
              Your numbers, your deadline, every rubriek explained — first quarter free.
            </div>
          </div>
          <Link
            to="/pricing"
            className="rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white no-underline hover:bg-accent-hover"
          >
            Start free
          </Link>
        </div>
      </article>
    </MarketingLayout>
  );
}
