import { useState } from "react";
import { useGlossary } from "../hooks/useGlossary";

export function Glossary() {
  const { terms, loading } = useGlossary();
  const [query, setQuery] = useState("");

  const filtered = (terms ?? []).filter((term) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      term.nlTerm.toLowerCase().includes(q) ||
      term.enGloss.toLowerCase().includes(q) ||
      term.plainExplanation.toLowerCase().includes(q)
    );
  });

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
        {!loading && filtered.length === 0 && (
          <p className="text-sm text-body">No terms match "{query}".</p>
        )}
      </div>
    </div>
  );
}
