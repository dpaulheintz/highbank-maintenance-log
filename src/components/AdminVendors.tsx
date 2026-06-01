"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Vendor, VendorCategory } from "@/lib/types";

const VENDOR_CATEGORIES: VendorCategory[] = [
  "Plumbing", "HVAC", "Facility Solutions & Equipment", "Internet / Cable", "Waste and Refuse", "General Repair",
];

const emptyVendor = { name: "", contact: "", category: "" as VendorCategory, phone: "", email: "", notes: "" };

export default function AdminVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof emptyVendor>(emptyVendor);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("vendors").select("*").order("name").then(({ data }) => {
      if (data) setVendors(data as Vendor[]);
    });
  }, []);

  function startEdit(v: Vendor) {
    setEditingId(v.id);
    setDraft({
      name: v.name,
      contact: v.contact || "",
      category: (v.category || "") as VendorCategory,
      phone: v.phone || "",
      email: v.email || "",
      notes: v.notes || "",
    });
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraft(emptyVendor);
  }

  function cancel() {
    setEditingId(null);
    setAdding(false);
    setDraft(emptyVendor);
  }

  async function saveEdit() {
    if (!draft.name.trim()) return;
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      contact: draft.contact.trim() || null,
      category: draft.category || null,
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      notes: draft.notes.trim() || null,
    };
    if (adding) {
      const { data } = await supabase.from("vendors").insert(payload).select().single();
      if (data) { setVendors([...vendors, data as Vendor]); cancel(); }
    } else if (editingId) {
      const { data } = await supabase.from("vendors").update(payload).eq("id", editingId).select().single();
      if (data) { setVendors(vendors.map((v) => (v.id === editingId ? data as Vendor : v))); cancel(); }
    }
    setSaving(false);
  }

  async function deleteVendor(id: string) {
    await supabase.from("vendors").delete().eq("id", id);
    setVendors(vendors.filter((v) => v.id !== id));
    if (editingId === id) cancel();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-text">Vendors</h2>
        <button onClick={startAdd} className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded hover:bg-accent-hover cursor-pointer">
          + Add Vendor
        </button>
      </div>

      {adding && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4 space-y-3">
          <VendorForm draft={draft} setDraft={setDraft} />
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded hover:bg-accent-hover disabled:opacity-50 cursor-pointer">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} className="px-3 py-1.5 text-xs text-text-muted hover:text-text cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {vendors.map((v) => (
          <div key={v.id} className="bg-surface border border-border rounded-lg">
            {editingId === v.id ? (
              <div className="p-4 space-y-3">
                <VendorForm draft={draft} setDraft={setDraft} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded hover:bg-accent-hover disabled:opacity-50 cursor-pointer">
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={cancel} className="px-3 py-1.5 text-xs text-text-muted hover:text-text cursor-pointer">Cancel</button>
                  <button onClick={() => deleteVendor(v.id)} className="px-3 py-1.5 text-xs text-priority-emergency hover:opacity-80 cursor-pointer ml-auto">Delete</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEdit(v)} className="w-full text-left p-4 cursor-pointer hover:bg-surface-hover rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{v.name}</span>
                  {v.category && <span className="text-xs text-text-muted bg-bg px-2 py-0.5 rounded">{v.category}</span>}
                </div>
                <div className="flex gap-4 mt-1 text-xs text-text-muted">
                  {v.contact && <span>{v.contact}</span>}
                  {v.phone && <span>{v.phone}</span>}
                  {v.email && <span>{v.email}</span>}
                </div>
              </button>
            )}
          </div>
        ))}
        {vendors.length === 0 && <p className="text-sm text-text-muted text-center py-8">No vendors yet</p>}
      </div>
    </div>
  );
}

function VendorForm({ draft, setDraft }: { draft: typeof emptyVendor; setDraft: (d: typeof emptyVendor) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-xs text-text-muted mb-1">Company Name *</label>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="edit-input" />
      </div>
      <div className="col-span-2">
        <label className="block text-xs text-text-muted mb-1">Primary Contact</label>
        <input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} placeholder="Contact person name" className="edit-input" />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Category</label>
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as VendorCategory })} className="edit-input">
          <option value="">Select…</option>
          {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Phone</label>
        <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="edit-input" />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Email</label>
        <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="edit-input" />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Notes</label>
        <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="edit-input" />
      </div>
    </div>
  );
}
