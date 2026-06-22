"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { sendToastEmail } from "@/lib/email";
import type { ToastEmailPayload } from "@/lib/email";
import type { ToastRequest } from "@/lib/types";

const CHANGE_TYPE_COLORS: Record<string, string> = {
  "Price Change": "#60a5fa",
  "Item Name Change": "#c084fc",
  "Item Description Change": "#818cf8",
  "86 an Item": "#f87171",
  "Add New Item": "#4ade80",
  "Modifier Change": "#fb923c",
  "Void/Comp Reason": "#facc15",
  "Discount/Promo": "#22d3ee",
  "Hours Change": "#2dd4bf",
  "Other": "#9ca3af",
};

interface Props {
  request: ToastRequest;
  onUpdate: (r: ToastRequest) => void;
  rejected?: boolean;
}

export default function ToastCard({ request, onUpdate, rejected }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionText, setRejectionText] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const badgeColor = CHANGE_TYPE_COLORS[request.change_type] || "#9ca3af";

  const borderColor =
    request.status === "Published"
      ? "#22c55e"
      : request.status === "Rejected"
      ? "#ef4444"
      : "#C8922A";

  function buildEmailPayload(): ToastEmailPayload {
    return {
      submitter_name: request.submitter_name,
      submitter_email: request.submitter_email,
      location: request.location,
      change_type: request.change_type,
      menu_item_name: request.menu_item_name,
      current_value: request.current_value,
      requested_change: request.requested_change,
      notes_for_charles: request.notes_for_charles,
    };
  }

  async function handlePublish() {
    setLoading(true);
    const { data, error } = await supabase
      .from("toast_requests")
      .update({ status: "Published", completed_at: new Date().toISOString() })
      .eq("id", request.id)
      .select()
      .single();
    if (!error && data) {
      onUpdate(data as ToastRequest);
      sendToastEmail({ type: "toast_published", toastRequest: buildEmailPayload() });
    }
    setLoading(false);
  }

  async function handleReject() {
    setLoading(true);
    const { data, error } = await supabase
      .from("toast_requests")
      .update({
        status: "Rejected",
        rejection_reason: rejectionText.trim() || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .select()
      .single();
    if (!error && data) {
      onUpdate(data as ToastRequest);
      sendToastEmail({
        type: "toast_rejected",
        toastRequest: buildEmailPayload(),
        rejection_reason: rejectionText.trim() || null,
      });
    }
    setLoading(false);
    setRejecting(false);
    setRejectionText("");
  }

  async function handleArchive() {
    const { data, error } = await supabase
      .from("toast_requests")
      .update({ archived: !request.archived })
      .eq("id", request.id)
      .select()
      .single();
    if (!error && data) {
      onUpdate(data as ToastRequest);
      setArchiveConfirm(false);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const cardOpacity = request.archived ? 0.5 : rejected ? 0.6 : 1;

  return (
    <>
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Photo" className="max-w-[90vw] max-h-[90vh] rounded-lg" />
        </div>
      )}

      <div
        className="rounded-xl border-l-4 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)] overflow-hidden transition-opacity duration-200"
        style={{ borderColor, opacity: cardOpacity, background: "var(--color-surface)" }}
      >
        <button
          className="w-full text-left px-3 pt-3 pb-2 cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ background: `${badgeColor}22`, color: badgeColor }}
                >
                  {request.change_type}
                </span>
                {request.archived && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-border text-text-muted uppercase tracking-wide">
                    Archived
                  </span>
                )}
                {rejected && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold" style={{ background: "#ef444422", color: "#ef4444" }}>
                    Rejected
                  </span>
                )}
              </div>
              {request.menu_item_name && (
                <p className="text-sm font-medium text-text truncate">{request.menu_item_name}</p>
              )}
              <p className="text-xs text-text-muted line-clamp-2 mt-0.5">{request.requested_change}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge status={request.status} />
              <span className="text-[10px] text-text-muted">{fmtDate(request.created_at)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-text-muted">{request.submitter_name} · {request.location}</span>
            <svg
              className={`w-3.5 h-3.5 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded && (
          <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <DetailRow label="Submitter" value={request.submitter_name} />
              <DetailRow label="Email" value={request.submitter_email} />
              <DetailRow label="Location" value={request.location} />
              <DetailRow label="Submitted" value={fmtDate(request.created_at)} />
              {request.current_value && <DetailRow label="Current Value" value={request.current_value} />}
              {request.completed_at && (
                <DetailRow
                  label={request.status === "Published" ? "Published" : "Rejected"}
                  value={fmtDate(request.completed_at)}
                />
              )}
            </div>

            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Requested Change</p>
              <p className="text-sm text-text whitespace-pre-wrap">{request.requested_change}</p>
            </div>

            {request.notes_for_charles && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Notes for Charles</p>
                <p className="text-sm text-text whitespace-pre-wrap">{request.notes_for_charles}</p>
              </div>
            )}

            {request.rejection_reason && (
              <div className="bg-[#fef2f2] border-l-2 border-[#ef4444] px-3 py-2 rounded">
                <p className="text-[10px] text-[#ef4444] uppercase tracking-wide mb-0.5">Rejection Reason</p>
                <p className="text-sm text-[#1C1B18]">{request.rejection_reason}</p>
              </div>
            )}

            {request.photo_urls && request.photo_urls.length > 0 && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1.5">Photos</p>
                <div className="flex flex-wrap gap-2">
                  {request.photo_urls.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxUrl(url)}
                      className="relative w-16 h-16 rounded-md overflow-hidden border border-border hover:border-accent transition-colors cursor-pointer"
                    >
                      <Image src={url} alt={`Photo ${i + 1}`} fill className="object-cover" sizes="64px" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {request.status === "Pending" && !request.archived && (
              <div className="border-t border-border pt-3 space-y-2">
                {rejecting ? (
                  <div className="space-y-2">
                    <p className="text-xs text-text-muted">Rejection reason (optional):</p>
                    <textarea
                      value={rejectionText}
                      onChange={(e) => setRejectionText(e.target.value)}
                      rows={2}
                      placeholder="Explain why this request is not approved..."
                      className="edit-input resize-none w-full text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleReject}
                        disabled={loading}
                        className="flex-1 py-1.5 bg-[#ef4444] text-white text-xs font-medium rounded hover:bg-[#dc2626] disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? "Rejecting..." : "Confirm Reject"}
                      </button>
                      <button
                        onClick={() => { setRejecting(false); setRejectionText(""); }}
                        className="px-3 py-1.5 text-xs text-text-muted hover:text-text cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handlePublish}
                      disabled={loading}
                      className="flex-1 py-1.5 bg-[#22c55e] text-white text-xs font-medium rounded hover:bg-[#16a34a] disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? "..." : "Publish"}
                    </button>
                    <button
                      onClick={() => setRejecting(true)}
                      disabled={loading}
                      className="flex-1 py-1.5 bg-[#ef4444] text-white text-xs font-medium rounded hover:bg-[#dc2626] disabled:opacity-50 cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-border pt-2">
              {archiveConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    {request.archived ? "Unarchive this request?" : "Archive this request?"}
                  </span>
                  <button
                    onClick={handleArchive}
                    className="text-xs text-accent hover:underline cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setArchiveConfirm(false)}
                    className="text-xs text-text-muted hover:text-text cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setArchiveConfirm(true)}
                  className="text-xs text-text-muted hover:text-accent cursor-pointer"
                >
                  {request.archived ? "Unarchive" : "Archive"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "Published" ? "#22c55e" :
    status === "Rejected" ? "#ef4444" :
    "#C8922A";
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: `${color}22`, color }}
    >
      {status}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-[10px] text-text-muted uppercase tracking-wide block">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}
