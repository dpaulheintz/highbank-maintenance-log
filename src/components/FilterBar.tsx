"use client";

import type { Status, Category, Priority } from "@/lib/types";

const STATUSES: Status[] = ["Open", "In Progress", "Awaiting Parts", "Complete"];
const CATEGORIES: Category[] = ["Equipment", "Plumbing", "HVAC", "Electrical", "Structural", "Cleaning", "Pest"];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Emergency"];

interface Filters {
  status: string;
  category: string;
  priority: string;
  showCompleted: boolean;
  showArchived: boolean;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export default function FilterBar({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        label="Status"
        value={filters.status}
        options={STATUSES}
        onChange={(v) => onChange({ ...filters, status: v })}
      />
      <Select
        label="Category"
        value={filters.category}
        options={CATEGORIES}
        onChange={(v) => onChange({ ...filters, category: v })}
      />
      <Select
        label="Priority"
        value={filters.priority}
        options={PRIORITIES}
        onChange={(v) => onChange({ ...filters, priority: v })}
      />
      <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer select-none">
        <input
          type="checkbox"
          checked={filters.showCompleted}
          onChange={(e) => onChange({ ...filters, showCompleted: e.target.checked })}
          className="accent-accent w-3.5 h-3.5"
        />
        Show completed
      </label>
      <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer select-none ml-2 opacity-70 hover:opacity-100 transition-opacity">
        <input
          type="checkbox"
          checked={filters.showArchived}
          onChange={(e) => onChange({ ...filters, showArchived: e.target.checked })}
          className="accent-accent w-3.5 h-3.5"
        />
        Archived Jobs
      </label>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-surface border border-border rounded px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent cursor-pointer"
    >
      <option value="">All {label}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
