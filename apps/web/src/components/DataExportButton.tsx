import { useEffect, useRef, useState } from "react";
import type { ExportJob } from "@kwartaal/core";
import { apiFetch, apiUrl } from "../lib/api";

/**
 * The account-wide "everything as a zip" export (locked decision — the
 * user's own 7-year retention obligation), used from both the Vault screen
 * and Settings' data-export row, and by the account-deletion grace-period
 * export (which enqueues the same ExportJob kind server-side without going
 * through this button at all).
 */
export function DataExportButton({
  label = "Export everything for my bookkeeper (.zip)",
}: {
  label?: string;
}) {
  const [job, setJob] = useState<ExportJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function start() {
    const created = await apiFetch<ExportJob>("/export-jobs", {
      method: "POST",
      body: JSON.stringify({ kind: "data" }),
    });
    setJob(created);
    pollRef.current = setInterval(async () => {
      const jobs = await apiFetch<ExportJob[]>("/export-jobs");
      const latest = jobs.find((j) => j.id === created.id);
      if (latest && (latest.status === "completed" || latest.status === "failed")) {
        setJob(latest);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 3000);
  }

  if (job?.status === "completed") {
    return (
      <a
        href={apiUrl(`/export-jobs/${job.id}/file`)}
        className="rounded-control bg-accent px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-accent-hover"
      >
        Download .zip
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void start()}
      disabled={job?.status === "queued" || job?.status === "running"}
      className="rounded-control border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-ink hover:bg-wash disabled:opacity-50"
    >
      {job && job.status !== "failed" ? "Preparing…" : label}
    </button>
  );
}
