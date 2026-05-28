"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Location, Vendor, Employee, IssueWithRelations } from "@/lib/types";
import IssueCard from "./IssueCard";
import FilterBar from "./FilterBar";
import NewRequestModal from "./NewRequestModal";
import Sidebar from "./Sidebar";

const LOCATION_ORDER = ["Grandview", "Gahanna", "Westerville", "PO Box 21"];

function locationSort(a: Location, b: Location): number {
  const ai = LOCATION_ORDER.findIndex((n) => a.name.includes(n));
  const bi = LOCATION_ORDER.findIndex((n) => b.name.includes(n));
  return ai - bi;
}

function shortName(name: string): string {
  return name.replace("High Bank Distillery ", "").replace("High Bank ", "");
}

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [issues, setIssues] = useState<IssueWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "",
    category: "",
    priority: "",
    showCompleted: false,
  });

  const fetchData = useCallback(async () => {
    const [locRes, vendorRes, empRes, issueRes] = await Promise.all([
      supabase.from("locations").select("*"),
      supabase.from("vendors").select("*").order("name"),
      supabase.from("employees").select("*").order("name"),
      supabase
        .from("issues")
        .select("*, vendors(*), employees!issues_owner_id_fkey(*)")
        .order("created_at", { ascending: false }),
    ]);

    if (locRes.data) setLocations((locRes.data as Location[]).sort(locationSort));
    if (vendorRes.data) setVendors(vendorRes.data as Vendor[]);
    if (empRes.data) setEmployees(empRes.data as Employee[]);
    if (issueRes.data) setIssues(issueRes.data as IssueWithRelations[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleCreated(issue: IssueWithRelations) {
    setIssues((prev) => [issue, ...prev]);
    setModalOpen(false);
  }

  function handleUpdate(updated: IssueWithRelations) {
    setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function filteredIssues(locationId: string): IssueWithRelations[] {
    return issues.filter((issue) => {
      if (issue.location_id !== locationId) return false;
      if (!filters.showCompleted && issue.status === "Complete") return false;
      if (filters.status && issue.status !== filters.status) return false;
      if (filters.category && issue.category !== filters.category) return false;
      if (filters.priority && issue.priority !== filters.priority) return false;
      return true;
    });
  }

  function getLocationName(id: string): string {
    return locations.find((l) => l.id === id)?.name || "";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-text-muted text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Sidebar />

      <header className="sticky top-0 z-30 bg-bg/90 backdrop-blur-md border-b border-border">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="pl-12">
            <h1 className="font-display text-xl sm:text-2xl text-text tracking-tight">
              High Bank Distillery
            </h1>
            <p className="text-xs text-text-muted tracking-widest uppercase mt-0.5">
              Maintenance &amp; Repair Log
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-accent text-bg text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
          >
            + New Request
          </button>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto w-full px-4 sm:px-6 py-4">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {locations.map((location) => {
            const locIssues = filteredIssues(location.id);
            return (
              <div key={location.id} className="flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-display text-base text-text">
                    {shortName(location.name)}
                  </h2>
                  <span className="text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
                    {locIssues.length}
                  </span>
                </div>
                <div className="space-y-3 flex-1">
                  {locIssues.length === 0 ? (
                    <p className="text-sm text-text-muted text-center py-8 opacity-60">
                      No issues
                    </p>
                  ) : (
                    locIssues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        vendors={vendors}
                        employees={employees}
                        locationName={getLocationName(issue.location_id)}
                        onUpdate={handleUpdate}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {modalOpen && (
        <NewRequestModal
          locations={locations}
          vendors={vendors}
          employees={employees}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
