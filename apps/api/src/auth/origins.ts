/** Falls back to localhost when no origin vars are set. */
export function parseTrustedOrigins(...vars: (string | undefined)[]): string[] {
  const origins = vars
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean);
  return origins.length > 0
    ? origins
    : ["http://localhost:5173", "http://localhost:8787"];
}
