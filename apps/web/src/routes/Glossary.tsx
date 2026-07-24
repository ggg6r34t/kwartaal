import { useState } from "react";
import { useGlossary } from "../hooks/useGlossary";

export function Glossary() {
  const { terms, loading } = useGlossary();
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();

  // No search entered = the full list, always — the no-match message is
  // only ever for a genuinely non-empty query with zero matches, never
  // shown just because the term list hasn't loaded yet or happens to be
  // empty (see health.ts's `/health/ready` for why an empty glossary
  // itself should never reach production).
  const filtered = (terms ?? []).filter((term) => {
    if (!trimmedQuery) return true;
    const q = trimmedQuery.toLowerCase();
    return (
      term.nlTerm.toLowerCase().includes(q) ||
      term.enGloss.toLowerCase().includes(q) ||
      term.plainExplanation.toLowerCase().includes(q)
    );
  });
  const showNoMatch = !loading && trimmedQuery.length > 0 && filtered.length === 0;

  return (
    <div>
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">Glossary</h1>
      <p className="mb-6 mt-2 max-w-xl text-sm leading-relaxed text-body">
        The Dutch tax words you'll meet, explained once here and everywhere they appear as
        a term-chip.
      </p>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search glossary"
        aria-label="Search glossary"
        className="mb-6 w-full max-w-sm rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-sm text-ink"
      />

      {loading && <p className="text-sm text-body">Loading…</p>}

      <div className="flex flex-col gap-3">
        {filtered.map((term) => (
          <section
            key={term.slug}
            className="rounded-card border border-border bg-surface p-5"
          >
            <div className="flex items-baseline gap-2.5">
              <h2 className="m-0 text-base font-semibold">{term.nlTerm}</h2>
              <span className="text-xs font-medium text-faint">{term.enGloss}</span>
              {term.depth === "stub" && (
                <span className="ml-auto rounded-pill border border-border bg-surface px-2 py-0.5 text-[11px] font-semibold text-body">
                  stub
                </span>
              )}
            </div>
            <p className="mb-2 mt-2 text-sm leading-relaxed text-ink">
              {term.plainExplanation}
            </p>
            <p className="m-0 text-xs text-faint">
              Where you'll see it: {term.whereYoullSeeIt}
            </p>
          </section>
        ))}
        {showNoMatch && (
          <p className="text-sm text-body">No terms match "{trimmedQuery}".</p>
        )}
      </div>
    </div>
  );
}
