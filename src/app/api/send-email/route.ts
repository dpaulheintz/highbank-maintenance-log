import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Charles Carter — receives every notification
const ALWAYS_NOTIFY = ["ccarter@highbankco.com"];

// Location-specific manager mapping
const LOCATION_MANAGERS: Record<string, string> = {
  "Grandview": "kbosse@highbankco.com",
  "Gahanna": "esparks@highbankco.com",
  "Westerville/PO Box": "lholmes@highbankco.com",
  "Distillery": "ccarter@highbankco.com",
};

/**
 * Build the recipient lists for every email:
 *  to  = assigned owner + location manager (deduplicated)
 *  cc  = ALWAYS_NOTIFY + manager emails (deduplicated from `to`)
 */
function buildRecipients(
  locationName: string,
  ownerEmail: string | null | undefined,
  managerEmails: string[] = []
): { to: string[]; cc: string[] } {
  const toSet = new Set<string>();

  // 1. Assigned owner
  if (ownerEmail) toSet.add(ownerEmail);

  // 2. Location manager
  const locManager = LOCATION_MANAGERS[locationName];
  if (locManager) toSet.add(locManager);

  // 3. Build CC: ALWAYS_NOTIFY + job-specific managers, deduplicated from `to`
  const to = [...toSet];
  const ccSet = new Set<string>();
  for (const email of ALWAYS_NOTIFY) {
    if (!to.includes(email)) ccSet.add(email);
  }
  for (const email of managerEmails) {
    if (!to.includes(email) && !ccSet.has(email)) ccSet.add(email);
  }

  return { to, cc: [...ccSet] };
}

function brandedHtml(body: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1C1B18;padding:24px 32px;">
      <h1 style="margin:0;color:#C8922A;font-size:20px;font-weight:600;">High Bank Distillery</h1>
      <p style="margin:4px 0 0;color:#9e9a8f;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Maintenance &amp; Repair Log</p>
    </div>
    <div style="padding:24px 32px;color:#1C1B18;font-size:14px;line-height:1.6;">
      ${body}
    </div>
    <div style="background:#1C1B18;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#9e9a8f;font-size:11px;">High Bank Distillery Maintenance Log</p>
    </div>
  </div>
</body>
</html>`;
}

function detailRow(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr><td style="padding:6px 12px 6px 0;color:#9e9a8f;font-size:13px;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:6px 0;font-size:14px;color:#1C1B18;">${value}</td></tr>`;
}

function issueDetailsTable(data: Record<string, string | null | undefined>): string {
  const rows = Object.entries(data).map(([k, v]) => detailRow(k, v)).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>`;
}

function formatDateStr(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { type, issue, ownerEmail, ownerName, oldStatus, managerEmails, updateText, updatedBy } = await req.json();

    const location = issue.locationName || "Unknown Location";
    const shortLocation = location
      .replace("High Bank Distillery ", "")
      .replace("High Bank ", "");
    const details = issueDetailsTable({
      Title: issue.title,
      Location: shortLocation,
      Category: issue.category,
      Priority: issue.priority,
      Status: issue.status,
      Owner: ownerName || issue.owner || null,
      Vendor: issue.vendorName || null,
      "Report Date": formatDateStr(issue.report_date),
      "Est. Repair": formatDateStr(issue.estimated_repair_date),
      "Reported By": issue.reported_by || null,
    });
    const description = issue.description
      ? `<p style="margin:16px 0 0;"><strong>Description:</strong></p><p style="margin:4px 0;color:#444;">${issue.description}</p>`
      : "";

    const { to, cc } = buildRecipients(location, ownerEmail, managerEmails || []);

    let subject = "";
    let html = "";

    switch (type) {
      case "new_request": {
        subject = `New Maintenance Request: ${issue.title} — ${shortLocation}`;
        html = brandedHtml(`
          <h2 style="margin:0 0 4px;color:#1C1B18;font-size:18px;">New Maintenance Request</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">A new issue has been submitted.</p>
          ${details}${description}
        `);
        break;
      }
      case "owner_assigned": {
        subject = `You've been assigned: ${issue.title} — ${shortLocation}`;
        html = brandedHtml(`
          <h2 style="margin:0 0 4px;color:#1C1B18;font-size:18px;">You've Been Assigned an Issue</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">${ownerName || "You"}, you have been assigned the following maintenance issue.</p>
          ${details}${description}
        `);
        break;
      }
      case "status_changed": {
        subject = `Status Update: ${issue.title} is now ${issue.status}`;
        html = brandedHtml(`
          <h2 style="margin:0 0 4px;color:#1C1B18;font-size:18px;">Status Update</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">Status changed from <strong>${oldStatus}</strong> to <strong>${issue.status}</strong>.</p>
          ${details}${description}
        `);
        break;
      }
      case "overdue": {
        const repairDate = new Date(issue.estimated_repair_date);
        const today = new Date();
        const diffDays = Math.floor((today.getTime() - repairDate.getTime()) / (1000 * 60 * 60 * 24));
        subject = `Overdue: ${issue.title} — ${shortLocation}`;
        html = brandedHtml(`
          <h2 style="margin:0 0 4px;color:#C8922A;font-size:18px;">Overdue Issue</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">This issue is <strong style="color:#d97706;">${diffDays} day${diffDays !== 1 ? "s" : ""} overdue</strong>.</p>
          ${details}${description}
        `);
        break;
      }
      case "job_update": {
        subject = `Update on: ${issue.title} — ${shortLocation}`;
        html = brandedHtml(`
          <h2 style="margin:0 0 4px;color:#1C1B18;font-size:18px;">Job Update</h2>
          <p style="margin:0 0 4px;color:#9e9a8f;font-size:13px;">Posted by <strong>${updatedBy || "Unknown"}</strong></p>
          <div style="background:#f9f8f6;border-left:3px solid #C8922A;padding:12px 16px;margin:16px 0;font-size:14px;color:#1C1B18;">
            ${updateText}
          </div>
          <p style="margin:8px 0;font-size:13px;color:#9e9a8f;">Current Status: <strong style="color:#1C1B18;">${issue.status}</strong></p>
          ${details}${description}
        `);
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown email type" }, { status: 400 });
    }

    if (to.length === 0 && cc.length === 0) {
      return NextResponse.json({ error: "No recipients" }, { status: 400 });
    }

    // Resend requires at least one `to` — fall back to ALWAYS_NOTIFY if needed
    const finalTo = to.length > 0 ? to : [...ALWAYS_NOTIFY];
    const finalCc = to.length > 0 && cc.length > 0 ? cc : undefined;

    const { data, error } = await resend.emails.send({
      from: "High Bank Maintenance <onboarding@resend.dev>",
      to: finalTo,
      cc: finalCc,
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (err) {
    console.error("Email API error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
