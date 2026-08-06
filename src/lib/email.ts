export function isOverdue(estimatedRepairDate: string | null, status: string): boolean {
  if (!estimatedRepairDate || status === "Complete") return false;
  return new Date(estimatedRepairDate) < new Date();
}

export interface EmailIssue {
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  owner: string | null;
  due_date: string | null;
  report_date: string | null;
  estimated_repair_date: string | null;
  reported_by: string | null;
  locationName: string;
  vendorName: string | null;
}

export function buildEmailIssue(
  issue: {
    title: string;
    description: string | null;
    category: string;
    priority: string;
    status: string;
    owner: string | null;
    due_date: string | null;
    report_date: string | null;
    estimated_repair_date: string | null;
    reported_by: string | null;
  },
  locationName: string,
  vendorName: string | null
): EmailIssue {
  return { ...issue, locationName, vendorName };
}

export async function sendEmail(payload: {
  type: "new_request" | "owner_assigned" | "status_changed" | "overdue" | "job_update";
  issue: EmailIssue;
  ownerEmail?: string | null;
  ownerName?: string | null;
  oldStatus?: string;
  managerEmails?: string[];
  updateText?: string;
  updatedBy?: string;
  reportedByEmail?: string | null;
}) {
  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to send email:", err);
  }
}

export interface ToastEmailPayload {
  submitter_name: string;
  submitter_email: string;
  location: string;
  change_type: string;
  menu_item_name: string | null;
  current_value: string | null;
  requested_change: string;
  notes_for_charles: string | null;
}

export async function sendToastEmail(payload: {
  type: "toast_new_request" | "toast_published" | "toast_rejected" | "toast_comment";
  toastRequest: ToastEmailPayload;
  rejection_reason?: string | null;
  commentText?: string;
  commentAuthor?: string;
  attachmentUrls?: string[];
}) {
  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Failed to send toast email:", err);
  }
}
