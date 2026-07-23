import { useState } from "react";
import { TermChip } from "../components/TermChip";
import { StateSwitcher } from "../components/StateSwitcher";

type DemoHeroState = "due" | "mid" | "new";

/**
 * Pillar 1 builds the shell, nav, term-chip, and state-switcher components —
 * the screens themselves (Today, VAT, ...) are ported pixel-faithfully in
 * Pillars 3-5 per the build order. This placeholder proves the shell mounts
 * real routes and demonstrates the two components with live state, rather
 * than shipping a dead stub.
 */
export function PlaceholderScreen({ title, pillar }: { title: string; pillar: number }) {
  const [heroState, setHeroState] = useState<DemoHeroState>("due");

  return (
    <div>
      <h1 className="m-0 text-[30px] font-semibold tracking-tight">{title}</h1>
      <p className="mb-6 mt-2 max-w-xl text-sm leading-relaxed text-body">
        Built in Pillar {pillar} against the live tax engine and data model. This is the
        app shell only — nav, term-chip, and the dev state-switcher, ported from{" "}
        <code>docs/design</code> in Pillar 1.
      </p>
      <p className="text-sm text-body">
        Term-chip demo: your{" "}
        <TermChip
          nlTerm="btw"
          definition="Belasting toegevoegde waarde — Dutch VAT. Charged on most invoices, reclaimable on business purchases."
        />{" "}
        is explained inline. Demo hero state: <strong>{heroState}</strong>.
      </p>
      <StateSwitcher
        title="Today — hero state (demo)"
        groups={[
          {
            label: "Hero card",
            value: heroState,
            onChange: (value) => setHeroState(value as DemoHeroState),
            options: [
              { label: "Due soon", value: "due" },
              { label: "Mid-quarter", value: "mid" },
              { label: "New org", value: "new" },
            ],
          },
        ]}
      />
    </div>
  );
}
