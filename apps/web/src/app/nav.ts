import type { ComponentType } from "react";
import {
  GlossaryIcon,
  IncomeTaxIcon,
  MoneyIcon,
  SettingsIcon,
  TodayIcon,
  VatIcon,
  VaultIcon,
} from "../components/icons";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
}

/** Data-driven nav, ported 1:1 from docs/design's sidebar (Kwartaal.dc.html). */
export const primaryNav: NavItem[] = [
  { label: "Today", to: "/app/today", icon: TodayIcon },
  { label: "VAT", to: "/app/vat", icon: VatIcon },
  { label: "Income tax", to: "/app/income-tax", icon: IncomeTaxIcon },
  { label: "Money", to: "/app/money", icon: MoneyIcon },
  { label: "Vault", to: "/app/vault", icon: VaultIcon },
];

export const secondaryNav: NavItem[] = [
  { label: "Glossary", to: "/app/glossary", icon: GlossaryIcon },
  { label: "Settings", to: "/app/settings", icon: SettingsIcon },
];

/** The mobile bottom tab bar's four stops, per Kwartaal Mobile.dc.html — a deliberate subset of primaryNav (no Income tax, no secondaryNav). */
export const mobileTabNav: NavItem[] = [
  { label: "Today", to: "/app/today", icon: TodayIcon },
  { label: "VAT", to: "/app/vat", icon: VatIcon },
  { label: "Money", to: "/app/money", icon: MoneyIcon },
  { label: "Vault", to: "/app/vault", icon: VaultIcon },
];
