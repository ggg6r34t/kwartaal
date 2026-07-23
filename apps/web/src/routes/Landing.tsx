import { Link } from "react-router-dom";

/**
 * Placeholder public landing page. The full marketing site (Home, Pricing,
 * How it works, the expat tax guide, the companion-positioning page, legal
 * pages) is pixel-ported from docs/design/Kwartaal Site *.dc.html in
 * Pillar 5 — Pillar 1 only needs enough of a public route to link to sign-in.
 */
export function Landing() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="m-0 text-3xl font-semibold tracking-tight">Kwartaal</h1>
      <p className="mt-3 text-sm leading-relaxed text-body">
        A calm tax companion for expat entrepreneurs in the Netherlands. The marketing
        site lands in Pillar 5.
      </p>
      <Link
        to="/signin"
        className="mt-8 inline-block rounded-control bg-accent px-5 py-3 text-sm font-semibold text-white no-underline hover:bg-accent-hover"
      >
        Sign in
      </Link>
    </main>
  );
}
