// SSG prerender + sitemap.xml + OG images, run after `vite build` and
// `vite build --ssr src/entry-server.tsx --outDir dist-ssr` (see
// package.json's `build` script). Plain Node — no Vite runtime needed here,
// the SSR bundle is already a self-contained ESM module.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");
const SITE_ORIGIN = process.env.SITE_ORIGIN ?? "https://kwartaal.nl";

const PAGE_META = {
  "/": {
    title: "Kwartaal — a calm tax companion for expat entrepreneurs in the Netherlands",
    description:
      "Kwartaal guides you through the Dutch tax year — what's due, what every number means, and how much to set aside. Your first quarter is free.",
    headline: "Dutch taxes,\nminus the dread.",
  },
  "/pricing": {
    title: "Pricing — Kwartaal",
    description:
      "One price, the year included. €10/month billed yearly, first quarter free — no card required.",
    headline: "One price.\nThe year included.",
  },
  "/how-it-works": {
    title: "How it works — Kwartaal",
    description:
      "Twelve days in October, with Maya — one real quarter, start to closed drawer.",
    headline: "Twelve days in\nOctober, with Maya",
  },
  "/guide": {
    title: "Expat tax guide — Kwartaal",
    description:
      "Your first btw-aangifte, explained — the Dutch VAT return in plain language.",
    headline: "Your first\nbtw-aangifte,\nexplained",
  },
  "/about": {
    title: "About — Kwartaal",
    description:
      "Built by two people who both missed a btw deadline in their first year in the Netherlands.",
    headline: "We moved\nhere too.",
  },
  "/companion": {
    title: "Kwartaal + your bookkeeping tool",
    description:
      "Keep your tools. Add the understanding. Kwartaal works alongside Moneybird, Declair, e-Boekhouden, or any CSV.",
    headline: "Keep your tools.\nAdd the\nunderstanding.",
  },
  "/privacy": {
    title: "Privacy — Kwartaal",
    description:
      "How Kwartaal handles your data — GDPR-native, EU data residency, export or delete any time.",
    headline: "Privacy",
  },
  "/terms": {
    title: "Terms — Kwartaal",
    description: "The terms of using Kwartaal's tax companion service.",
    headline: "Terms",
  },
  "/dpa": {
    title: "Data Processing Agreement — Kwartaal",
    description: "Kwartaal's data processing agreement summary for business customers.",
    headline: "DPA",
  },
  "/impressum": {
    title: "Impressum — Kwartaal",
    description: "Kwartaal B.V. company and contact details.",
    headline: "Impressum",
  },
};

function escapeXml(value) {
  return value.replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );
}

/** The design's OG template (Kwartaal Site Patterns.dc.html): paper background, wordmark top-left, headline, timeline strip as the signature motif. */
function buildOgSvg(headline) {
  const lines = headline.split("\n");
  const lineHeight = 62;
  const startY = 300;
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="64" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");

  const timelineNodes = [true, true, false, null, null]
    .map((state, i) => {
      const cx = 94 + i * 160;
      if (state === true) {
        return `<circle cx="${cx}" cy="0" r="16" fill="#5F7B5A"/><path d="M${cx - 6} 1 L${cx - 2} 5 L${cx + 6} -5" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
      if (state === false) {
        return `<circle cx="${cx}" cy="0" r="16" fill="#fff" stroke="#C24E12" stroke-width="2.5"/>`;
      }
      return `<circle cx="${cx}" cy="0" r="16" fill="#FAF8F3" stroke="#C9C0B0" stroke-width="2" stroke-dasharray="4 3"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FAF8F3"/>
  <path d="M1200 630 L860 630 A340 340 0 0 1 1200 290 Z" fill="#F3E4D3"/>
  <path d="M56 56 h34 a34 34 0 0 1 0 34 h-34 Z" fill="#C24E12"/>
  <text x="104" y="83" font-family="sans-serif" font-size="28" font-weight="700" fill="#1F1B16">Kwartaal</text>
  <text font-family="sans-serif" font-size="52" font-weight="600" fill="#1F1B16">${tspans}</text>
  <text x="64" y="${startY + lines.length * lineHeight + 34}" font-family="sans-serif" font-style="italic" font-size="22" fill="#7A7266">For self-employed expats in the Netherlands</text>
  <g transform="translate(64, 566)">
    <line x1="30" y1="0" x2="610" y2="0" stroke="#EAE4D8" stroke-width="2"/>
    ${timelineNodes}
  </g>
</svg>`;
}

function renderOgImage(headline, outPath) {
  const svg = buildOgSvg(headline);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } });
  const png = resvg.render().asPng();
  writeFileSync(outPath, png);
}

async function main() {
  const { render, PUBLIC_ROUTES } = await import("../dist-ssr/entry-server.js");
  const template = readFileSync(path.join(DIST, "index.html"), "utf-8");

  mkdirSync(path.join(DIST, "og"), { recursive: true });

  for (const route of PUBLIC_ROUTES) {
    const meta = PAGE_META[route];
    const appHtml = render(route);
    const ogPath = `/og${route === "/" ? "/home" : route}.png`;
    renderOgImage(meta.headline, path.join(DIST, ogPath.slice(1)));

    let html = template.replace(
      '<div id="root"></div>',
      `<div id="root">${appHtml}</div>`,
    );
    html = html.replace(/<title>.*?<\/title>/, `<title>${escapeXml(meta.title)}</title>`);
    const headExtra = [
      `<meta name="description" content="${escapeXml(meta.description)}">`,
      `<link rel="canonical" href="${SITE_ORIGIN}${route}">`,
      `<meta property="og:title" content="${escapeXml(meta.title)}">`,
      `<meta property="og:description" content="${escapeXml(meta.description)}">`,
      `<meta property="og:image" content="${SITE_ORIGIN}${ogPath}">`,
      `<meta property="og:type" content="website">`,
      `<meta name="twitter:card" content="summary_large_image">`,
    ].join("\n    ");
    html = html.replace("</title>", "</title>\n    " + headExtra);

    const outDir = route === "/" ? DIST : path.join(DIST, route);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "index.html"), html);
  }

  // 404.html for Cloudflare Pages' not-found fallback — same product-voice page, no meta injection needed.
  const notFoundHtml = template.replace(
    '<div id="root"></div>',
    `<div id="root">${render("/this-page-does-not-exist")}</div>`,
  );
  writeFileSync(path.join(DIST, "404.html"), notFoundHtml);

  const sitemapUrls = PUBLIC_ROUTES.map(
    (route) => `  <url><loc>${SITE_ORIGIN}${route}</loc></url>`,
  ).join("\n");
  writeFileSync(
    path.join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapUrls}\n</urlset>\n`,
  );
  writeFileSync(
    path.join(DIST, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
  );

  console.log(
    `Prerendered ${PUBLIC_ROUTES.length} public routes + 404.html, sitemap.xml, robots.txt, and ${PUBLIC_ROUTES.length} OG images.`,
  );
}

await main();
