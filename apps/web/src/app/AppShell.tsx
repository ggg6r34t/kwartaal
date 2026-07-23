import { NavLink, Outlet } from "react-router-dom";
import { primaryNav, secondaryNav, type NavItem } from "./nav";
import { useMe } from "../hooks/useMe";

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

  return (
    <div className="flex min-h-screen">
      <nav
        aria-label="Main"
        className="sticky top-0 box-border flex h-screen w-56 flex-none flex-col border-r border-border px-3 py-5"
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
          <div>
            <div className="text-[12.5px] font-semibold">
              {me?.org.name ?? "Loading…"}
            </div>
            <div className="text-[11px] text-body">
              {me?.businessProfile?.legalForm ?? "—"}
            </div>
          </div>
        </div>
      </nav>

      <main className="box-border h-screen flex-1 overflow-y-auto">
        <div className="px-12 pb-16 pt-11">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
