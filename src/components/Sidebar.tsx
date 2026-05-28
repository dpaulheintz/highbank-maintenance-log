"use client";

import { useState } from "react";
import AdminVendors from "./AdminVendors";
import AdminEmployees from "./AdminEmployees";

type AdminPage = "vendors" | "employees" | null;

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<AdminPage>(null);

  function navigate(p: AdminPage) {
    setPage(p);
    if (!open) setOpen(true);
  }

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 w-9 h-9 flex items-center justify-center rounded-lg bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
        title="Admin"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 z-50 h-full w-80 bg-bg border-r border-border transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display text-base text-text">Admin</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-text-muted hover:text-text text-lg leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Nav */}
          <nav className="px-3 py-3 space-y-1 border-b border-border">
            <NavButton
              active={page === "vendors"}
              onClick={() => navigate("vendors")}
              label="Vendors"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              }
            />
            <NavButton
              active={page === "employees"}
              onClick={() => navigate("employees")}
              label="Employees"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {page === "vendors" && <AdminVendors />}
            {page === "employees" && <AdminEmployees />}
            {!page && (
              <p className="text-sm text-text-muted text-center mt-12">
                Select a section above
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function NavButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
        active
          ? "bg-surface text-accent font-medium"
          : "text-text-muted hover:text-text hover:bg-surface"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
