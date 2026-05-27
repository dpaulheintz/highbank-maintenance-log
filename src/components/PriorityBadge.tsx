"use client";

import type { Priority } from "@/lib/types";

const config: Record<Priority, { bg: string; text: string }> = {
  Low: { bg: "bg-priority-low-bg", text: "text-priority-low" },
  Medium: { bg: "bg-priority-medium-bg", text: "text-priority-medium" },
  High: { bg: "bg-priority-high-bg", text: "text-priority-high" },
  Emergency: { bg: "bg-priority-emergency-bg", text: "text-priority-emergency" },
};

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const c = config[priority];
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {priority}
    </span>
  );
}
