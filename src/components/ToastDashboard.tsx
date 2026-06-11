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
    status: "Pending",
    changeType: "",
    showArchived: false,
  });
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchRequests();
  }, []);

  // Open modal when parent signals a new request
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
    // Temporarily lift filter so newly submitted request is visible
    setFilters((f) => ({ ...f, status: "" }));
  }

  function handleUpdate(updated: ToastRequest) {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  function filteredFor(location: string | null): ToastRequest[] {
    return requests.filter((r) => {
      if (!filters.showArchived && r.archived) return false;
      if (filters.showArchived && !r.archived) return false;
      if (location !== null && r.location !== location) return false;
      if (filters.status && r.status !== filters.status) return false;
      if (filters.changeType && r.change_type !== filters.changeType) return false;
      return true;
    });
  }

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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0 min-h-full">
            {COLUMNS.map(({ label, location }) => {
              const col = filteredFor(location);
              return (
                <div key={label} className="column-bg border-r border-border last:border-r-0 flex flex-col">
                  {/* Column header */}
                  <div className="bg-[#1F1E1A] border-b-2 border-accent px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-bold uppercase tracking-wider"
                        style={{ color: "#C8922A", fontSize: "15px" }}
                      >
                        {label}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted bg-surface/30 px-2 py-0.5 rounded-full">
                      {col.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 p-3 space-y-2 overflow-y-auto">
                    {col.length === 0 ? (
                      <p className="text-center text-xs text-text-muted py-8">No requests</p>
                    ) : (
                      col.map((r) => (
                        <ToastCard key={r.id} request={r} onUpdate={handleUpdate} />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
