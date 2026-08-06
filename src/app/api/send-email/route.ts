import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function dedupe(emails: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  return emails.filter((e): e is string => {
    if (!e) return false;
    const lower = e.toLowerCase().trim();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

function branded(body: string, subtitle = "Maintenance &amp; Repair Log"): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f4f0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#1C1B18;padding:24px 32px;">
      <h1 style="margin:0;color:#C8922A;font-size:20px;font-weight:600;">High Bank Distillery</h1>
      <p style="margin:4px 0 0;color:#9e9a8f;font-size:12px;letter-spacing:2px;text-transform:uppercase;">${subtitle}</p>
    </div>
    <div style="padding:24px 32px;color:#1C1B18;font-size:14px;line-height:1.6;">
      ${body}
    </div>
    <div style="background:#1C1B18;padding:16px 32px;text-align:center;">
      <p style="margin:0;color:#9e9a8f;font-size:11px;">High Bank Distillery Operations</p>
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

interface ToastEmailPayload {
  submitter_name: string;
  submitter_email: string;
  location: string;
  change_type: string;
  menu_item_name: string | null;
  current_value: string | null;
  requested_change: string;
  notes_for_charles: string | null;
}

function toastTable(req: ToastEmailPayload): string {
  return table({
    "Submitter": req.submitter_name,
    "Email": req.submitter_email,
    "Location": req.location,
    "Change Type": req.change_type,
    "Menu Item": req.menu_item_name || null,
    "Current Value": req.current_value || null,
    "Requested Change": req.requested_change,
    "Notes for Charles": req.notes_for_charles || null,
  });
}

async function handleToastEmail(type: string, body: Record<string, unknown>): Promise<NextResponse> {
  const req = body.toastRequest as ToastEmailPayload;
  const rejection_reason = body.rejection_reason as string | null | undefined;

  let subject = "";
  let html = "";
  let toList: string[] = [];
  let ccList: string[] = [];

  const toastSubtitle = "Toast Change Log";

  switch (type) {
    case "toast_new_request": {
      subject = `New Toast Change Request: ${req.change_type} — ${req.location}`;
      html = branded(`
        <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">New Toast Change Request</h2>
        <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">A new change request has been submitted for Toast POS.</p>
        ${toastTable(req)}
      `, toastSubtitle);
      toList = ["ccarter@highbankco.com"];
      break;
    }
    case "toast_published": {
      subject = `Toast Change Published: ${req.menu_item_name || req.change_type}`;
      html = branded(`
        <h2 style="margin:0 0 4px;font-size:18px;color:#22c55e;">Your Toast Change Has Been Published</h2>
        <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">Charles has reviewed and published your change in Toast.</p>
        ${toastTable(req)}
      `, toastSubtitle);
      toList = [req.submitter_email];
      ccList = ["ccarter@highbankco.com"];
      break;
    }
    case "toast_rejected": {
      subject = `Toast Change Request Not Approved: ${req.menu_item_name || req.change_type}`;
      html = branded(`
        <h2 style="margin:0 0 4px;font-size:18px;color:#ef4444;">Your Toast Change Request Has Not Been Approved</h2>
        ${rejection_reason ? `<div style="background:#fef2f2;border-left:3px solid #ef4444;padding:12px 16px;margin:16px 0;font-size:14px;color:#1C1B18;"><strong>Reason:</strong> ${rejection_reason}</div>` : ""}
        <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">Please reach out to Charles with any questions.</p>
        ${toastTable(req)}
      `, toastSubtitle);
      toList = [req.submitter_email];
      ccList = ["ccarter@highbankco.com"];
      break;
    }
    case "toast_comment": {
      const commentText = body.commentText as string || "";
      const commentAuthor = body.commentAuthor as string || "Charles";
      const attachmentUrls = (body.attachmentUrls as string[] | undefined) || [];
      const attachmentHtml = attachmentUrls.length > 0
        ? `<p style="margin:12px 0 4px;font-size:13px;color:#9e9a8f;">Attachments:</p>
           <div>${attachmentUrls.map((url) => {
             const name = url.split("/").pop() || "file";
             const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
             return isImage
               ? `<a href="${url}" style="display:inline-block;margin:4px 4px 4px 0;"><img src="${url}" alt="${name}" style="max-width:200px;max-height:150px;border-radius:6px;border:1px solid #ddd;" /></a>`
               : `<a href="${url}" style="display:inline-block;margin:4px 4px 4px 0;padding:6px 12px;background:#f5f4f0;border-radius:4px;font-size:13px;color:#1C1B18;text-decoration:none;">${name}</a>`;
           }).join("")}</div>`
        : "";
      subject = `Comment on your Toast request: ${req.menu_item_name || req.change_type} — ${req.location}`;
      html = branded(`
        <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">New Comment on Your Toast Request</h2>
        <p style="margin:0 0 4px;color:#9e9a8f;font-size:13px;">From <strong>${commentAuthor}</strong></p>
        <div style="background:#f9f8f6;border-left:3px solid #C8922A;padding:12px 16px;margin:16px 0;font-size:14px;color:#1C1B18;white-space:pre-wrap;">${commentText}</div>
        ${attachmentHtml}
        ${toastTable(req)}
      `, toastSubtitle);
      toList = [req.submitter_email];
      ccList = ["ccarter@highbankco.com"];
      break;
    }
    default:
      return NextResponse.json({ error: "Unknown toast type" }, { status: 400 });
  }

  const to = dedupe(toList);
  const cc = dedupe(ccList.filter((e) => !to.map((t) => t.toLowerCase()).includes(e.toLowerCase())));

  await transporter.sendMail({
    from: `"High Bank Maintenance" <no-reply@highbankco.com>`,
    to: to.join(", "),
    cc: cc.length > 0 ? cc.join(", ") : undefined,
    subject,
    html,
  });

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;

    if (type === "toast_new_request" || type === "toast_published" || type === "toast_rejected" || type === "toast_comment") {
      return await handleToastEmail(type, body);
    }

    const { issue, ownerEmail, ownerName, oldStatus, updateText, updatedBy, reportedByEmail } = body;

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
    let toList: string[] = [];
    let ccList: string[] = [];

    switch (type) {
      case "new_request": {
        subject = `${urgentPrefix}New Maintenance Request: ${issue.title} — ${loc}`;
        html = branded(`
          ${isUrgent ? urgentBanner() : ""}
          <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">New Maintenance Request</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">A new issue has been submitted.</p>
          ${details}${desc}
        `);
        toList = ["maintenance@highbankco.com"];
        ccList = ["ccarter@highbankco.com", reportedByEmail];
        break;
      }
      case "owner_assigned": {
        subject = `You've been assigned: ${issue.title} — ${loc}`;
        html = branded(`
          <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">You've Been Assigned an Issue</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">${ownerName || "You"}, you have been assigned the following maintenance issue.</p>
          ${details}${desc}
        `);
        toList = [ownerEmail];
        ccList = ["ccarter@highbankco.com", "maintenance@highbankco.com"];
        break;
      }
      case "status_changed": {
        subject = `Status Update: ${issue.title} is now ${issue.status}`;
        html = branded(`
          <h2 style="margin:0 0 4px;font-size:18px;color:#1C1B18;">Status Update</h2>
          <p style="margin:0 0 16px;color:#9e9a8f;font-size:13px;">Status changed from <strong>${oldStatus}</strong> to <strong>${issue.status}</strong>.</p>
          ${details}${desc}
        `);
        toList = ["maintenance@highbankco.com"];
        ccList = ["ccarter@highbankco.com", reportedByEmail];
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
        toList = ["maintenance@highbankco.com"];
        ccList = ["ccarter@highbankco.com", ownerEmail, reportedByEmail];
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
        toList = ["maintenance@highbankco.com"];
        ccList = ["ccarter@highbankco.com", ownerEmail, reportedByEmail];
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }

    const to = dedupe(toList);
    const cc = dedupe(ccList.filter((e) => e && !to.map((t) => t.toLowerCase()).includes(e.toLowerCase())));

    await transporter.sendMail({
      from: `"High Bank Maintenance" <no-reply@highbankco.com>`,
      to: to.join(", "),
      cc: cc.length > 0 ? cc.join(", ") : undefined,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Email error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
