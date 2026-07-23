import { useCallback, useEffect, useState } from "react";
import type { IncomeTaxStudioResponse } from "@kwartaal/core";
import { apiFetch } from "../lib/api";

export function useIncomeTax(year: number) {
  const [data, setData] = useState<IncomeTaxStudioResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const result = await apiFetch<IncomeTaxStudioResponse>(`/income-tax/${year}`);
    setData(result);
    return result;
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

  return { data, loading, refetch };
}
