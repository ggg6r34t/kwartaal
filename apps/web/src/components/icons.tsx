/**
 * Nav icons ported 1:1 from docs/design, redrawn with currentColor so they
 * inherit color from a Tailwind text utility instead of a hardcoded stroke
 * hex (CLAUDE.md item 1: "not in SVGs where avoidable — currentColor + tokens").
 */
type IconProps = { className?: string };

export function TodayIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}

export function VatIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 8 L8 2 A6 6 0 0 1 14 8 Z" fill="currentColor" />
    </svg>
  );
}

export function IncomeTaxIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
    >
      <rect x="2" y="8" width="3" height="6" fill="currentColor" />
      <rect x="6.5" y="5" width="3" height="9" fill="currentColor" />
      <rect x="11" y="2" width="3" height="12" fill="currentColor" />
    </svg>
  );
}

export function MoneyIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 8 h6 M5.8 5.8 h4.4 M5.8 10.2 h4.4"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
    </svg>
  );
}

export function VaultIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="2.5"
        y="3"
        width="11"
        height="10"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M5.5 6.5 h5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function GlossaryIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
    >
      <rect
        x="3"
        y="2.5"
        width="10"
        height="11"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M6.2 2.5 v11" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
    >
      <path d="M2.5 5.5 h11 M2.5 10.5 h11" stroke="currentColor" strokeWidth="1.5" />
      <circle
        cx="10.5"
        cy="5.5"
        r="2"
        fill="var(--color-paper)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="5.5"
        cy="10.5"
        r="2"
        fill="var(--color-paper)"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M2 6.5 5 9.5 10 3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
