import { Link } from "react-router-dom";

/**
 * docs/design's Auth session: "One shared shell: mark + wordmark over a
 * single ~400px card on paper." Reused by every auth screen (sign in, sign
 * up, check-your-inbox, magic-link outcomes, forgot/reset password,
 * bookkeeper invite) — the mark links home, never traps a lost user.
 */
export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-wash px-6 py-16">
      <Link to="/" className="mb-5 flex items-center gap-2 text-ink no-underline">
        <span
          aria-hidden="true"
          className="block h-[22px] w-[22px] bg-accent [border-radius:0_100%_0_0]"
        />
        <span className="text-base font-semibold tracking-tight">kwartaal</span>
      </Link>
      <div className="w-full max-w-[400px] rounded-card border border-border bg-surface p-7 shadow-card">
        {children}
      </div>
      {footer && <div className="mt-4 w-full max-w-[400px]">{footer}</div>}
    </div>
  );
}

/** The "GDPR-native. Your data stays on EU servers." line under the card, sign-in/sign-up only. */
export function AuthGdprNote() {
  return (
    <div className="mt-4 border-t border-border-hairline pt-3.5 text-center font-explainer text-[13.5px] italic text-body">
      GDPR-native. Your data stays on EU servers.
    </div>
  );
}

/** Privacy/Terms/EN·NL row shown below the card on sign-in and sign-up only. */
export function AuthFooterLinks() {
  return (
    <div className="flex items-center justify-center gap-3.5 text-xs text-faint">
      <Link to="/privacy" className="text-body no-underline hover:text-accent">
        Privacy
      </Link>
      <Link to="/terms" className="text-body no-underline hover:text-accent">
        Terms
      </Link>
      <span className="flex items-center gap-1.5">
        <span className="font-semibold text-ink">EN</span>
        <span aria-hidden="true">&middot;</span>
        <span>NL &mdash; coming soon</span>
      </span>
    </div>
  );
}
