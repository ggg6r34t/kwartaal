#!/usr/bin/env node
// CLAUDE.md styling architecture, item 7: greps apps/web/src (excluding
// theme.css) for raw color values and var()-arbitrary Tailwind classes.
// Any hit fails the build unless annotated with an explicit same-line
// `/* token-exception: <reason> */`, in which case it's counted but passes —
// the exception count is printed so it can only shrink over time.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const TARGET_DIR = join(ROOT, "apps/web/src");
const EXEMPT_FILES = new Set(["theme.css"]);
const EXTENSIONS = new Set([".ts", ".tsx", ".css"]);

const RAW_COLOR_PATTERN = /#[0-9a-fA-F]{3,8}\b|hsl\(|oklch\(|rgb\(|color-mix\(/;
const ARBITRARY_VAR_PATTERN = /\[[^\]]*var\([^\]]*\]/;
const EXCEPTION_PATTERN = /\/\*\s*token-exception:\s*.+?\*\//;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, files);
    } else if (EXTENSIONS.has(extname(full))) {
      files.push(full);
    }
  }
  return files;
}

let files = [];
try {
  files = walk(TARGET_DIR);
} catch {
  console.log("token-discipline-check: apps/web/src not found yet — nothing to check.");
  process.exit(0);
}

let violations = 0;
let exceptions = 0;

for (const file of files) {
  const base = file.split(/[\\/]/).pop();
  if (EXEMPT_FILES.has(base)) continue;

  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const hit = RAW_COLOR_PATTERN.test(line) || ARBITRARY_VAR_PATTERN.test(line);
    if (!hit) return;

    const relPath = relative(ROOT, file);
    if (EXCEPTION_PATTERN.test(line)) {
      exceptions += 1;
      console.log(`  exception: ${relPath}:${i + 1}`);
    } else {
      violations += 1;
      console.error(`  violation: ${relPath}:${i + 1}: ${line.trim()}`);
    }
  });
}

console.log(
  `token-discipline-check: ${violations} violation(s), ${exceptions} reviewed exception(s).`,
);

if (violations > 0) {
  console.error(
    "token-discipline-check: FAILED — raw color values or var()-arbitrary classes found outside theme.css.",
  );
  process.exit(1);
}

console.log("token-discipline-check: PASSED.");
