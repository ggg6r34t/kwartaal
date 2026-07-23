import { Link } from "react-router-dom";
import { MarketingLayout } from "./MarketingLayout";

export function Companion() {
  return (
    <MarketingLayout current="/companion">
      <div className="mx-auto max-w-[1120px] px-10 py-16">
        <div className="mb-14 max-w-[640px]">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-accent">
            Kwartaal + your bookkeeping tool
          </div>
          <h1 className="m-0 mb-4 text-[42px] font-semibold leading-tight tracking-tight">
            Keep your tools. Add the understanding.
          </h1>
          <p className="m-0 text-base leading-relaxed text-body">
            Kwartaal isn't a bookkeeping tool and doesn't want to be. It works alongside
            whatever you invoice with — different jobs, same numbers.
          </p>
        </div>

        <section aria-label="Division of labor" className="mb-4 grid grid-cols-2 gap-5">
          <div className="rounded-card border border-border bg-surface p-8">
            <div className="mb-5 text-[11px] font-semibold uppercase tracking-wide text-faint">
              Your bookkeeping tool does
            </div>
            <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed">
              {[
                ["Invoicing", "sending, chasing, getting paid"],
                ["The ledger", "every transaction, categorized and correct"],
                ["Bank feeds", "reconciliation, day in, day out"],
              ].map(([title, body]) => (
                <div key={title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-sand"
                  />
                  <span>
                    <strong>{title}</strong> <span className="text-body">— {body}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-card border border-accent-border bg-surface p-8">
            <div className="mb-5 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 bg-accent [border-radius:0_100%_0_0]"
              />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                Kwartaal does
              </span>
            </div>
            <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed">
              {[
                ["Deadlines", "the four quarters and the annual return, watched for you"],
                [
                  "Understanding",
                  "every figure mirrored and explained, in your vocabulary",
                ],
                ["Estimates", "what you'll owe and what to set aside, all year"],
              ].map(([title, body]) => (
                <div key={title} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent"
                  />
                  <span>
                    <strong>{title}</strong> <span className="text-body">— {body}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <p className="mb-14 text-center font-explainer text-base italic text-body">
          <span className="text-accent">※</span> Two lanes, no versus. Your numbers flow
          one way: from your books into your understanding.
        </p>

        <section
          aria-label="Imports"
          className="mb-14 rounded-card border border-border bg-surface p-9"
        >
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-xl font-semibold tracking-tight">
              Bring the numbers in
            </h2>
            <span className="text-xs text-faint">
              Read-only imports · you approve every sync · disconnect any time
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {["Moneybird", "Declair", "e-Boekhouden"].map((tool) => (
              <span
                key={tool}
                className="rounded-control border border-border px-6 py-3.5 text-[15px] font-semibold text-body"
              >
                {tool}
              </span>
            ))}
            <span className="rounded-control border border-dashed border-border-strong px-6 py-3.5 text-[15px] font-semibold text-body">
              any CSV
            </span>
          </div>
          <div className="mt-4 text-xs leading-relaxed text-faint">
            Names shown for compatibility only — these products aren't affiliated with
            Kwartaal. Imports pull totals and btw amounts, never your client details
            unless you say so.
          </div>
        </section>

        <section
          aria-label="Common questions"
          className="flex max-w-[760px] flex-col gap-11"
        >
          <div>
            <h2 className="m-0 mb-3 text-2xl font-semibold tracking-tight">
              "Do I still need Moneybird or Declair?"
            </h2>
            <p className="mb-3 text-[15px] leading-relaxed text-body">
              Yes — keep it. You still need to send invoices, chase payments, and keep a
              ledger; that's what those tools are excellent at. Kwartaal never duplicates
              that work. It takes the totals your tool already knows and does the other
              job: telling you what's due when, what the numbers mean, and how much of
              what you earned isn't really yours yet.
            </p>
            <p className="m-0 font-explainer text-[15.5px] italic text-body">
              Your invoicing tool is where money moves. Kwartaal is where it makes sense.
            </p>
          </div>
          <div>
            <h2 className="m-0 mb-3 text-2xl font-semibold tracking-tight">
              "Why pay, when e-Boekhouden is free for starters?"
            </h2>
            <p className="mb-3 text-[15px] leading-relaxed text-body">
              Because it's a different category. Free bookkeeping gives you correct books
              — it doesn't tell you that Q3 closes in twelve days, doesn't explain what
              voorbelasting means on the form in front of you, and doesn't estimate next
              May's income-tax bill in October. Kwartaal is the layer that teaches you the
              system and never lets you miss a deadline.
            </p>
            <p className="m-0 text-[15px] leading-relaxed text-body">
              If e-Boekhouden works for you, wonderful — connect it, and let Kwartaal do
              the part no ledger does.
            </p>
          </div>
        </section>

        <div className="mt-16 rounded-card border border-border bg-surface p-10 text-center">
          <h2 className="m-0 mb-2.5 text-2xl font-semibold tracking-tight">
            Connect your tool in the first ten minutes.
          </h2>
          <p className="mb-5 text-sm text-body">
            Or start with a CSV — Kwartaal meets your numbers where they are.
          </p>
          <Link
            to="/pricing"
            className="inline-block rounded-control bg-accent px-5 py-3.5 text-[14.5px] font-semibold text-white no-underline hover:bg-accent-hover"
          >
            Start free — your first quarter is on us
          </Link>
        </div>
      </div>
    </MarketingLayout>
  );
}
