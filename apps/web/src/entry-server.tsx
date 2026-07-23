import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Home } from "./marketing/Home";
import { Pricing } from "./marketing/Pricing";
import { HowItWorks } from "./marketing/HowItWorks";
import { Guide } from "./marketing/Guide";
import { About } from "./marketing/About";
import { Companion } from "./marketing/Companion";
import { Privacy } from "./marketing/Privacy";
import { Terms } from "./marketing/Terms";
import { Dpa } from "./marketing/Dpa";
import { Impressum } from "./marketing/Impressum";
import { NotFound } from "./marketing/NotFound";

/**
 * SSG prerender entry (KWARTAAL-BUILD-PLAN "all public pages with SSG
 * prerender"). Deliberately renders only the public marketing pages
 * directly — never the full <App/> route tree — so this never touches
 * Better Auth's useSession or any hook that assumes a browser (window,
 * document, fetch-on-mount) under Node. scripts/prerender.mjs calls
 * `render(path)` for each entry in PUBLIC_ROUTES below.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/pricing",
  "/how-it-works",
  "/guide",
  "/about",
  "/companion",
  "/privacy",
  "/terms",
  "/dpa",
  "/impressum",
] as const;

const PAGES: Record<(typeof PUBLIC_ROUTES)[number], () => React.ReactElement> = {
  "/": Home,
  "/pricing": Pricing,
  "/how-it-works": HowItWorks,
  "/guide": Guide,
  "/about": About,
  "/companion": Companion,
  "/privacy": Privacy,
  "/terms": Terms,
  "/dpa": Dpa,
  "/impressum": Impressum,
};

export function render(path: string): string {
  const Page = PAGES[path as (typeof PUBLIC_ROUTES)[number]] ?? NotFound;
  return renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>,
  );
}
