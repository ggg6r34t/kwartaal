import { useCallback, useEffect, useState } from "react";
import type { Quarter } from "@kwartaal/core";
import { apiFetch } from "../lib/api";

export function useQuarters(year?: number) {
  const [quarters, setQuarters] = useState<Quarter[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const query = year ? `?year=${year}` : "";
    const data = await apiFetch<Quarter[]>(`/quarters${query}`);
    setQuarters(data);
    return data;
  }, [year]);

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

  return { quarters, loading, refetch };
}
