import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// TODO: Remove test mode before go-live
const TEST_MODE = true;
const TEST_EMAIL = "pheintzman@highbankco.com";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function branded(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
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

function row(label: string, value: string | null | undefined): string {
  if (!value) return "";
  return `<tr>
    <td style="padding:5px 14px 5px 0;color:#9e9a8f;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;font-size:14px;color:#1C1B18;">${value}</td>
  </tr>`;
}

function table(fields: Record<string, string | null | undefined>): string {
  const rows = Object.entries(fields).map(([k, v]) => row(k, v)).join("");
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>`;
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return d; }
}

function urgentBanner(): string {
  return `<div style="background:#ef4444;color:#fff;padding:10px 32px;font-size:15px;font-weight:bold;text-align:center;letter-spacing:1px;margin-bottom:8px;">⚠ URGENT</div>`;
}

export async function POST(req: NextRequest) {
  try {
    const { type, issue, ownerEmail, ownerName, oldStatus, managerEmails, updateText, updatedBy } = await req.json();

    const loc = issue.locationName || "Unknown Location";
    const isUrgent = issue.priority === "Emergency" || issue.priority === "High";
    const urgentPrefix = isUrgent ? "URGENT: " : "";

    const details = table({
      "Title": issue.title,
      "Location": loc,
      "Category": issue.category,
      "Priority": issue.priority,
      "Status": issue.status,
      "Owner": ownerName || issue.owner || null,
      "Vendor": issue.vendorName || null,
      "Report Date": fmtDate(issue.report_date),
      "Est. Repair": fmtDate(issue.estimated_repair_date),
      "Reported By": issue.reported_by || null,
    });

    const desc = issue.description
      ? `<p style="margin:16px 0 4px;"><strong>Description:</strong></p><p style="margin:0;color:#444;">${issue.description}</p>`
      : "";

    let subject = "";
    let html = "";

    switch (type) {
      case "new_request": {
        subject = `${urgentPrefix}New Maintenance Request: ${issue.title} — ${loc}`;
        html = branded(`
          ${isUrgent ? urgentBanner() : ""}
          <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">New Maintenance Request</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">A new issue has been submitted.</p>
          ${details}${desc}
        `);
        break;
      }
      case "owner_assigned": {
        subject = `You've been assigned: ${issue.title} — ${loc}`;
        html = branded(`
          <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">You've Been Assigned an Issue</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">${ownerName || "You"}, you have been assigned the following maintenance issue.</p>
          ${details}${desc}
        `);
        break;
      }
      case "status_changed": {
        subject = `Status Update: ${issue.title} is now ${issue.status}`;
        html = branded(`
          <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">Status Update</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">Status changed from <strong>${oldStatus}</strong> to <strong>${issue.status}</strong>.</p>
          ${details}${desc}
        `);
        break;
      }
      case "overdue": {
        const repairDate = new Date(issue.estimated_repair_date);
        const diffDays = Math.floor((Date.now() - repairDate.getTime()) / 86400000);
        subject = `OVERDUE: ${issue.title} — ${loc}`;
        html = branded(`
          <h2 style="margin:0 0 4px;font-size:18px;color:#C8922A;">Overdue Issue</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">This issue is <strong style="color:#d97706;">${diffDays} day${diffDays !== 1 ? "s" : ""} overdue</strong>.</p>
          ${details}${desc}
        `);
        break;
      }
      case "job_update": {
        subject = `Update on: ${issue.title} — ${loc}`;
        html = branded(`
          <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">Job Update</h2>
          <p style="margin:0 0 4px;color:#9e9a8f;font-size:13px;">Posted by <strong>${updatedBy || "Unknown"}</strong></p>
          <div style="background:#f9f8f6;border-left:3px solid #C8922A;padding:12px 16px;margin:16px 0;font-size:14px;color:#1C1B18;">${updateText}</div>
          <p style="margin:0;font-size:13px;color:#9e9a8f;">Current Status: <strong style="color:#1C1B18;">${issue.status}</strong></p>
          ${details}${desc}
        `);
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    // Collect intended recipients (unused in test mode, but logged for visibility)
    const intendedTo = [ownerEmail, ...(managerEmails || [])].filter(Boolean);

    // TODO: Remove test mode before go-live
    // In test mode all emails go only to TEST_EMAIL regardless of actual recipients.
    const to = TEST_MODE ? TEST_EMAIL : (intendedTo.length > 0 ? intendedTo.join(", ") : TEST_EMAIL);

    if (TEST_MODE) {
      console.log(`[TEST MODE] Email "${subject}" would go to: ${intendedTo.join(", ") || "(no recipients)"} — redirected to ${TEST_EMAIL}`);
    }

    await transporter.sendMail({
      from: `"High Bank Maintenance Log" <no-reply@highbankco.com>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
