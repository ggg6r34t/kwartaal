import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-server/**",
      "**/.wrangler/**",
      "**/node_modules/**",
      "packages/db/migrations/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // TypeScript already catches undefined identifiers (including ambient
    // globals like Request/URL/PagesFunction from workers-types/DOM lib,
    // which core ESLint's no-undef doesn't understand) — see typescript-eslint's
    // own guidance on why no-undef is redundant/false-positive-prone on .ts files.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-undef": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.js", "*.config.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
      },
    },
  },
  {
    // Tenant guard non-negotiable: route modules reach the DB only through
    // c.get("tenantDb") (a TenantDb). Importing the raw Database/createDb
    // here would be the "half-adopted guard" failure mode STACK-BLUEPRINT
    // §11(b)#1 flags — a guard that isn't the only path is theatre.
    files: ["apps/api/src/routes/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@kwartaal/db",
              importNames: ["createDb", "Database"],
              message:
                'Route modules must not import the raw Database/createDb — use c.get("tenantDb") instead. See packages/db/src/tenant.ts.',
            },
          ],
        },
      ],
    },
  },
);
