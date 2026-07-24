import { Link } from "react-router-dom";
import { TermChip } from "../components/TermChip";
import { MarketingLayout } from "./MarketingLayout";

function StepHeading({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-2.5 flex items-baseline gap-3.5">
      <span className="text-xs font-bold tabular-nums text-accent">{n}</span>
      <h2 className="m-0 text-[23px] font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

export function HowItWorks() {
  return (
    <MarketingLayout current="/how-it-works">
      <div className="mx-auto max-w-[780px] px-5 py-10 sm:px-10 sm:py-16">
        <div className="mb-16">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-accent">
            How it works · one real quarter
          </div>
          <h1 className="m-0 mb-4 text-[28px] font-semibold leading-tight tracking-tight sm:text-[42px]">
            Twelve days in October, with Maya
          </h1>
          <p className="m-0 text-base leading-relaxed text-body">
            Maya is a freelance designer in Amsterdam — ZZP since 2024, about €72.000
            turnover this year. It's mid-October: Q3 closed on 30 September, and the
            btw-aangifte is due by 31 October. Here is the whole thing, start to closed
            drawer.
          </p>
          <div className="mt-3.5">
            <span className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
              Figures: tax year 2026 · estimates
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-16">
          <section aria-label="Step 1 — the reminder">
            <StepHeading n="01" title="A calm email, in time" />
            <p className="mb-5 text-sm leading-relaxed text-body">
              Kwartaal writes when there's something to do — not before, not breathlessly.
              Twelve days out is enough for a 25-minute job.
            </p>
            <div className="rounded-card border border-border bg-surface shadow-card">
              <div className="flex items-center gap-2.5 border-b border-border-hairline px-6 py-3.5 text-xs">
                <span
                  aria-hidden="true"
                  className="h-3.5 w-3.5 bg-accent [border-radius:0_100%_0_0]"
                />
                <span className="font-semibold">Kwartaal</span>
                <span className="hidden text-faint sm:inline">
                  hello@mail.kwartaal.app
                </span>
                <span className="ml-auto tabular-nums text-faint">Mon 19 Oct, 08:30</span>
              </div>
              <div className="px-7 py-6">
                <div className="mb-3 text-base font-semibold">
                  Q3 btw — due by 31 October{" "}
                  <span className="text-accent">(12 days)</span>
                </div>
                <p className="mb-2.5 text-sm leading-relaxed">Hi Maya,</p>
                <p className="mb-2.5 text-sm leading-relaxed text-body">
                  Q3 closed on 30 September. Your checklist is ready — the invoices and
                  receipts you added during the quarter are already in it, so expect about
                  25 minutes.
                </p>
                <p className="mb-4 text-sm leading-relaxed text-body">
                  Current estimate: you'll owe{" "}
                  <strong className="text-ink tabular-nums">around €3.500</strong>. You've
                  set aside €2.940 so far.
                </p>
                <span className="inline-block rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white">
                  Open the Q3 checklist
                </span>
              </div>
            </div>
          </section>

          <section aria-label="Step 2 — the checklist">
            <StepHeading n="02" title="Four steps, not forty" />
            <p className="mb-5 text-sm leading-relaxed text-body">
              The checklist opens with the quarter's work already gathered. Each step
              confirms something and echoes the number it produced — never a one-way door.
            </p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3.5 rounded-card border border-border bg-surface px-6 py-4">
                <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-state-settled text-white">
                  ✓
                </span>
                <span className="text-sm font-semibold">Income confirmed</span>
                <span className="text-[13px] tabular-nums text-body">
                  · €20.000,00 · btw €4.140,00
                </span>
                <span className="ml-auto text-[12.5px] font-semibold text-accent">
                  Edit
                </span>
              </div>
              <div className="flex items-start gap-3.5 rounded-card border border-accent-border bg-surface px-6 py-4 shadow-card">
                <span className="pt-0.5 text-xs font-bold tabular-nums text-accent">
                  02
                </span>
                <div>
                  <div className="text-[15px] font-semibold">
                    Confirm expenses with reclaimable btw
                  </div>
                  <div className="mt-0.5 text-[12.5px] tabular-nums text-body">
                    4 expenses · voorbelasting €610,00 so far
                  </div>
                </div>
              </div>
              {[
                "Check the numbers against the form",
                "File it, pay it, close the drawer",
              ].map((label, i) => (
                <div
                  key={label}
                  className="flex items-center gap-3.5 rounded-card border border-border bg-surface px-6 py-4 text-faint"
                >
                  <span className="text-xs font-bold tabular-nums">{`0${i + 3}`}</span>
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="ml-auto text-xs">after step {i + 2}</span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Step 3 — the mirror">
            <StepHeading n="03" title="The mirror — every number, explained" />
            <p className="mb-5 text-sm leading-relaxed text-body">
              Before Maya types anything into Mijn Belastingdienst, Kwartaal shows the
              same numbers the form will ask for — and why each one is what it is.
            </p>
            <div className="rounded-card border border-border bg-surface p-7 shadow-card tabular-nums">
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Q3 2026 · btw-aangifte
                </span>
                <span className="rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-body">
                  estimate
                </span>
              </div>
              <div className="flex justify-between border-b border-border-hairline py-2.5 text-sm">
                <span className="text-body">Btw you received on Q3 invoices</span>
                <span className="font-semibold">€4.140,00</span>
              </div>
              <div className="flex justify-between border-b border-border-hairline py-2.5 text-sm">
                <span className="text-body">
                  Btw you paid on costs —{" "}
                  <TermChip
                    nlTerm="voorbelasting"
                    definition="The btw you already paid on business costs — reclaimable against what you owe."
                  />
                </span>
                <span className="font-semibold">−€610,00</span>
              </div>
              <div className="flex items-baseline justify-between py-3.5">
                <span className="text-[15px] font-semibold">You owe for Q3</span>
                <span className="text-[28px] font-semibold tracking-tight">
                  €3.530,00
                </span>
              </div>
              <div className="mt-3 rounded-control bg-paper p-4">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                  Why this number
                </div>
                <div className="font-explainer text-sm italic leading-relaxed text-body">
                  You invoiced €20.000 this quarter and collected 21% btw on most of it.
                  You paid €610 of btw on a desk, software, and hardware. The difference
                  passes through you to the Belastingdienst — it was never your money,
                  which is why Kwartaal had you set it aside as you went.
                </div>
              </div>
            </div>
          </section>

          <section aria-label="Step 4 — the handoff">
            <StepHeading n="04" title="The handoff — rubriek by rubriek" />
            <p className="mb-5 text-sm leading-relaxed text-body">
              Mijn Belastingdienst asks for numbers by{" "}
              <TermChip
                nlTerm="rubriek"
                definition="A numbered section on the btw-aangifte form — each one asks for a specific figure."
              />
              . Kwartaal lays them out in the form's own order, ready to copy — the typing
              takes five minutes.
            </p>
            <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card tabular-nums">
              <div className="grid grid-cols-[44px_1fr_72px] sm:grid-cols-[64px_1fr_130px] gap-3 border-b border-border-hairline px-7 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
                <span>Rubriek</span>
                <span>What the form calls it</span>
                <span className="text-right">Your number</span>
              </div>
              {[
                ["1a", "Leveringen belast met 21%", "€4.095"],
                ["1b", "Leveringen belast met 9%", "€45"],
                ["5b", "Voorbelasting", "€610"],
              ].map(([code, label, amount]) => (
                <div
                  key={code}
                  className="grid grid-cols-[44px_1fr_72px] sm:grid-cols-[64px_1fr_130px] items-baseline gap-3 border-b border-border-hairline px-7 py-3.5 text-sm"
                >
                  <span className="font-mono text-[12.5px] font-semibold">{code}</span>
                  <span className="text-body">{label}</span>
                  <span className="text-right font-semibold">{amount}</span>
                </div>
              ))}
              <div className="grid grid-cols-[44px_1fr_72px] sm:grid-cols-[64px_1fr_130px] items-baseline gap-3 bg-accent-tint px-7 py-3.5 text-sm">
                <span className="font-mono text-[12.5px] font-semibold">5c</span>
                <span className="font-semibold">Te betalen</span>
                <span className="text-right text-base font-semibold">€3.530</span>
              </div>
              <div className="flex items-center gap-2.5 border-t border-border-hairline px-7 py-4">
                <span className="inline-block rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold">
                  Copy the numbers
                </span>
                <span className="text-xs text-faint">
                  Opens Mijn Belastingdienst in a new tab — you file, Kwartaal waits.
                </span>
              </div>
            </div>
          </section>

          <section aria-label="Step 5 — filed and paid">
            <StepHeading n="05" title="Two acts: filed, then paid" />
            <p className="mb-5 text-sm leading-relaxed text-body">
              Filing and paying are separate deadlines in real life, so they're separate
              confirmations here. Each one states its consequence.
            </p>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {[
                ["I filed it", "The aangifte is in. One thing left: the payment itself."],
                ["I paid it", "€3.530,00 with the payment reference — done means done."],
              ].map(([title, body]) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-card border border-border bg-surface p-5"
                >
                  <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-state-settled text-white">
                    ✓
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-0.5 block text-[12.5px] text-body">{body}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Step 6 — the drawer closes">
            <StepHeading n="06" title="The drawer closes" />
            <p className="mb-5 text-sm leading-relaxed text-body">
              No confetti, no streak. The quarter settles into the year with a small,
              satisfying weight — and stays in the Vault for seven years.
            </p>
            <div className="flex items-center gap-5 rounded-card border border-state-settled-border bg-state-settled-bg p-7">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-state-settled text-white">
                ✓
              </div>
              <div className="flex-1">
                <div className="mb-1 text-[19px] font-semibold tracking-tight">
                  Q3 is closed.
                </div>
                <div className="text-[13.5px] tabular-nums text-state-settled-ink">
                  Filed and paid on 22 October 2026 · 1a €4.095 · 1b €45 · 5b €610 · 5c
                  €3.530 · Q4 opens 1 January.
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-16 rounded-card border border-border bg-surface p-6 text-center sm:p-11">
          <h2 className="m-0 mb-2.5 text-[26px] font-semibold tracking-tight">
            Your Q4 could close like this.
          </h2>
          <p className="mb-5 text-sm text-body">
            The first quarter is free — no card, full access until the drawer closes.
          </p>
          <Link
            to="/pricing"
            className="inline-block rounded-control bg-accent px-5 py-3.5 text-[14.5px] font-semibold text-white no-underline hover:bg-accent-hover"
          >
            Start free
          </Link>
        </div>
      </div>
    </MarketingLayout>
  );
}
