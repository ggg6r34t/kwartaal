import { CheckIcon } from "./icons";

export type QuarterTimelineState =
  "settled" | "dueSoon" | "overdue" | "open" | "future" | "handledElsewhere";

export interface TimelineNode {
  key: string;
  label: string;
  dueLabel: string;
  state: QuarterTimelineState;
  daysLeft?: number;
  stateLabel?: string;
  onClick?: () => void;
}

function NodeShape({ node }: { node: TimelineNode }) {
  const base = "flex h-7 w-7 items-center justify-center";
  switch (node.state) {
    case "settled":
      return (
        <div className={`${base} rounded-lg bg-state-settled`}>
          <CheckIcon className="text-white" />
        </div>
      );
    case "handledElsewhere":
      return (
        <div
          className={`${base} rounded-lg border-[1.5px] border-state-neutral-border bg-state-neutral-bg`}
        >
          <span
            aria-hidden="true"
            className="h-0.5 w-2.5 rounded-full bg-state-neutral"
          />
        </div>
      );
    case "dueSoon":
      return (
        <div
          className={`${base} rounded-full border-2 border-accent text-[11px] font-bold text-accent`}
        >
          {node.daysLeft}
        </div>
      );
    case "overdue":
      return (
        <div
          className={`${base} rounded-full bg-state-overdue text-sm font-bold text-white`}
        >
          !
        </div>
      );
    case "open":
      return (
        <div
          className={`${base} rounded-full border-2 border-state-open-border bg-surface`}
        >
          <span aria-hidden="true" className="h-[9px] w-[9px] rounded-full bg-ink" />
        </div>
      );
    case "future":
    default:
      return (
        <div
          className={`${base} rounded-full border-2 border-dashed border-state-future-border bg-paper`}
        />
      );
  }
}

const LABEL_COLOR: Record<QuarterTimelineState, string> = {
  settled: "text-state-settled",
  handledElsewhere: "text-state-neutral",
  dueSoon: "text-accent",
  overdue: "text-state-overdue",
  open: "text-body",
  future: "text-faint",
};

/** The year-as-interface timeline, ported 1:1 from docs/design's tlA variant, extended with the handled_elsewhere neutral node from the App Additions design. */
export function YearTimeline({ nodes }: { nodes: TimelineNode[] }) {
  return (
    <div className="relative" aria-label="Year timeline">
      <div
        aria-hidden="true"
        className="absolute left-9 right-9 top-[13px] h-px bg-border"
      />
      <div className="relative flex justify-between">
        {nodes.map((node) => (
          <button
            key={node.key}
            type="button"
            onClick={node.onClick}
            disabled={!node.onClick}
            className="flex min-w-[88px] flex-col items-center gap-2 border-0 bg-transparent p-0 disabled:cursor-default"
          >
            <NodeShape node={node} />
            <div className="text-center">
              <div className="text-[13px] font-semibold text-ink">{node.label}</div>
              <div className="text-xs text-body">{node.dueLabel}</div>
              {node.stateLabel && (
                <div
                  className={`mt-0.5 text-xs font-semibold ${LABEL_COLOR[node.state]}`}
                >
                  {node.stateLabel}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
