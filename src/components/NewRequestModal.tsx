"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Location, Vendor, Category, Priority, IssueWithVendor } from "@/lib/types";

const CATEGORIES: Category[] = ["Equipment", "Plumbing", "HVAC", "Electrical", "Structural", "Cleaning", "Pest"];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Emergency"];

interface Props {
  locations: Location[];
  vendors: Vendor[];
  onClose: () => void;
  onCreated: (issue: IssueWithVendor) => void;
}

export default function NewRequestModal({ locations, vendors, onClose, onCreated }: Props) {
  const [locationId, setLocationId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("Equipment");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reportedBy, setReportedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!locationId) {
      setError("Please select a location");
      return;
    }

    setSubmitting(true);
    setError("");

    if (reportedBy.trim()) {
      localStorage.setItem("hb_reported_by", reportedBy.trim());
    }

    const { data, error: dbError } = await supabase
      .from("issues")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        location_id: locationId,
        category,
        priority,
        status: "Open" as const,
        owner: owner.trim() || null,
        vendor_id: vendorId || null,
        due_date: dueDate || null,
        reported_by: reportedBy.trim() || null,
        completed_at: null,
      })
      .select("*, vendors(*)")
      .single();

    setSubmitting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    if (data) {
      onCreated(data as IssueWithVendor);
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
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text text-xl leading-none cursor-pointer"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-sm text-priority-emergency">{error}</p>
          )}

          <FormField label="Location" required>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="form-input"
            >
              <option value="">Select location…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name.replace("High Bank Distillery ", "")}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Issue Title" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Walk-in cooler not maintaining temp"
              className="form-input"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="form-input"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </FormField>

            <FormField label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="form-input"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the issue in detail…"
              className="form-input resize-none"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Owner">
              <input
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Who's responsible?"
                className="form-input"
              />
            </FormField>

            <FormField label="Vendor">
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="form-input"
              >
                <option value="">None</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="form-input"
              />
            </FormField>

            <FormField label="Reported By">
              <input
                value={reportedBy}
                onChange={(e) => setReportedBy(e.target.value)}
                placeholder="Your name"
                className="form-input"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-muted hover:text-text cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-accent text-bg text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
