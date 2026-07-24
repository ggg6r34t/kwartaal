import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetch } from "../lib/api";

interface ExplainModeContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
}

const ExplainModeContext = createContext<ExplainModeContextValue | null>(null);

/**
 * App-wide "Explain notes" state (docs/design's Learn layer, `explainOn`).
 * Defaults to true immediately (matching the server-side default —
 * `users.explainModeEnabled` — so there's no true/false flash for a fresh
 * user), then syncs once from `useMe()`'s real value the first time it
 * arrives. Only that first sync applies — a later `me` refetch (e.g. after
 * onboarding) never clobbers a toggle the user already made in this
 * session. Toggling calls the real endpoint and updates this context
 * immediately, so every `<ExplainNote>` anywhere in the tree reacts
 * app-wide without a page reload.
 */
export function ExplainModeProvider({
  enabledFromServer,
  children,
}: {
  enabledFromServer: boolean | undefined;
  children: React.ReactNode;
}) {
  const [enabled, setEnabledState] = useState(true);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!syncedRef.current && enabledFromServer !== undefined) {
      syncedRef.current = true;
      setEnabledState(enabledFromServer);
    }
  }, [enabledFromServer]);

  const setEnabled = useCallback(async (next: boolean) => {
    setEnabledState(next);
    await apiFetch("/orgs/me/explain-mode", {
      method: "PATCH",
      body: JSON.stringify({ enabled: next }),
    });
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return (
    <ExplainModeContext.Provider value={value}>{children}</ExplainModeContext.Provider>
  );
}

/** True (never throws) outside a provider — e.g. marketing pages, which have no Explain notes to show. */
export function useExplainMode(): ExplainModeContextValue {
  const ctx = useContext(ExplainModeContext);
  return ctx ?? { enabled: false, setEnabled: async () => {} };
}
