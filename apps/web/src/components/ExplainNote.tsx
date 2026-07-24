import { useExplainMode } from "../app/explain-mode-context";

/**
 * One editorial ※ aside from docs/design's Learn layer (`explainOn`) —
 * hidden entirely (not just visually) when Explain notes are off, so it
 * never occupies layout space or an accessibility-tree node either way:
 * nothing to announce, nothing to tab to, and nothing for a toggle to
 * shift around underneath other controls.
 */
export function ExplainNote({ children }: { children: React.ReactNode }) {
  const { enabled } = useExplainMode();
  if (!enabled) return null;

  return (
    <p className="animate-explain-in mb-5 font-explainer text-[15.5px] italic leading-relaxed text-body">
      <span aria-hidden="true" className="text-accent">
        ※
      </span>{" "}
      {children}
    </p>
  );
}
