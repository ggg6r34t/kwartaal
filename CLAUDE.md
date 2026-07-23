# CLAUDE.md — Kwartaal repo rules

KWARTAAL-BUILD-PLAN.md is the execution contract; where anything here or in
STACK-BLUEPRINT.md conflicts with it, the plan wins — except the styling
architecture below, which is binding repo-wide and deliberately OVERRIDES the
blueprint §9 two-system split (Hackiwi's Tailwind-public / scoped-console-css
idiom). Kwartaal uses ONE token system for both the marketing site and the app.

## Styling architecture (binding from the first component)

1. **Single token source.** All design tokens live as CSS custom properties in
   one file: `apps/web/src/theme.css`. This includes, at minimum: the paper/ink
   neutrals, the accent (deep NL-orange, sparingly), the deadline-state colors
   (`settled`, `open`, `due-soon`, `overdue`, `neutral` for handled_elsewhere),
   the "not your money" tint/hatch recipe, semantic sage/amber/clay, radii,
   shadows, the focus ring, spacing scale where non-Tailwind-default, and the
   two font stacks (UI grotesque + the serif explainer accent). No hex, hsl,
   oklch, or color-mix values anywhere else in the codebase — not in
   components, not in tailwind.config.js (which references the custom
   properties), not in SVGs where avoidable (currentColor + tokens).

2. **Every token has a named utility.** `tailwind.config.js` maps every token
   to a semantic Tailwind utility: `paper`, `ink`, `accent`, `state-settled`,
   `state-due-soon`, `state-overdue`, `state-neutral`, `not-yours`, `sage`,
   `amber`, `clay`, `radius-card`, `radius-control`, `ring-focus`, etc. Naming
   is by MEANING, never by appearance (`state-overdue`, not `red-600`).

3. **Components style via Tailwind utilities only.** No arbitrary-value
   classes containing `var(` or `color-mix`; no one-off `[color:...]` escapes.
   If a needed color or recipe has no utility, the change is: add the token to
   theme.css → add the mapping to tailwind.config.js → then use it. Two
   commits' discipline beats a hundred scattered one-offs.

4. **Repetition becomes components.** A style pattern used 3+ times becomes a
   shared component that carries its accessibility attributes with it
   (term-chip, deadline node, decision card, estimate-disclaimer footer,
   amount-with-not-yours treatment). A shared class-constants module is
   allowed ONLY for purely layout patterns with no semantics and no a11y
   surface.

5. **Inline `style={}` only for runtime-dynamic values** (a progress ring's
   percentage, a chart bar's computed width, a waterfall step's height).
   Never for anything expressible as a token + utility.

6. **Native CSS beyond theme.css is limited to:** `:focus-visible` styling,
   `prefers-reduced-motion` overrides (including the drawer-close fallback),
   and print styles (the bookkeeper summary and handoff card must print
   cleanly). Anything else appearing in a `.css` file is a violation.

7. **Enforcement, not intention.** From Pillar 1, CI runs a token-discipline
   check: a script greps `apps/web/src` (excluding theme.css) for raw color
   values (`#[0-9a-fA-F]{3,8}\b`, `hsl(`, `oklch(`, `rgb(`, `color-mix(`) and
   for arbitrary-value Tailwind classes containing `var(`; any hit fails the
   build. Reviewed exceptions require an explicit
   `/* token-exception: <reason> */` on the same line, and the check reports
   the exception count so it can only shrink.

## Why this exists

The deadline-state system, the "not your money" treatment, and the term-chip
are the product's visual identity, and every one of them must render
identically across Today, the VAT flow, emails-adjacent surfaces, and print.
One token source is what makes the a11y guarantees (contrast, never
color-alone, reduced-motion) checkable in one place instead of everywhere.
