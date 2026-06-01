"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { sendEmail, buildEmailIssue } from "@/lib/email";
import type { Location, Vendor, Employee, Category, Priority, IssueWithRelations, VendorCategory } from "@/lib/types";

const CATEGORIES: Category[] = ["Equipment", "Plumbing", "HVAC", "Electrical", "Structural", "Cleaning", "Pest"];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Emergency"];

const VENDOR_CATEGORIES: VendorCategory[] = [
  "Plumbing",
  "HVAC",
  "Facility Solutions & Equipment",
  "Internet / Cable",
  "Waste and Refuse",
  "General Repair",
];

const WRITE_IN_CATEGORIES: VendorCategory[] = ["HVAC", "Facility Solutions & Equipment", "General Repair"];

function calcEstimatedRepairDate(priority: Priority): Date {
  const now = new Date();
  switch (priority) {
    case "Emergency":
      return now;
    case "High":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "Medium":
      return new Date(now.getTime() + 72 * 60 * 60 * 1000);
    case "Low":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
}

function formatReadableDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Props {
  locations: Location[];
  vendors: Vendor[];
  employees: Employee[];
  onClose: () => void;
  onCreated: (issue: IssueWithRelations) => void;
}

export default function NewRequestModal({ locations: propLocations, vendors: propVendors, employees: propEmployees, onClose, onCreated }: Props) {
  const [locationId, setLocationId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Equipment");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [vendorCategory, setVendorCategory] = useState<VendorCategory | "">("");
  const [vendorId, setVendorId] = useState("");
  const [vendorCustom, setVendorCustom] = useState("");
  const [isWriteIn, setIsWriteIn] = useState(false);
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [reportedBy, setReportedBy] = useState("");
  const [managerIds, setManagerIds] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locations, setLocations] = useState<Location[]>(propLocations);
  const [vendors, setVendors] = useState<Vendor[]>(propVendors);
  const [employees, setEmployees] = useState<Employee[]>(propEmployees);

  const estimatedRepairDate = useMemo(() => calcEstimatedRepairDate(priority), [priority]);

  const filteredVendors = useMemo(() => {
    if (!vendorCategory) return [];
    return vendors.filter((v) => v.category === vendorCategory && v.name !== "Write-in");
  }, [vendors, vendorCategory]);

  const showWriteInOption = vendorCategory ? WRITE_IN_CATEGORIES.includes(vendorCategory) : false;

  useEffect(() => {
    async function loadData() {
      const [locRes, vendorRes, empRes] = await Promise.all([
        supabase.from("locations").select("*").order("name"),
        supabase.from("vendors").select("*").order("name"),
        supabase.from("employees").select("*").order("name"),
      ]);
      if (locRes.data && locRes.data.length > 0) setLocations(locRes.data as Location[]);
      if (vendorRes.data && vendorRes.data.length > 0) setVendors(vendorRes.data as Vendor[]);
      if (empRes.data && empRes.data.length > 0) setEmployees(empRes.data as Employee[]);
    }
    loadData();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("hb_reported_by");
    if (saved) setReportedBy(saved);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of photos) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("issue-photos")
        .upload(path, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("issue-photos")
          .getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (!locationId) { setError("Please select a location"); return; }
    if (!ownerId) { setError("Please select an owner"); return; }

    setSubmitting(true);
    setError("");

    if (reportedBy.trim()) {
      localStorage.setItem("hb_reported_by", reportedBy.trim());
    }

    const photoUrls = await uploadPhotos();

    const selectedOwner = employees.find((emp) => emp.id === ownerId);
    const repairDateIso = estimatedRepairDate.toISOString();

    const { data, error: dbError } = await supabase
      .from("issues")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        location_id: locationId,
        category,
        priority,
        status: "Open" as const,
        owner: selectedOwner?.name || null,
        owner_id: ownerId || null,
        vendor_id: isWriteIn ? null : (vendorId || null),
        vendor_name_custom: isWriteIn ? vendorCustom.trim() || null : null,
        report_date: reportDate || null,
        estimated_repair_date: repairDateIso,
        manager_ids: managerIds,
        photo_urls: photoUrls,
        reported_by: reportedBy.trim() || null,
        completed_at: null,
      })
      .select("*, vendors(*), employees!issues_owner_id_fkey(*)")
      .single();

    setSubmitting(false);
    if (dbError) { setError(dbError.message); return; }

    if (data) {
      const created = data as IssueWithRelations;
      const loc = locations.find((l) => l.id === locationId);
      const vendorName = created.vendors?.name || null;
      const emailIssue = buildEmailIssue(created, loc?.name || "", vendorName);

      const mgrEmails = managerIds
        .map((id) => employees.find((emp) => emp.id === id)?.email)
        .filter(Boolean) as string[];

      sendEmail({ type: "new_request", issue: emailIssue, ownerName: selectedOwner?.name, ownerEmail: selectedOwner?.email, managerEmails: mgrEmails });

      if (selectedOwner) {
        sendEmail({
          type: "owner_assigned",
          issue: emailIssue,
          ownerEmail: selectedOwner.email,
          ownerName: selectedOwner.name,
          managerEmails: mgrEmails,
        });
      }

      onCreated(created);
    }
  }

  function shortName(name: string): string {
    return name.replace("High Bank Distillery ", "").replace("High Bank ", "");
  }

  function toggleManager(empId: string) {
    setManagerIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files));
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-8"
    >
      <div className="bg-surface border border-border rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg text-text">New Maintenance Request</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text text-xl leading-none cursor-pointer">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-priority-emergency">{error}</p>}

          <FormField label="Location" required>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="form-input">
              <option value="">Select location...</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{shortName(l.name)}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Issue Title" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Walk-in cooler not maintaining temp" className="form-input" />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value as Category)} className="form-input">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="form-input">
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
          </div>

          <div className="text-xs px-1">
            <span className="text-text-muted">Est. Repair: </span>
            <span className="text-accent font-medium">{formatReadableDate(estimatedRepairDate)}</span>
          </div>

          <FormField label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the issue in detail..." className="form-input resize-none" />
          </FormField>

          <FormField label="Photos">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="form-input cursor-pointer flex items-center gap-2 text-text-muted hover:border-accent transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm">
                {photos.length > 0 ? `${photos.length} photo${photos.length > 1 ? "s" : ""} selected` : "Click to add photos..."}
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoChange}
              className="hidden"
            />
          </FormField>

          <FormField label="Owner" required>
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="form-input">
              <option value="">Select owner...</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Vendor Category">
              <select
                value={vendorCategory}
                onChange={(e) => {
                  setVendorCategory(e.target.value as VendorCategory | "");
                  setVendorId("");
                  setIsWriteIn(false);
                  setVendorCustom("");
                }}
                className="form-input"
              >
                <option value="">Select category...</option>
                {VENDOR_CATEGORIES.map((vc) => (
                  <option key={vc} value={vc}>{vc}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Vendor">
              <select
                value={isWriteIn ? "__write_in__" : vendorId}
                onChange={(e) => {
                  if (e.target.value === "__write_in__") {
                    setIsWriteIn(true);
                    setVendorId("");
                  } else {
                    setIsWriteIn(false);
                    setVendorCustom("");
                    setVendorId(e.target.value);
                  }
                }}
                className="form-input"
                disabled={!vendorCategory}
              >
                <option value="">
                  {vendorCategory ? "Select vendor..." : "Pick category first"}
                </option>
                {filteredVendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
                {showWriteInOption && (
                  <option value="__write_in__">Other — write in</option>
                )}
              </select>
            </FormField>
          </div>

          {isWriteIn && (
            <FormField label="Custom Vendor Name">
              <input
                value={vendorCustom}
                onChange={(e) => setVendorCustom(e.target.value)}
                placeholder="Enter vendor name..."
                className="form-input"
              />
            </FormField>
          )}

          <FormField label="Additional Managers (optional)">
            <div className="form-input max-h-32 overflow-y-auto space-y-1 !p-2">
              {employees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 cursor-pointer px-1 py-0.5 rounded hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    checked={managerIds.includes(emp.id)}
                    onChange={() => toggleManager(emp.id)}
                    className="accent-accent w-3.5 h-3.5"
                  />
                  <span className="text-sm text-text">{emp.name}</span>
                  {emp.role && <span className="text-xs text-text-muted">({emp.role})</span>}
                </label>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Report Date">
              <input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="form-input" />
            </FormField>
            <FormField label="Reported By">
              <input value={reportedBy} onChange={(e) => setReportedBy(e.target.value)} placeholder="Your name" className="form-input" />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="px-5 py-2 bg-accent text-bg text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer">
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">
        {label}{required && <span className="text-accent ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
