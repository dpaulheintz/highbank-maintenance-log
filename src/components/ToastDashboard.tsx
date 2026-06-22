"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ToastCard from "./ToastCard";
import ToastFilterBar, { ToastFilters } from "./ToastFilterBar";
import NewToastModal from "./NewToastModal";
import type { ToastRequest } from "@/lib/types";

const COLUMNS: { label: string; location: string | null }[] = [
  { label: "ALL LOCATIONS", location: null },
  { label: "GRANDVIEW", location: "Grandview" },
  { label: "GAHANNA", location: "Gahanna" },
  { label: "WESTERVILLE", location: "Westerville" },
];

interface Props {
  newRequestTrigger: number;
}

export default function ToastDashboard({ newRequestTrigger }: Props) {
  const [requests, setRequests] = useState<ToastRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ToastFilters>({
    status: "",
    changeType: "",
    showArchived: false,
    showRejected: false,
  });
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (newRequestTrigger > 0) setModalOpen(true);
  }, [newRequestTrigger]);

  async function fetchRequests() {
    setLoading(true);
    const { data, error } = await supabase
      .from("toast_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setRequests(data as ToastRequest[]);
    setLoading(false);
  }

  function handleCreated(r: ToastRequest) {
    setRequests((prev) => [r, ...prev]);
    setModalOpen(false);
  }

  function handleUpdate(updated: ToastRequest) {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function baseFilter(r: ToastRequest, location: string | null): boolean {
    if (!filters.showArchived && r.archived) return false;
    if (filters.showArchived && !r.archived) return false;
    if (location !== null && r.location !== location) return false;
    if (filters.changeType && r.change_type !== filters.changeType) return false;
    return true;
  }

  function pendingFor(location: string | null): ToastRequest[] {
    return requests.filter((r) => {
      if (!baseFilter(r, location)) return false;
      if (r.status !== "Pending") return false;
      if (filters.status && filters.status !== "Pending") return false;
      return true;
    });
  }

  function publishedFor(location: string | null): ToastRequest[] {
    return requests.filter((r) => {
      if (!baseFilter(r, location)) return false;
      if (r.status !== "Published") return false;
      if (filters.status && filters.status !== "Published") return false;
      return true;
    });
  }

  function rejectedFor(location: string | null): ToastRequest[] {
    if (!filters.showRejected) return [];
    return requests.filter((r) => {
      if (!baseFilter(r, location)) return false;
      if (r.status !== "Rejected") return false;
      if (filters.status && filters.status !== "Rejected") return false;
      return true;
    });
  }

  const anyPublished = COLUMNS.some(({ location }) => publishedFor(location).length > 0);
  const anyRejected = COLUMNS.some(({ location }) => rejectedFor(location).length > 0);
  const hasBelow = anyPublished || anyRejected;

  return (
    <>
      {modalOpen && (
        <NewToastModal onClose={() => setModalOpen(false)} onCreated={handleCreated} />
      )}

      <ToastFilterBar filters={filters} onChange={setFilters} />

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-text-muted text-sm">
            Loading...
          </div>
        ) : (
          <div className="px-4 sm:px-6 pb-8">
            {/* Pending section */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0">
              {COLUMNS.map(({ label, location }, idx) => {
                const pending = pendingFor(location);
                const isLast = idx === COLUMNS.length - 1;
                return (
                  <div key={label} className={`column-bg flex flex-col ${!isLast ? "border-r border-border" : ""}`}>
                    <div className="bg-[#1F1E1A] border-b-2 border-accent px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                      <span className="font-bold uppercase tracking-wider" style={{ color: "#C8922A", fontSize: "15px" }}>
                        {label}
                      </span>
                      <span className="text-xs text-text-muted bg-surface/30 px-2 py-0.5 rounded-full">
                        {pending.length}
                      </span>
                    </div>
                    <div className="flex-1 p-3 space-y-2">
                      {pending.length === 0 ? (
                        <p className="text-center text-xs text-text-muted py-8">No pending requests</p>
                      ) : (
                        pending.map((r) => (
                          <ToastCard key={r.id} request={r} onUpdate={handleUpdate} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            {hasBelow && (
              <div className="py-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider shrink-0" style={{ color: "#C8922A" }}>
                    PUBLISHED
                  </span>
                  <div className="flex-1 h-[2px]" style={{ backgroundColor: "rgba(200, 146, 42, 0.6)" }} />
                </div>
              </div>
            )}

            {/* Published + Rejected section */}
            {hasBelow && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0">
                {COLUMNS.map(({ label, location }, idx) => {
                  const published = publishedFor(location);
                  const rejected = rejectedFor(location);
                  const isLast = idx === COLUMNS.length - 1;
                  return (
                    <div key={label} className={`column-bg flex flex-col ${!isLast ? "border-r border-border" : ""}`}>
                      <div className="p-3 space-y-2">
                        {published.map((r) => (
                          <ToastCard key={r.id} request={r} onUpdate={handleUpdate} />
                        ))}
                        {rejected.map((r) => (
                          <ToastCard key={r.id} request={r} onUpdate={handleUpdate} rejected />
                        ))}
                        {published.length === 0 && rejected.length === 0 && (
                          <p className="text-center text-xs text-text-muted py-4 opacity-60">—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
