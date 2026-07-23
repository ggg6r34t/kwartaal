import { useEffect, useState } from "react";
import type { DeadlineRow } from "@kwartaal/core";
import { apiFetch } from "../lib/api";

export function useDeadlines() {
  const [deadlines, setDeadlines] = useState<DeadlineRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<DeadlineRow[]>("/deadlines")
      .then((data) => {
        if (!cancelled) setDeadlines(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { deadlines, loading };
}
