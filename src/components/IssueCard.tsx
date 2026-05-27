"use client";

import { useState } from "react";
import type { IssueWithVendor, Vendor, Category, Priority, Status } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import CommentSection from "./CommentSection";

const CATEGORIES: Category[] = ["Equipment", "Plumbing", "HVAC", "Electrical", "Structural", "Cleaning", "Pest"];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Emergency"];
const STATUSES: Status[] = ["Open", "In Progress", "Awaiting Parts", "Complete"];

function isOverdue(issue: IssueWithVendor): boolean {
  if (!issue.due_date || issue.status === "Complete") return false;
  return new Date(issue.due_date) < new Date(new Date().toDateString());
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  issue: IssueWithVendor;
  vendors: Vendor[];
  onUpdate: (updated: IssueWithVendor) => void;
}

export default function IssueCard({ issue, vendors, onUpdate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(issue);

  const overdue = isOverdue(issue);

  async function save() {
    setSaving(true);
    const completedAt =
      draft.status === "Complete" && issue.status !== "Complete"
        ? new Date().toISOString()
        : draft.status !== "Complete"
          ? null
          : issue.completed_at;

    const { data, error } = await supabase
      .from("issues")
      .update({
        title: draft.title,
        description: draft.description,
        category: draft.category,
        priority: draft.priority,
        status: draft.status,
        owner: draft.owner,
        vendor_id: draft.vendor_id,
        due_date: draft.due_date,
        completed_at: completedAt,
      })
      .eq("id", issue.id)
      .select("*, vendors(*)")
      .single();

    setSaving(false);
    if (!error && data) {
      onUpdate(data as IssueWithVendor);
      setEditing(false);
    }
  }

  function cancel() {
    setDraft(issue);
    setEditing(false);
  }

  return (
    <div
      className={`rounded-lg border transition-colors ${
        overdue ? "border-border-overdue" : "border-border"
      } bg-surface hover:bg-surface-hover`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-medium text-sm leading-tight text-text">{issue.title}</h3>
          <div className="flex gap-1.5 shrink-0">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
          {issue.owner && <span>{issue.owner}</span>}
          {issue.vendors && <span>{issue.vendors.name}</span>}
          {issue.due_date && (
            <span className={overdue ? "text-border-overdue font-medium" : ""}>
              Due {formatDate(issue.due_date)}
            </span>
          )}
          <span className="opacity-60">{issue.category}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {!editing ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Status" value={issue.status} />
                <Field label="Priority" value={issue.priority} />
                <Field label="Category" value={issue.category} />
                <Field label="Owner" value={issue.owner || "—"} />
                <Field label="Vendor" value={issue.vendors?.name || "—"} />
                <Field label="Due Date" value={formatDate(issue.due_date)} />
                <Field label="Reported By" value={issue.reported_by || "—"} />
                <Field
                  label="Created"
                  value={new Date(issue.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                />
              </div>
              {issue.description && (
                <div>
                  <p className="text-xs text-text-muted mb-1">Description</p>
                  <p className="text-sm text-text whitespace-pre-wrap">{issue.description}</p>
                </div>
              )}
              <button
                onClick={() => { setDraft(issue); setEditing(true); }}
                className="text-xs text-accent hover:text-accent-hover font-medium cursor-pointer"
              >
                Edit Issue
              </button>
              <CommentSection issueId={issue.id} />
            </>
          ) : (
            <div className="space-y-3">
              <EditField label="Title">
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="edit-input"
                />
              </EditField>
              <EditField label="Description">
                <textarea
                  value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  className="edit-input resize-none"
                />
              </EditField>
              <div className="grid grid-cols-2 gap-3">
                <EditField label="Status">
                  <select
                    value={draft.status}
                    onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}
                    className="edit-input"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </EditField>
                <EditField label="Priority">
                  <select
                    value={draft.priority}
                    onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}
                    className="edit-input"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </EditField>
                <EditField label="Category">
                  <select
                    value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
                    className="edit-input"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </EditField>
                <EditField label="Owner">
                  <input
                    value={draft.owner || ""}
                    onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                    className="edit-input"
                  />
                </EditField>
                <EditField label="Vendor">
                  <select
                    value={draft.vendor_id || ""}
                    onChange={(e) => setDraft({ ...draft, vendor_id: e.target.value || null })}
                    className="edit-input"
                  >
                    <option value="">None</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </EditField>
                <EditField label="Due Date">
                  <input
                    type="date"
                    value={draft.due_date || ""}
                    onChange={(e) => setDraft({ ...draft, due_date: e.target.value || null })}
                    className="edit-input"
                  />
                </EditField>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-3 py-1.5 bg-accent text-bg text-xs font-medium rounded hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancel}
                  className="px-3 py-1.5 text-xs text-text-muted hover:text-text cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm text-text">{value}</p>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}
