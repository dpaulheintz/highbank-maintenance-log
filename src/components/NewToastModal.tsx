"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { sendToastEmail } from "@/lib/email";
import type { ToastChangeType, ToastRequest } from "@/lib/types";

const LOCATIONS = ["All Locations", "Grandview", "Gahanna", "Westerville"];

const CHANGE_TYPES: ToastChangeType[] = [
  "Price Change",
  "Item Name Change",
  "Item Description Change",
  "86 an Item",
  "Add New Item",
  "Modifier Change",
  "Void/Comp Reason",
  "Discount/Promo",
  "Hours Change",
  "Other",
];

interface Props {
  onClose: () => void;
  onCreated: (r: ToastRequest) => void;
}

export default function NewToastModal({ onClose, onCreated }: Props) {
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [location, setLocation] = useState("");
  const [changeType, setChangeType] = useState<ToastChangeType | "">("");
  const [menuItemName, setMenuItemName] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [requestedChange, setRequestedChange] = useState("");
  const [notesForCharles, setNotesForCharles] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const name = localStorage.getItem("hb_toast_submitter_name");
    const email = localStorage.getItem("hb_toast_submitter_email");
    if (name) setSubmitterName(name);
    if (email) setSubmitterEmail(email);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = [];
    for (const file of photos) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("toast-photos")
        .upload(path, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("toast-photos")
          .getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submitterName.trim()) { setError("Name is required"); return; }
    if (!submitterEmail.trim()) { setError("Email is required"); return; }
    if (!location) { setError("Please select a location"); return; }
    if (!changeType) { setError("Please select a change type"); return; }
    if (!requestedChange.trim()) { setError("Requested change is required"); return; }

    setSubmitting(true);
    setError("");

    localStorage.setItem("hb_toast_submitter_name", submitterName.trim());
    localStorage.setItem("hb_toast_submitter_email", submitterEmail.trim());

    const photoUrls = await uploadPhotos();

    const { data, error: dbError } = await supabase
      .from("toast_requests")
      .insert({
        submitter_name: submitterName.trim(),
        submitter_email: submitterEmail.trim(),
        location,
        change_type: changeType,
        menu_item_name: menuItemName.trim() || null,
        current_value: currentValue.trim() || null,
        requested_change: requestedChange.trim(),
        notes_for_charles: notesForCharles.trim() || null,
        photo_urls: photoUrls,
        status: "Pending",
        archived: false,
      })
      .select()
      .single();

    setSubmitting(false);
    if (dbError) { setError(dbError.message); return; }

    if (data) {
      const created = data as ToastRequest;
      sendToastEmail({
        type: "toast_new_request",
        toastRequest: {
          submitter_name: created.submitter_name,
          submitter_email: created.submitter_email,
          location: created.location,
          change_type: created.change_type,
          menu_item_name: created.menu_item_name,
          current_value: created.current_value,
          requested_change: created.requested_change,
          notes_for_charles: created.notes_for_charles,
        },
      });
      onCreated(created);
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
          <h2 className="font-display text-lg text-text">New Toast Change Request</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text text-xl leading-none cursor-pointer">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-sm text-priority-emergency">{error}</p>}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Your Name" required>
              <input
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                placeholder="First Last"
                className="form-input"
              />
            </FormField>
            <FormField label="Your Email" required>
              <input
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                placeholder="you@highbankco.com"
                className="form-input"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Location" required>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="form-input">
                <option value="">Select location...</option>
                {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </FormField>
            <FormField label="Change Type" required>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value as ToastChangeType)}
                className="form-input"
              >
                <option value="">Select type...</option>
                {CHANGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Menu Item Name">
              <input
                value={menuItemName}
                onChange={(e) => setMenuItemName(e.target.value)}
                placeholder="e.g. High Bank Old Fashioned"
                className="form-input"
              />
            </FormField>
            <FormField label="Current Value">
              <input
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                placeholder="e.g. $14"
                className="form-input"
              />
            </FormField>
          </div>

          <FormField label="Requested Change" required>
            <textarea
              value={requestedChange}
              onChange={(e) => setRequestedChange(e.target.value)}
              rows={3}
              placeholder="Describe exactly what you need changed..."
              className="form-input resize-none"
            />
          </FormField>

          <FormField label="Notes for Charles">
            <textarea
              value={notesForCharles}
              onChange={(e) => setNotesForCharles(e.target.value)}
              rows={2}
              placeholder="Any additional context or instructions..."
              className="form-input resize-none"
            />
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
              onChange={(e) => { if (e.target.files) setPhotos(Array.from(e.target.files)); }}
              className="hidden"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text cursor-pointer">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-accent text-bg text-sm font-medium rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
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
