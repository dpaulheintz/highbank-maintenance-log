"use client";

import { useEffect, useRef, useState } from "react";
import {
  SALES_LOCATIONS,
  champions,
  fetchLogs,
  monthLabel,
  monthName,
  pastMonths,
  rankMonth,
  type SalesLogEntry,
  type SalesServer,
} from "@/lib/sales";
import { CrownIcon, bottles, joinNames } from "./SalesColumn";

interface Props {
  currentMonth: string;
  servers: SalesServer[];
  onClose: () => void;
}

export default function SalesPastMonths({ currentMonth, servers, onClose }: Props) {
  const [logs, setLogs] = useState<SalesLogEntry[] | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const months = pastMonths(currentMonth);

  useEffect(() => {
    fetchLogs({ before: currentMonth })
      .then(setLogs)
      .catch((err: Error) => setError(err.message));
  }, [currentMonth]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 sm:py-10"
    >
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold uppercase tracking-wider text-accent">Past Months</h2>
          <button onClick={onClose} aria-label="Close" className="w-10 h-10 -mr-2 text-text-muted hover:text-text text-2xl leading-none cursor-pointer">
            &times;
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-3">
          {months.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">
              No past months yet. {monthName(currentMonth)} is the first month — its champions will appear here once it wraps up.
            </p>
          ) : error ? (
            <p className="text-sm text-[#ef4444] text-center py-8">Couldn&apos;t load past months: {error}</p>
          ) : !logs ? (
            <p className="text-sm text-text-muted text-center py-8">Loading…</p>
          ) : (
            months.map((m) => {
              const open = expanded === m;
              const byLocation = SALES_LOCATIONS.map((loc) => {
                const ranked = rankMonth(logs, servers, m, loc);
                return { loc, ranked, leaders: champions(ranked) };
              });
              return (
                <div key={m} className="rounded-xl border border-border bg-bg/40 overflow-hidden">
                  <button
                    onClick={() => setExpanded(open ? null : m)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-surface-hover"
                    aria-expanded={open}
                  >
                    <span className="font-bold tracking-wider text-text">{monthLabel(m)}</span>
                    <span className="text-xs text-text-muted">{open ? "Hide rankings ▲" : "Full rankings ▼"}</span>
                  </button>

                  <div className="px-4 pb-3 grid gap-2 sm:grid-cols-3">
                    {byLocation.map(({ loc, ranked, leaders }) => (
                      <div key={loc} className="rounded-lg bg-surface px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-accent">{loc}</p>
                        {leaders.length > 0 ? (
                          <p className="text-sm text-text mt-0.5 flex items-start gap-1">
                            <CrownIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                            <span>
                              <span className="font-semibold">{joinNames(leaders)}</span>{" "}
                              <span className="text-text-muted">({bottles(leaders[0].total)})</span>
                            </span>
                          </p>
                        ) : (
                          <p className="text-sm text-text-muted mt-0.5">No sales</p>
                        )}

                        {open && ranked.length > 0 && (
                          <ol className="mt-2 pt-2 border-t border-border space-y-1">
                            {ranked.map((r) => (
                              <li key={r.id} className="flex items-center gap-2 text-sm">
                                <span className="w-5 text-text-muted tabular-nums">{r.rank}.</span>
                                <span className="flex-1 min-w-0 truncate text-text">{r.name}</span>
                                <span className="font-semibold tabular-nums text-text">{r.total}</span>
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
