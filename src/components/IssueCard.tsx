"use client";

import { useState } from "react";
import type { IssueWithRelations, Vendor, Employee, Category, Priority, Status } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { isOverdue as checkOverdue, sendEmail, buildEmailIssue } from "@/lib/email";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import CommentSection from "./CommentSection";
import UpdateSection from "./UpdateSection";

const CATEGORIES: Category[] = ["Equipment", "Plumbing", "HVAC", "Electrical", "Structural", "Cleaning", "Pest", "Other"];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Emergency"];
const STATUSES: Status[] = ["Open", "In Progress", "Awaiting Parts", "Complete"];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getStatusBorderClass(status: Status, overdue: boolean): string {
  if (overdue) return "border-[#ef4444]";
  switch (status) {
    case "Complete":
      return "border-[#22c55e]";
    case "In Progress":
      return "border-[#eab308]";
    case "Awaiting Parts":
      return "border-[#3b82f6]";
    default:
      return "border-border";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Props {
  issue: IssueWithRelations;
  vendors: Vendor[];
  employees: Employee[];
  locationName: string;
  onUpdate: (updated: IssueWithRelations) => void;
  onDelete?: (id: string) => void;
}

export default function IssueCard({ issue, vendors, employees, locationName, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(issue);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const overdue = checkOverdue(issue.estimated_repair_date, issue.status);
  const ownerName = issue.employees?.name || issue.owner || null;
  const borderClass = getStatusBorderClass(issue.status, overdue);

  const managers = (issue.manager_ids || [])
    .map((id) => employees.find((emp) => emp.id === id))
    .filter(Boolean) as Employee[];

  async function save() {
    setSaving(true);
    const completedAt =
      draft.status === "Complete" && issue.status !== "Complete"
        ? new Date().toISOString()
        : draft.status !== "Complete"
          ? null
          : issue.completed_at;

    const completionDate =
      draft.status === "Complete" && issue.status !== "Complete" && !draft.completion_date
        ? new Date().toISOString().split("T")[0]
        : draft.completion_date;

    const { data, error } = await supabase
      .from("issues")
      .update({
        title: draft.title,
        description: draft.description,
        category: draft.category,
        priority: draft.priority,
        status: draft.status,
        owner: draft.owner,
        owner_id: draft.owner_id,
        vendor_id: draft.vendor_id,
        due_date: draft.due_date,
        completed_at: completedAt,
        completion_date: completionDate,
      })
      .eq("id", issue.id)
      .select("*, vendors(*), employees!issues_owner_id_fkey(*)")
      .single();

    setSaving(false);
    if (!error && data) {
      const updated = data as IssueWithRelations;
      const vendorName = updated.vendors?.name || null;
      const newOwner = employees.find((e) => e.id === updated.owner_id);
      const managerEmails = managers.map((m) => m.email).filter(Boolean) as string[];
      const emailIssue = buildEmailIssue(updated, locationName, vendorName);

      const rptEmail = updated.reported_by_email || null;
      if (draft.owner_id && draft.owner_id !== issue.owner_id) {
        sendEmail({ type: "owner_assigned", issue: emailIssue, ownerEmail: newOwner?.email, ownerName: newOwner?.name, managerEmails, reportedByEmail: rptEmail });
      }
      if (draft.status !== issue.status) {
        sendEmail({ type: "status_changed", issue: emailIssue, ownerEmail: newOwner?.email, ownerName: newOwner?.name, oldStatus: issue.status, managerEmails, reportedByEmail: rptEmail });
      }
      if (checkOverdue(updated.estimated_repair_date, updated.status)) {
        sendEmail({ type: "overdue", issue: emailIssue, ownerEmail: newOwner?.email, ownerName: newOwner?.name, managerEmails, reportedByEmail: rptEmail });
      }

      onUpdate(updated);
      setEditing(false);
    }
  }

  function cancel() {
    setDraft(issue);
    setEditing(false);
  }

  async function toggleArchive() {
    const newVal = !issue.archived;
    const { data, error } = await supabase
      .from("issues")
      .update({ archived: newVal })
      .eq("id", issue.id)
      .select("*, vendors(*), employees!issues_owner_id_fkey(*)")
      .single();

    if (!error && data) {
      onUpdate(data as IssueWithRelations);
      setArchiveConfirm(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("issues")
      .delete()
      .eq("id", issue.id);

    setDeleting(false);
    if (!error) {
      onDelete?.(issue.id);
    }
  }

  const isArchived = issue.archived;

  return (
    <div
      className={`rounded-xl border-2 transition-colors ${borderClass} bg-surface hover:bg-surface-hover shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] ${isArchived ? "opacity-50" : ""}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm leading-tight text-text">{issue.title}</h3>
            {isArchived && (
              <span className="text-[10px] font-semibold uppercase tracking-wider bg-border/50 text-text-muted px-1.5 py-0.5 rounded">
                Archived
              </span>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            <StatusBadge status={issue.status} />
            <PriorityBadge priority={issue.priority} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
          {ownerName && <span>{ownerName}</span>}
          {issue.vendors && <span>{issue.vendors.name}</span>}
          {issue.vendor_name_custom && <span>{issue.vendor_name_custom}</span>}
          {issue.estimated_repair_date && (
            <span className={`font-medium ${overdue ? "text-[#ef4444]" : "text-accent"}`}>
              Est. Repair: {formatDateTime(issue.estimated_repair_date)}
            </span>
          )}
          {issue.report_date && (
            <span>Reported: {formatDate(issue.report_date)}</span>
          )}
          {issue.completion_date && (
            <span className="text-[#22c55e] font-medium">
              Completed: {formatDate(issue.completion_date)}
            </span>
          )}
          <span className="opacity-60">{issue.category}</span>
        </div>
        {managers.length > 0 && (
          <div className="flex gap-1 mt-2">
            {managers.map((mgr) => (
              <span
                key={mgr.id}
                className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[9px] font-bold flex items-center justify-center"
                title={mgr.name}
              >
                {getInitials(mgr.name)}
              </span>
            ))}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {!editing ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Status" value={issue.status} />
                <Field label="Priority" value={issue.priority} />
                <Field label="Category" value={issue.category} />
                <Field label="Owner" value={ownerName || "—"} />
                <Field label="Vendor" value={issue.vendors?.name || issue.vendor_name_custom || "—"} />
                <Field label="Report Date" value={formatDate(issue.report_date)} />
                <Field label="Est. Repair" value={formatDateTime(issue.estimated_repair_date)} highlight={overdue} />
                <Field label="Reported By" value={issue.reported_by || "—"} />
                <Field
                  label="Created"
                  value={new Date(issue.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                />
                {issue.completion_date && (
                  <div>
                    <p className="text-xs text-text-muted">Completion Date</p>
                    <p className="text-sm text-[#22c55e] font-medium">{formatDate(issue.completion_date)}</p>
                  </div>
                )}
                {managers.length > 0 && (
                  <Field label="Managers" value={managers.map((m) => m.name).join(", ")} />
                )}
              </div>
              {issue.description && (
                <div>
                  <p className="text-xs text-text-muted mb-1">Description</p>
                  <p className="text-sm text-text whitespace-pre-wrap">{issue.description}</p>
                </div>
              )}

              {issue.photo_urls && issue.photo_urls.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-2">Photos</p>
                  <div className="flex gap-2 flex-wrap">
                    {issue.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={`Issue photo ${i + 1}`}
                          className="w-20 h-20 object-cover rounded border border-border hover:border-accent transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setDraft(issue); setEditing(true); }}
                  className="text-xs text-accent hover:text-accent-hover font-medium cursor-pointer"
                >
                  Edit Issue
                </button>
              </div>

              <UpdateSection issue={issue} employees={employees} locationName={locationName} />
              <CommentSection issueId={issue.id} />

              {/* Archive & Delete actions at bottom */}
              <div className="border-t border-border pt-3 mt-3 flex items-center gap-3">
                {!isArchived ? (
                  !archiveConfirm ? (
                    <button
                      onClick={() => setArchiveConfirm(true)}
                      className="text-xs text-accent hover:text-accent-hover font-medium cursor-pointer"
                    >
                      Archive
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-muted">Archive this job? It will be hidden from the dashboard but not deleted.</span>
                      <button
                        onClick={toggleArchive}
                        className="text-xs text-accent font-medium cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setArchiveConfirm(false)}
                        className="text-xs text-text-muted cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    onClick={toggleArchive}
                    className="text-xs text-accent hover:text-accent-hover font-medium cursor-pointer"
                  >
                    Unarchive
                  </button>
                )}

                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="text-xs text-[#ef4444] hover:text-[#dc2626] font-medium cursor-pointer"
                  >
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">Are you sure you want to permanently delete this job? This cannot be undone.</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-xs text-[#ef4444] font-medium cursor-pointer disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      className="text-xs text-text-muted cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
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
                    onChange={(e) => {
                      const newStatus = e.target.value as Status;
                      const updates: Partial<typeof draft> = { status: newStatus };
                      if (newStatus === "Complete" && issue.status !== "Complete" && !draft.completion_date) {
                        updates.completion_date = new Date().toISOString().split("T")[0];
                      }
                      setDraft({ ...draft, ...updates });
                    }}
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
                  <select
                    value={draft.owner_id || ""}
                    onChange={(e) => {
                      const empId = e.target.value || null;
                      const emp = employees.find((em) => em.id === empId);
                      setDraft({ ...draft, owner_id: empId, owner: emp?.name || null });
                    }}
                    className="edit-input"
                  >
                    <option value="">Unassigned</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
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
                <EditField label="Completion Date">
                  <input
                    type="date"
                    value={draft.completion_date || ""}
                    onChange={(e) => setDraft({ ...draft, completion_date: e.target.value || null })}
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
                  {saving ? "Saving..." : "Save"}
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

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-sm ${highlight ? "text-[#ef4444] font-medium" : "text-text"}`}>{value}</p>
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
