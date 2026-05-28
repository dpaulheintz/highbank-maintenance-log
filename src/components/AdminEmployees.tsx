"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Employee } from "@/lib/types";

const LOCATIONS = [
  "High Bank Distillery Grandview",
  "High Bank Distillery Gahanna",
  "High Bank Distillery Westerville",
  "High Bank PO Box 21",
  "All Locations",
];

const emptyEmployee = { name: "", location: "", email: "", cell: "", role: "" };

export default function AdminEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<typeof emptyEmployee>(emptyEmployee);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("employees").select("*").order("name").then(({ data }) => {
      if (data) setEmployees(data as Employee[]);
    });
  }, []);

  function startEdit(e: Employee) {
    setEditingId(e.id);
    setDraft({ name: e.name, location: e.location || "", email: e.email || "", cell: e.cell || "", role: e.role || "" });
    setAdding(false);
  }

  function startAdd() {
    setAdding(true);
    setEditingId(null);
    setDraft(emptyEmployee);
  }

  function cancel() {
    setEditingId(null);
    setAdding(false);
    setDraft(emptyEmployee);
  }

  async function saveEdit() {
    if (!draft.name.trim()) return;
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      location: draft.location || null,
      email: draft.email.trim() || null,
      cell: draft.cell.trim() || null,
      role: draft.role.trim() || null,
    };
    if (adding) {
      const { data } = await supabase.from("employees").insert(payload).select().single();
      if (data) { setEmployees([...employees, data as Employee]); cancel(); }
    } else if (editingId) {
      const { data } = await supabase.from("employees").update(payload).eq("id", editingId).select().single();
      if (data) { setEmployees(employees.map((e) => (e.id === editingId ? data as Employee : e))); cancel(); }
    }
    setSaving(false);
  }

  async function deleteEmployee(id: string) {
    await supabase.from("employees").delete().eq("id", id);
    setEmployees(employees.filter((e) => e.id !== id));
    if (editingId === id) cancel();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg text-text">Employees</h2>
        <button onClick={startAdd} className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded hover:bg-accent-hover cursor-pointer">
          + Add Employee
        </button>
      </div>

      {adding && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-4 space-y-3">
          <EmployeeForm draft={draft} setDraft={setDraft} />
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded hover:bg-accent-hover disabled:opacity-50 cursor-pointer">
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={cancel} className="px-3 py-1.5 text-xs text-text-muted hover:text-text cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {employees.map((e) => (
          <div key={e.id} className="bg-surface border border-border rounded-lg">
            {editingId === e.id ? (
              <div className="p-4 space-y-3">
                <EmployeeForm draft={draft} setDraft={setDraft} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded hover:bg-accent-hover disabled:opacity-50 cursor-pointer">
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={cancel} className="px-3 py-1.5 text-xs text-text-muted hover:text-text cursor-pointer">Cancel</button>
                  <button onClick={() => deleteEmployee(e.id)} className="px-3 py-1.5 text-xs text-priority-emergency hover:opacity-80 cursor-pointer ml-auto">Delete</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEdit(e)} className="w-full text-left p-4 cursor-pointer hover:bg-surface-hover rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{e.name}</span>
                  {e.role && <span className="text-xs text-text-muted bg-bg px-2 py-0.5 rounded">{e.role}</span>}
                </div>
                <div className="flex gap-4 mt-1 text-xs text-text-muted">
                  {e.location && <span>{e.location.replace("High Bank Distillery ", "")}</span>}
                  {e.email && <span>{e.email}</span>}
                  {e.cell && <span>{e.cell}</span>}
                </div>
              </button>
            )}
          </div>
        ))}
        {employees.length === 0 && <p className="text-sm text-text-muted text-center py-8">No employees yet</p>}
      </div>
    </div>
  );
}

function EmployeeForm({ draft, setDraft }: { draft: typeof emptyEmployee; setDraft: (d: typeof emptyEmployee) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="block text-xs text-text-muted mb-1">Name *</label>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="edit-input" />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Location</label>
        <select value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className="edit-input">
          <option value="">Select…</option>
          {LOCATIONS.map((l) => <option key={l} value={l}>{l.replace("High Bank Distillery ", "").replace("High Bank ", "")}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Role</label>
        <input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className="edit-input" />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Email</label>
        <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="edit-input" />
      </div>
      <div>
        <label className="block text-xs text-text-muted mb-1">Cell</label>
        <input value={draft.cell} onChange={(e) => setDraft({ ...draft, cell: e.target.value })} className="edit-input" />
      </div>
    </div>
  );
}
