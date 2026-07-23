import { useId, useState, type ReactNode } from "react";

export interface TermChipProps {
  /** The Dutch term as it appears inline in a sentence, e.g. "btw". */
  nlTerm: string;
  /** Plain-English explanation. Real content is wired from GlossaryTerm in a later pillar. */
  definition?: ReactNode;
}

/**
 * The term-chip: a dotted-underline inline button that opens a short
 * explanation drawer, appearing everywhere a Dutch tax term does (ported
 * 1:1 from docs/design — see the "Term button" spec in the component
 * sheet and openTerm.* bindings throughout Kwartaal.dc.html).
 */
export function TermChip({ nlTerm, definition }: TermChipProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className="inline cursor-pointer border-0 border-b-2 border-dotted border-accent bg-transparent p-0 font-semibold text-ink [font:inherit] hover:bg-accent-tint"
      >
        {nlTerm}
      </button>
      {open && (
        <span
          id={panelId}
          role="tooltip"
          aria-label="Term explanation"
          className="absolute z-10 mt-2 w-72 rounded-card border border-border bg-surface p-4 text-[13px] leading-relaxed text-body shadow-card"
        >
          {definition ??
            `“${nlTerm}” — explained once the glossary is wired in a later pillar.`}
        </span>
      )}
    </span>
  );
}
