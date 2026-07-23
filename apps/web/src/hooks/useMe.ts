import { useCallback, useEffect, useState } from "react";
import type { MeResponse } from "@kwartaal/core";
import { apiFetch } from "../lib/api";

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const data = await apiFetch<MeResponse>("/orgs/me");
    setMe(data);
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<MeResponse>("/orgs/me")
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { me, loading, refetch };
}
