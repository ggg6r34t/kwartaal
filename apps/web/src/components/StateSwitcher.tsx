import { useState } from "react";

export interface StateSwitcherGroup<T extends string = string> {
  label: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}

export interface StateSwitcherProps {
  title?: string;
  groups: StateSwitcherGroup[];
}

/**
 * Dev-only floating tool for forcing a screen into a specific design state
 * (e.g. Today's heroDue/heroMid/heroNew/heroOver/heroClosed) without live
 * data. Retained behind a flag through Pillar 3 per the build plan; gated
 * on import.meta.env.DEV so it never ships to production.
 */
export function StateSwitcher({ title = "State switcher", groups }: StateSwitcherProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!import.meta.env.DEV || groups.length === 0) return null;

  return (
    <div
      data-no-print
      className="fixed bottom-4 right-4 z-50 w-72 rounded-card border border-border-strong bg-surface p-4 text-[12.5px] shadow-dialog"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          {title}
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-accent"
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <fieldset key={group.label} className="border-0 p-0">
              <legend className="mb-1 text-[11px] font-semibold text-body">
                {group.label}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => group.onChange(option.value)}
                    className={[
                      "rounded-control border px-2 py-1 text-[11.5px] font-medium",
                      group.value === option.value
                        ? "border-accent bg-accent-tint text-accent"
                        : "border-border text-body hover:bg-wash",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}
