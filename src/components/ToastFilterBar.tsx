"use client";

import type { ToastStatus, ToastChangeType } from "@/lib/types";

const STATUSES: ToastStatus[] = ["Pending", "Approved", "Rejected"];
const CHANGE_TYPES: ToastChangeType[] = [
  "Price Change",
  "Item Name Change",
  "Item Description Change",
  "86 an Item",
  "Add New Item",
  "Modifier Change",
  "Void/Comp Reason",
  "Discount/Promo",
  "Hours Change",
  "Other",
];

export interface ToastFilters {
  status: ToastStatus | "";
  changeType: ToastChangeType | "";
  showArchived: boolean;
}

interface Props {
  filters: ToastFilters;
  onChange: (f: ToastFilters) => void;
}

export default function ToastFilterBar({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 py-3 bg-surface border-b border-border">
      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as ToastStatus | "" })}
        className="form-input !py-1 !text-xs min-w-[120px]"
      >
        <option value="">All Statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <select
        value={filters.changeType}
        onChange={(e) => onChange({ ...filters, changeType: e.target.value as ToastChangeType | "" })}
        className="form-input !py-1 !text-xs min-w-[160px]"
      >
        <option value="">All Change Types</option>
        {CHANGE_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <label className="flex items-center gap-2 cursor-pointer text-xs text-text-muted">
        <input
          type="checkbox"
          checked={filters.showArchived}
          onChange={(e) => onChange({ ...filters, showArchived: e.target.checked })}
          className="accent-accent"
        />
        Archived
      </label>
    </div>
  );
}
