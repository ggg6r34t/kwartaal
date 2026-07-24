import { useState } from "react";
import { Link } from "react-router-dom";

const NAV_LINKS = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/pricing", label: "Pricing" },
  { to: "/guide", label: "Tax guide" },
  { to: "/companion", label: "Works alongside" },
];

/** Nav + footer shared by every public page (docs/design's Kwartaal Site *.dc.html header/footer, ported once). */
export function MarketingLayout({
  current,
  children,
}: {
  current?: string;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border-hairline">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-[1120px] items-center gap-7 px-5 py-4 md:px-10 md:py-5"
        >
          <Link to="/" className="flex items-center gap-2.5 text-ink no-underline">
            <span
              aria-hidden="true"
              className="block h-5 w-5 bg-accent [border-radius:0_100%_0_0]"
            />
            <span className="text-[16.5px] font-bold tracking-tight">Kwartaal</span>
          </Link>
          <div className="ml-auto hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={current === link.to ? "page" : undefined}
                className={`text-[13.5px] font-medium no-underline hover:text-accent ${
                  current === link.to ? "font-semibold text-accent" : "text-ink"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/pricing"
              className="rounded-control bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white no-underline hover:bg-accent-hover"
            >
              Start free
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-3 md:hidden">
            <Link
              to="/pricing"
              className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white no-underline hover:bg-accent-hover"
            >
              Start free
            </Link>
            <button
              type="button"
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav-panel"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileNavOpen((open) => !open)}
              className="flex h-11 w-11 flex-none flex-col items-center justify-center gap-1.5 rounded-control hover:bg-wash"
            >
              <span aria-hidden="true" className="block h-[1.5px] w-5 bg-ink" />
              <span aria-hidden="true" className="block h-[1.5px] w-5 bg-ink" />
            </button>
          </div>
        </nav>

        {mobileNavOpen && (
          <div
            id="mobile-nav-panel"
            className="border-t border-border-hairline px-5 py-3 md:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  aria-current={current === link.to ? "page" : undefined}
                  onClick={() => setMobileNavOpen(false)}
                  className={`min-h-[44px] rounded-control px-3 py-2.5 text-[14px] font-medium leading-[19px] no-underline hover:bg-wash ${
                    current === link.to ? "font-semibold text-accent" : "text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      <main>{children}</main>

      <footer className="border-t border-border bg-wash">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-5 px-5 py-8 text-xs text-faint sm:px-10">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="block h-3.5 w-3.5 bg-accent [border-radius:0_100%_0_0]"
            />
            <strong className="text-ink">Kwartaal</strong>
          </span>
          <span>© 2026 Kwartaal B.V. · EU data residency · privacy-first</span>
          <Link to="/privacy" className="text-body no-underline hover:text-accent">
            Privacy &amp; terms
          </Link>
          <span className="ml-auto flex gap-2">
            <span className="font-semibold text-ink">EN</span>
            <span aria-hidden="true">·</span>
            <span>NL — coming soon</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
