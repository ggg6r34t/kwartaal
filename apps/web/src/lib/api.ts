const BASE = import.meta.env.VITE_API_URL ?? "/api";

/** For plain `<a href>`/download links that need the API origin but not a fetch call. */
export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

let onUnauthenticated: (() => void) | null = null;

export function setOnUnauthenticated(handler: () => void): void {
  onUnauthenticated = handler;
}

/**
 * Fires whenever any mutation hits requireProForMutations' 402 — the
 * paywall is reactive by design (the design's own interstitial "fires
 * after the first drawer-close", not preemptively disabled buttons), so a
 * single global hook here is enough to catch every gated action app-wide
 * without threading entitlement checks through every screen.
 */
let onEntitlementRequired: (() => void) | null = null;

export function setOnEntitlementRequired(handler: () => void): void {
  onEntitlementRequired = handler;
}

/** Paths are API-root-relative (apiFetch("/orgs/me")); credentials always included so the session cookie rides along. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    onUnauthenticated?.();
  }

  if (response.status === 402) {
    onEntitlementRequired?.();
  }

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: "unknown-error" }) as { error: string });
    throw new ApiError(response.status, body.error ?? "unknown-error");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
