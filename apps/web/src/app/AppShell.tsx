import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { daysUntilDue } from "@kwartaal/core";
import type { MeResponse } from "@kwartaal/core";
import { primaryNav, secondaryNav, mobileTabNav, type NavItem } from "./nav";
import { useMe } from "../hooks/useMe";
import { useDeadlines } from "../hooks/useDeadlines";
import { setOnEntitlementRequired } from "../lib/api";
import { PaywallInterstitial } from "../components/PaywallInterstitial";
import { ExplainModeProvider } from "./explain-mode-context";

function NavButton({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          "flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left font-ui text-[13.5px] font-medium text-ink no-underline",
          isActive ? "bg-wash" : "hover:bg-wash",
        ].join(" ")
      }
    >
      <Icon className="text-faint" />
      <span>{item.label}</span>
    </NavLink>
  );
}

/**
 * Distinct from hasProAccess: the trial grants Pro-equivalent access before
 * the first quarter closes, but that's not the same claim as "you are a
 * paying Pro subscriber" — showing "Pro" during the free trial would be
 * misleading about what happens at the gate.
 */
function PlanBadge({ me }: { me: MeResponse }) {
  const onTrial = me.businessProfile?.firstQuarterClosedAt == null;
  const label = onTrial ? "Trial" : me.hasProAccess ? "Pro" : "Free";
  return (
    <span
      className={`flex-none rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
        label === "Pro"
          ? "bg-state-settled-bg text-state-settled-ink"
          : "bg-wash text-faint"
      }`}
    >
      {label}
    </span>
  );
}

/** VAT tab's accent dot: the same "urgent" threshold HeroCard uses on Today (days <= 14, including overdue). */
function useVatUrgent(): boolean {
  const { deadlines } = useDeadlines();
  return useMemo(() => {
    if (!deadlines) return false;
    const now = new Date();
    return deadlines.some(
      (d) => d.kind === "btw_q" && !d.dismissedAt && daysUntilDue(d.dueDate, now) <= 14,
    );
  }, [deadlines]);
}

function MobileTabBar() {
  const vatUrgent = useVatUrgent();
  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t border-border bg-surface md:hidden"
    >
      {mobileTabNav.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 py-2 font-ui text-[11px] font-medium no-underline",
                isActive ? "text-accent" : "text-faint",
              ].join(" ")
            }
          >
            <span className="relative">
              <Icon className="text-current" />
              {item.label === "VAT" && vatUrgent && (
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-accent"
                />
              )}
            </span>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** App shell: sidebar + nav + user card, ported 1:1 from docs/design (Kwartaal.dc.html). */
export function AppShell() {
  const { me } = useMe();
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    setOnEntitlementRequired(() => setShowPaywall(true));
    return () => setOnEntitlementRequired(() => {});
  }, []);

  return (
    <ExplainModeProvider enabledFromServer={me?.explainModeEnabled}>
      <AppShellLayout
        me={me}
        showPaywall={showPaywall}
        onDismissPaywall={() => setShowPaywall(false)}
      />
    </ExplainModeProvider>
  );
}

function AppShellLayout({
  me,
  showPaywall,
  onDismissPaywall,
}: {
  me: MeResponse | null;
  showPaywall: boolean;
  onDismissPaywall: () => void;
}) {
  return (
    <div className="flex min-h-screen">
      {showPaywall && <PaywallInterstitial onDismiss={onDismissPaywall} />}
      <nav
        aria-label="Main"
        className="sticky top-0 hidden h-screen w-56 flex-none flex-col border-r border-border px-3 py-5 md:flex"
      >
        <div className="flex items-center gap-2.5 px-3 pb-6 pt-1.5">
          <span
            aria-hidden="true"
            className="relative block h-[26px] w-[26px] rounded-full border-[1.5px] border-ink bg-surface"
          >
            <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 bg-accent [border-radius:0_10px_0_0]" />
          </span>
          <span className="text-base font-bold tracking-tight">Kwartaal</span>
        </div>

        <div className="flex flex-col gap-0.5">
          {primaryNav.map((item) => (
            <NavButton key={item.to} item={item} />
          ))}
        </div>

        <div className="my-3.5 h-px bg-border" />

        <div className="flex flex-col gap-0.5">
          {secondaryNav.map((item) => (
            <NavButton key={item.to} item={item} />
          ))}
        </div>

        <div className="mt-auto flex items-center gap-2.5 border-t border-border px-3 pt-2.5">
          <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-wash text-[11px] font-semibold text-body">
            {initialsFor(me?.org.name ?? "Kwartaal")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold">
              {me?.org.name ?? "Loading…"}
            </div>
            <div className="text-[11px] text-body">
              {me?.businessProfile?.legalForm ?? "—"}
            </div>
          </div>
          {me && <PlanBadge me={me} />}
        </div>
      </nav>

      <div className="flex min-h-screen w-full flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-border bg-surface px-4 py-3 md:hidden">
          <span
            aria-hidden="true"
            className="relative block h-[22px] w-[22px] rounded-full border-[1.5px] border-ink bg-surface"
          >
            <span className="absolute right-0.5 top-0.5 h-2 w-2 bg-accent [border-radius:0_10px_0_0]" />
          </span>
          <span className="text-sm font-bold tracking-tight">Kwartaal</span>
        </header>

        <main className="box-border flex-1 overflow-y-auto px-4 pb-24 pt-6 md:h-screen md:px-12 md:pb-16 md:pt-11">
          <Outlet />
        </main>

        <MobileTabBar />
      </div>
    </div>
  );
}
