"use client";

import type { Status } from "@/lib/types";

const config: Record<Status, { bg: string; text: string }> = {
  Open: { bg: "bg-status-open-bg", text: "text-status-open" },
  "In Progress": { bg: "bg-status-progress-bg", text: "text-status-progress" },
  "Awaiting Parts": { bg: "bg-status-parts-bg", text: "text-status-parts" },
  Complete: { bg: "bg-status-complete-bg", text: "text-status-complete" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const c = config[status];
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}
