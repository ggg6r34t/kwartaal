import { MarketingLayout } from "./MarketingLayout";

export function About() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-[680px] px-5 py-10 sm:px-10 sm:py-16">
        <section aria-label="About">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-accent">
            About
          </div>
          <h1 className="m-0 mb-5 text-[28px] font-semibold leading-tight tracking-tight sm:text-[38px]">
            We moved here too.
          </h1>
          <div className="flex flex-col gap-5 text-[15.5px] leading-relaxed text-ink">
            <p className="m-0">
              Kwartaal is built by two people who both missed a btw deadline in their
              first year in the Netherlands — not from laziness, but because nobody tells
              you the quarter ended. One of us is a designer who freelanced through it;
              the other spent years building financial software and translating
              Belastingdienst letters for friends.
            </p>
            <p className="m-0">
              We built the tool we wanted that first October: something that watches the
              calendar, explains the words, and shows the arithmetic — without pretending
              to be an accountant, and without asking you to abandon the tools you already
              use.
            </p>
            <p className="m-0 font-explainer text-[17px] italic text-body">
              Kwartaal will never file for you. Understanding is the product.
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {[
              ["F1", "Founder name", "Design · ex-freelancer, Amsterdam"],
              ["F2", "Founder name", "Engineering · fintech, Rotterdam"],
            ].map(([initials, name, role]) => (
              <div
                key={initials}
                className="flex items-center gap-3.5 rounded-card border border-border bg-surface p-5"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-border bg-wash text-[15px] font-semibold text-body"
                >
                  {initials}
                </span>
                <div>
                  <div className="text-sm font-semibold">{name}</div>
                  <div className="text-[12.5px] text-body">{role}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3.5 flex items-start gap-4 rounded-card border border-border bg-surface p-5">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border border-state-settled-border bg-state-settled-bg"
            >
              <span className="text-state-settled">✓</span>
            </span>
            <div>
              <div className="mb-0.5 text-sm font-semibold">
                EU data residency, privacy-first
              </div>
              <div className="text-[13px] leading-relaxed text-body">
                Your data lives on EU servers, under GDPR, and is never sold or used to
                train anything. Export or delete it whenever you like — it's yours.
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Contact" className="mt-14 border-t border-border pt-9">
          <h2 className="m-0 mb-3.5 text-2xl font-semibold tracking-tight">Contact</h2>
          <div className="flex flex-col gap-2.5 text-[14.5px] leading-relaxed">
            <div>
              <strong>Product &amp; support</strong> —{" "}
              <a href="mailto:hallo@kwartaal.nl">hallo@kwartaal.nl</a>{" "}
              <span className="text-faint">· we answer within one working day</span>
            </div>
            <div>
              <strong>Privacy</strong> —{" "}
              <a href="mailto:privacy@kwartaal.nl">privacy@kwartaal.nl</a>
            </div>
            <div>
              <strong>Post</strong>{" "}
              <span className="text-body">
                — Kwartaal B.V. · KVK 87654321 · Amsterdam, the Netherlands
              </span>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-faint">
            One thing we can't do by email: give tax advice about your situation. For
            that, a bookkeeper or belastingadviseur is the right person — Pro includes a
            seat for them.
          </p>
        </section>
      </div>
    </MarketingLayout>
  );
}
