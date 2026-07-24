import { useCallback, useEffect, useState } from "react";
import type { SetAsideEntry } from "@kwartaal/core";
import { apiFetch } from "../lib/api";

export function useSetAsideEntries() {
  const [entries, setEntries] = useState<SetAsideEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const data = await apiFetch<SetAsideEntry[]>("/money/set-aside-entries");
    setEntries(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refetch().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refetch]);

  return { entries, loading, refetch };
}
