"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Location, Vendor, Employee, IssueWithRelations } from "@/lib/types";
import IssueCard from "./IssueCard";
import FilterBar from "./FilterBar";
import NewRequestModal from "./NewRequestModal";
import ToastDashboard from "./ToastDashboard";
import Sidebar from "./Sidebar";
import Image from "next/image";

const LOCATION_ORDER = ["Grandview", "Gahanna", "Westerville/PO Box", "Distillery"];

function locationSort(a: Location, b: Location): number {
  const ai = LOCATION_ORDER.findIndex((n) => a.name.includes(n));
  const bi = LOCATION_ORDER.findIndex((n) => b.name.includes(n));
  return ai - bi;
}

function shortName(name: string): string {
  return name
    .replace("High Bank Distillery ", "")
    .replace("High Bank ", "");
}

type Tab = "maintenance" | "toast";

export default function Dashboard() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [issues, setIssues] = useState<IssueWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("maintenance");
  const [toastTrigger, setToastTrigger] = useState(0);
  const [filters, setFilters] = useState({
    status: "",
    category: "",
    priority: "",
    showArchived: false,
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

    if (locRes.error) console.error("locations error:", locRes.error);
    if (vendorRes.error) console.error("vendors error:", vendorRes.error);
    if (empRes.error) console.error("employees error:", empRes.error);
    if (issueRes.error) console.error("issues error:", issueRes.error);

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

  function handleDelete(id: string) {
    setIssues((prev) => prev.filter((i) => i.id !== id));
  }

  function baseFilter(issue: IssueWithRelations, locationId: string): boolean {
    if (issue.location_id !== locationId) return false;
    if (!filters.showArchived && issue.archived) return false;
    if (filters.showArchived && !issue.archived) return false;
    if (filters.category && issue.category !== filters.category) return false;
    if (filters.priority && issue.priority !== filters.priority) return false;
    return true;
  }

  function activeIssuesFor(locationId: string): IssueWithRelations[] {
    return issues.filter((issue) => {
      if (!baseFilter(issue, locationId)) return false;
      if (issue.status === "Complete") return false;
      if (filters.status && issue.status !== filters.status) return false;
      return true;
    });
  }

  function completedIssuesFor(locationId: string): IssueWithRelations[] {
    return issues.filter((issue) => {
      if (!baseFilter(issue, locationId)) return false;
      if (issue.status !== "Complete") return false;
      if (filters.status && filters.status !== "Complete") return false;
      return true;
    });
  }

  function getLocationName(id: string): string {
    return locations.find((l) => l.id === id)?.name || "";
  }

  function handleNewRequest() {
    if (activeTab === "toast") {
      setToastTrigger((t) => t + 1);
    } else {
      setModalOpen(true);
    }
  }

  const hasCompleted = locations.some((loc) => completedIssuesFor(loc.id).length > 0);

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
          <div className="pl-12 flex items-center gap-4">
            <Image
              src="/logos/HBCo-White.png"
              alt="High Bank Co."
              width={120}
              height={40}
              className="h-auto"
              priority
            />
            <p className="text-sm sm:text-base text-text-muted tracking-[0.25em] uppercase hidden sm:block" style={{ fontFamily: "'Calibri', sans-serif" }}>
              {activeTab === "toast" ? "Toast Change Log" : "Maintenance & Repair Log"}
            </p>
          </div>
          <button
            onClick={handleNewRequest}
            className="px-4 py-2 bg-accent text-bg text-sm font-medium rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
          >
            + New Request
          </button>
        </div>

        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 pl-16 flex gap-1 border-t border-border/50">
          <TabButton label="Maintenance Log" active={activeTab === "maintenance"} onClick={() => setActiveTab("maintenance")} />
          <TabButton label="Toast Change Log" active={activeTab === "toast"} onClick={() => setActiveTab("toast")} />
        </div>
      </header>

      {activeTab === "maintenance" ? (
        <>
          <div className="max-w-[1800px] mx-auto w-full px-4 sm:px-6 py-4">
            <FilterBar filters={filters} onChange={setFilters} />
          </div>

          <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 sm:px-6 pb-8">
            {/* Active issues */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0">
              {locations.map((location, idx) => {
                const active = activeIssuesFor(location.id);
                const isLast = idx === locations.length - 1;
                return (
                  <div
                    key={location.id}
                    className={`flex flex-col min-w-0 ${!isLast ? "border-r border-border" : ""}`}
                  >
                    <div className="flex flex-col items-center mb-3 px-3 py-3 bg-[#1F1E1A] border-b-2 border-accent rounded-t-lg relative">
                      <div className="flex items-center gap-2 justify-center">
                        <Image
                          src="/logos/HB_Distillery_Round.png"
                          alt=""
                          width={28}
                          height={28}
                          className="opacity-40"
                        />
                        <h2 className="font-bold uppercase text-accent tracking-wide" style={{ fontSize: "22px" }}>
                          {shortName(location.name)}
                        </h2>
                      </div>
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted bg-surface px-2 py-0.5 rounded-full">
                        {active.length}
                      </span>
                    </div>
                    <div className="space-y-3 flex-1 px-2.5 column-bg">
                      {active.length === 0 ? (
                        <p className="text-sm text-text-muted text-center py-8 opacity-60">
                          No issues
                        </p>
                      ) : (
                        active.map((issue) => (
                          <IssueCard
                            key={issue.id}
                            issue={issue}
                            vendors={vendors}
                            employees={employees}
                            locationName={getLocationName(issue.location_id)}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Completed divider */}
            {hasCompleted && (
              <div className="py-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider shrink-0" style={{ color: "#C8922A" }}>
                    COMPLETED
                  </span>
                  <div className="flex-1 h-[2px]" style={{ backgroundColor: "rgba(200, 146, 42, 0.6)" }} />
                </div>
              </div>
            )}

            {/* Completed issues */}
            {hasCompleted && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-0">
                {locations.map((location, idx) => {
                  const completed = completedIssuesFor(location.id);
                  const isLast = idx === locations.length - 1;
                  return (
                    <div
                      key={location.id}
                      className={`flex flex-col min-w-0 ${!isLast ? "border-r border-border" : ""}`}
                    >
                      <div className="space-y-3 px-2.5 column-bg pb-4">
                        {completed.map((issue) => (
                          <IssueCard
                            key={issue.id}
                            issue={issue}
                            vendors={vendors}
                            employees={employees}
                            locationName={getLocationName(issue.location_id)}
                            onUpdate={handleUpdate}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </>
      ) : (
        <main className="flex-1 flex flex-col max-w-[1800px] mx-auto w-full">
          <ToastDashboard newRequestTrigger={toastTrigger} />
        </main>
      )}

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

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-xs font-medium transition-colors cursor-pointer border-b-2 -mb-px ${
        active
          ? "border-accent text-accent"
          : "border-transparent text-text-muted hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
