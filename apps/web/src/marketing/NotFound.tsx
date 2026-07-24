import { Link } from "react-router-dom";
import { MarketingLayout } from "./MarketingLayout";

/** Product-voice 404 (docs/design's Kwartaal Site Patterns.dc.html). */
export function NotFound() {
  return (
    <MarketingLayout>
      <div className="mx-auto max-w-[1120px] px-5 py-10 sm:px-10 sm:py-16">
        <div className="rounded-card border border-border bg-surface px-5 py-16 text-center shadow-card sm:px-9 sm:py-24">
          <div className="mb-6 flex justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-border-strong bg-paper text-[15px] font-bold text-faint">
              ?
            </span>
          </div>
          <h1 className="m-0 mb-2.5 text-[32px] font-semibold tracking-tight">
            This page isn't on the calendar.
          </h1>
          <p className="mx-auto mb-6 max-w-md text-[15px] leading-relaxed text-body">
            Nothing is due, nothing is overdue — the address just doesn't exist. (Error
            404, if you're keeping records. We would be.)
          </p>
          <div className="flex justify-center gap-3.5">
            <Link
              to="/"
              className="rounded-control bg-accent px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
            >
              Back to the year
            </Link>
            <Link
              to="/guide"
              className="rounded-control border border-border-strong px-4 py-2.5 text-sm font-semibold text-ink no-underline hover:bg-wash"
            >
              Read the tax guide
            </Link>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
