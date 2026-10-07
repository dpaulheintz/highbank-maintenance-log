import { supabase } from "@/lib/supabase";

export const SALES_LOCATIONS = ["Grandview", "Gahanna", "Westerville/PO Box"] as const;
export type SalesLocation = (typeof SALES_LOCATIONS)[number];

// First month the Server Sales log was in use
export const SALES_FIRST_MONTH = "2026-10";

const TZ = "America/New_York";
const PIN_KEY = "hb_sales_pin";

export interface SalesServer {
  id: string;
  name: string;
  location: string;
  active: boolean;
  created_at: string;
}

export interface SalesLogEntry {
  id: string;
  server_id: string;
  location: string;
  delta: number;
  month: string;
  created_at: string;
}

export interface RankedServer {
  id: string;
  name: string;
  total: number;
  rank: number;
}

/** 'YYYY-MM' for the given instant, in America/New_York (matches the DB's month column). */
export function monthKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit" }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 'October 2026' */
export function monthName(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const name = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${name} ${y}`;
}

/** 'OCTOBER 2026' */
export function monthLabel(key: string): string {
  return monthName(key).toUpperCase();
}

/** Past months newest first, from the month before `current` back to SALES_FIRST_MONTH. */
export function pastMonths(current: string): string[] {
  const out: string[] = [];
  for (let k = shiftMonth(current, -1); k >= SALES_FIRST_MONTH; k = shiftMonth(k, -1)) out.push(k);
  return out;
}

export function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Ranks entries highest first. Ties share a rank (1, 1, 3). */
export function rankServers(entries: { id: string; name: string; total: number }[]): RankedServer[] {
  const sorted = [...entries].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return sorted.map((e) => ({ ...e, rank: 1 + sorted.filter((o) => o.total > e.total).length }));
}

export function champions(ranked: RankedServer[]): RankedServer[] {
  return ranked.filter((r) => r.rank === 1 && r.total > 0);
}

/** Per-server totals for one location and month, built from the log. */
export function monthTotals(logs: SalesLogEntry[], month: string, location: string): Map<string, number> {
  const totals = new Map<string, number>();
  for (const l of logs) {
    if (l.month !== month || l.location !== location) continue;
    totals.set(l.server_id, (totals.get(l.server_id) || 0) + l.delta);
  }
  return totals;
}

/** Ranked list of everyone who sold in that month (used for past months). */
export function rankMonth(logs: SalesLogEntry[], servers: SalesServer[], month: string, location: string): RankedServer[] {
  const totals = monthTotals(logs, month, location);
  const names = new Map(servers.map((s) => [s.id, s.name]));
  const entries = [...totals.entries()]
    .filter(([, total]) => total > 0)
    .map(([id, total]) => ({ id, name: names.get(id) || "Unknown", total }));
  return rankServers(entries);
}

/** Fetches log rows for the given months, paging past Supabase's 1000-row limit. */
export async function fetchLogs(filter: { months?: string[]; before?: string }): Promise<SalesLogEntry[]> {
  const PAGE = 1000;
  const rows: SalesLogEntry[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from("sales_log").select("*").order("created_at", { ascending: true }).range(from, from + PAGE - 1);
    if (filter.months) q = q.in("month", filter.months);
    if (filter.before) q = q.lt("month", filter.before);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...((data || []) as SalesLogEntry[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function fetchServers(): Promise<SalesServer[]> {
  const { data, error } = await supabase.from("sales_servers").select("*").order("name");
  if (error) throw new Error(error.message);
  return (data || []) as SalesServer[];
}

// ── GM PIN (kept only in sessionStorage; verified server-side) ──

export function getStoredPin(): string | null {
  try { return sessionStorage.getItem(PIN_KEY); } catch { return null; }
}

export function storePin(pin: string | null) {
  try {
    if (pin) sessionStorage.setItem(PIN_KEY, pin);
    else sessionStorage.removeItem(PIN_KEY);
  } catch { /* storage unavailable: unlock lasts until reload */ }
}

export async function verifyPin(pin: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("sales_verify_pin", { p_pin: pin });
  if (error) throw new Error(friendlyError(error.message));
  return data === true;
}

export class InvalidPinError extends Error {}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.message.includes("Invalid PIN")) throw new InvalidPinError("PIN no longer valid. Please unlock again.");
    throw new Error(friendlyError(error.message));
  }
  return data as T;
}

export const addServer = (pin: string, name: string, location: string) =>
  call<string>("sales_add_server", { p_pin: pin, p_name: name, p_location: location });

export const adjustServer = (pin: string, serverId: string, delta: 1 | -1) =>
  call<number>("sales_adjust", { p_pin: pin, p_server_id: serverId, p_delta: delta });

export const removeServer = (pin: string, serverId: string) =>
  call<void>("sales_remove_server", { p_pin: pin, p_server_id: serverId });

function friendlyError(msg: string): string {
  if (msg.includes("below 0")) return "Can't go below 0 bottles.";
  if (msg.includes("Server not found")) return "That server no longer exists. Refresh and try again.";
  if (msg.includes("Name is required")) return "Enter a name first.";
  if (msg.includes("Invalid location")) return "Invalid location.";
  if (/fetch|network/i.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
  return `Something went wrong: ${msg}`;
}
