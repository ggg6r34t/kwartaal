import { Fragment } from "react";
import { Link } from "react-router-dom";
import { MarketingLayout } from "./MarketingLayout";

const LEGAL_PAGES = [
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/dpa", label: "DPA" },
  { to: "/impressum", label: "Impressum" },
];

export interface LegalSection {
  heading: string;
  body: React.ReactNode;
}

/**
 * The shared shell docs/design specifies once ("Design pattern · legal page
 * template — shared by Privacy / Terms / DPA / Impressum"): a numbered
 * margin rail, the not-tax-advice callout up top, and a footer switcher
 * between the four pages. Only the title and sections change per page.
 */
export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-[820px] px-5 py-10 sm:px-10 sm:py-16">
        <div className="rounded-card border border-border bg-surface p-5 sm:p-9">
          <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-faint">
            Legal · last updated {updated}
          </div>
          <h1 className="m-0 mb-5 text-[28px] font-semibold tracking-tight">{title}</h1>

          <div
            aria-label="Not tax advice"
            className="mb-6 rounded-control border border-accent-border bg-accent-tint p-5"
          >
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-accent-ink">
              Read this first
            </div>
            <p className="m-0 font-explainer text-[15px] italic leading-relaxed">
              Kwartaal provides guidance, estimates, and reminders. It is not tax advice,
              and Kwartaal does not file returns on your behalf. Figures are computed from
              published rates for the tax year shown, and Mijn Belastingdienst has the
              final word.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-y-1 sm:grid-cols-[180px_1fr] sm:gap-x-7 sm:gap-y-2">
            {sections.map((section, i) => (
              <Fragment key={section.heading}>
                <div className="pt-0.5 text-xs font-semibold tabular-nums text-faint sm:font-normal">
                  {i + 1}. {section.heading}
                </div>
                <div className="mb-3.5 text-sm leading-relaxed text-ink">
                  {section.body}
                </div>
              </Fragment>
            ))}
          </div>

          <div className="mt-6 flex gap-4 border-t border-border-hairline pt-4 text-[12.5px]">
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                className={page.label === title ? "" : "text-body"}
              >
                {page.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
