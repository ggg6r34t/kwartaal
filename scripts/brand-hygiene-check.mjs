#!/usr/bin/env node
// Kwartaal and the sibling product this account also runs are separate
// products; this repo must stand alone. Fails the build on any
// case-insensitive "provata" mention in a tracked file. Three exemptions:
// STACK-BLUEPRINT.md (an external input document, read-only), PROGRESS.md
// (the build log/audit trail — it must be able to name what a brand-
// hygiene sweep found and fixed, the same way a security report names the
// vulnerability it closed), and this script itself (it necessarily
// contains the pattern it's checking for).

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const SELF = relative(ROOT, fileURLToPath(import.meta.url)).replaceAll("\\", "/");
const EXEMPT_FILES = new Set(["STACK-BLUEPRINT.md", "PROGRESS.md", SELF]);
const PATTERN = /provata/i;

const trackedFiles = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

let violations = 0;

for (const relPath of trackedFiles) {
  if (EXEMPT_FILES.has(relPath)) continue;

  let content;
  try {
    content = readFileSync(join(ROOT, relPath), "utf8");
  } catch {
    continue; // binary or unreadable — not a text mention
  }

  content.split("\n").forEach((line, i) => {
    if (PATTERN.test(line)) {
      violations += 1;
      console.error(`  violation: ${relPath}:${i + 1}: ${line.trim()}`);
    }
  });
}

console.log(`brand-hygiene-check: ${violations} violation(s).`);

if (violations > 0) {
  console.error(
    "brand-hygiene-check: FAILED — 'provata' found outside STACK-BLUEPRINT.md.",
  );
  process.exit(1);
}

console.log("brand-hygiene-check: PASSED.");
