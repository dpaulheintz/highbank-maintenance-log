interface EmailIssue {
  title: string;
  description: string | null;
  category: string;
  priority: string;
  status: string;
  owner: string | null;
  due_date: string | null;
  reported_by: string | null;
  locationName: string;
  vendorName: string | null;
}

export async function sendEmail(payload: {
  type: "new_request" | "owner_assigned" | "status_changed" | "overdue";
  issue: EmailIssue;
  ownerEmail?: string | null;
  ownerName?: string | null;
  oldStatus?: string;
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

export function buildEmailIssue(
  issue: {
    title: string;
    description: string | null;
    category: string;
    priority: string;
    status: string;
    owner: string | null;
    due_date: string | null;
    reported_by: string | null;
  },
  locationName: string,
  vendorName: string | null
) {
  return { ...issue, locationName, vendorName };
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "Complete") return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}
