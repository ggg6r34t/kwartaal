/**
 * Every token in src/theme.css maps to a semantic utility here — named by
 * MEANING, never by appearance (CLAUDE.md styling architecture, item 2).
 * Values are var(--token) references only; no raw hex/hsl/rgb/color-mix
 * originates in this file.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--color-paper)",
        ink: "var(--color-ink)",
        body: "var(--color-body)",
        faint: "var(--color-faint)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        "border-hairline": "var(--color-border-hairline)",
        wash: "var(--color-wash)",
        selection: "var(--color-selection)",
        surface: "var(--color-surface)",

        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          tint: "var(--color-accent-tint)",
          border: "var(--color-accent-soft-border)",
          ink: "var(--color-accent-ink)",
        },

        "state-settled": {
          DEFAULT: "var(--color-state-settled)",
          ink: "var(--color-state-settled-ink)",
          bg: "var(--color-state-settled-bg)",
          border: "var(--color-state-settled-border)",
        },
        "state-due-soon": {
          DEFAULT: "var(--color-state-due-soon)",
          bg: "var(--color-state-due-soon-bg)",
          border: "var(--color-state-due-soon-border)",
        },
        "state-overdue": {
          DEFAULT: "var(--color-state-overdue)",
          hover: "var(--color-state-overdue-hover)",
          bg: "var(--color-state-overdue-bg)",
          border: "var(--color-state-overdue-border)",
        },
        "state-open": {
          DEFAULT: "var(--color-state-open)",
          border: "var(--color-state-open-border)",
        },
        "state-future": {
          DEFAULT: "var(--color-state-future)",
          border: "var(--color-state-future-border)",
        },
        "state-neutral": {
          DEFAULT: "var(--color-state-neutral)",
          bg: "var(--color-state-neutral-bg)",
          border: "var(--color-state-neutral-border)",
        },

        pending: {
          border: "var(--color-pending-border)",
          figure: "var(--color-pending-figure)",
          "callout-bg": "var(--color-pending-callout-bg)",
          "callout-border": "var(--color-pending-callout-border)",
          "callout-icon": "var(--color-pending-callout-icon)",
        },

        sage: {
          DEFAULT: "var(--color-sage)",
          ink: "var(--color-sage-ink)",
          bg: "var(--color-sage-bg)",
        },
        amber: {
          DEFAULT: "var(--color-amber)",
          ink: "var(--color-amber-ink)",
          bg: "var(--color-amber-bg)",
        },
        clay: {
          DEFAULT: "var(--color-clay)",
          bg: "var(--color-clay-bg)",
        },

        sand: "var(--color-sand)",
        reserve: "var(--color-reserve)",

        "overlay-scrim": "var(--shadow-overlay-scrim)",
      },
      backgroundImage: {
        "not-yours": "var(--hatch-not-yours)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        dialog: "var(--shadow-dialog)",
      },
      ringColor: {
        focus: "var(--ring-focus)",
      },
      fontFamily: {
        ui: "var(--font-ui)",
        explainer: "var(--font-explainer)",
      },
    },
  },
  plugins: [],
};
