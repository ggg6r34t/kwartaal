import { useEffect, useState } from "react";
import type { GlossaryTermRow } from "@kwartaal/core";
import { apiFetch } from "../lib/api";

export function useGlossary() {
  const [terms, setTerms] = useState<GlossaryTermRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiFetch<GlossaryTermRow[]>("/glossary")
      .then((data) => {
        if (!cancelled) setTerms(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { terms, loading };
}
