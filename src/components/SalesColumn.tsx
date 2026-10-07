"use client";

import { useState } from "react";
import Image from "next/image";
import {
  champions,
  formatLogTime,
  monthTotals,
  rankMonth,
  rankServers,
  shiftMonth,
  type RankedServer,
  type SalesLogEntry,
  type SalesServer,
} from "@/lib/sales";

const MEDAL_COLORS: Record<number, string> = { 1: "#D4AF37", 2: "#C0C0C0", 3: "#CD7F32" };

export function bottles(n: number): string {
  return `${n} bottle${n === 1 ? "" : "s"}`;
}

export function joinNames(list: { name: string }[]): string {
  const names = list.map((c) => c.name);
  return names.length <= 2 ? names.join(" & ") : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export function CrownIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5L3 7zm2.4 14h13.2v-1.5H5.4V21z" />
    </svg>
  );
}

interface Props {
  location: string;
  month: string;
  servers: SalesServer[]; // all servers (active + removed) — removed ones still count for history
  logs: SalesLogEntry[];
  gm: boolean;
  busyIds: Set<string>;
  onAdjust: (serverId: string, delta: 1 | -1) => void;
  onRemove: (serverId: string) => Promise<boolean>;
  onAdd: (name: string, location: string) => Promise<boolean>;
  className?: string;
}

export default function SalesColumn({ location, month, servers, logs, gm, busyIds, onAdjust, onRemove, onAdd, className = "" }: Props) {
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const totals = monthTotals(logs, month, location);
  const board = rankServers(
    servers
      .filter((s) => s.location === location && s.active)
      .map((s) => ({ id: s.id, name: s.name, total: totals.get(s.id) || 0 }))
  );
  const leaders = champions(board);
  const lastLeaders = champions(rankMonth(logs, servers, shiftMonth(month, -1), location));

  const names = new Map(servers.map((s) => [s.id, s.name]));
  const history = logs
    .filter((l) => l.location === location)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 30);

  async function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || adding) return;
    setAdding(true);
    if (await onAdd(newName.trim(), location)) setNewName("");
    setAdding(false);
  }

  return (
    <section className={`flex flex-col min-w-0 ${className}`}>
      {/* Column header — matches the other tabs */}
      <div className="flex flex-col items-center mb-3 px-3 py-3 bg-[#1F1E1A] border-b-2 border-accent rounded-t-lg">
        <div className="flex items-center gap-2 justify-center">
          <Image src="/logos/HB_Distillery_Round.png" alt="" width={28} height={28} className="opacity-40" />
          <h2 className="font-bold uppercase text-accent tracking-wide text-center" style={{ fontSize: "22px" }}>
            {location}
          </h2>
        </div>
      </div>

      <div className="flex-1 px-2.5 pb-4 column-bg space-y-3">
        {/* Champion banner */}
        <div
          className="rounded-xl border px-4 py-3 text-center"
          style={{ borderColor: "rgba(200,146,42,0.5)", background: "linear-gradient(180deg, rgba(200,146,42,0.18), rgba(200,146,42,0.06))" }}
        >
          {leaders.length > 0 ? (
            <>
              <div className="flex items-center justify-center gap-1.5 text-accent">
                <CrownIcon />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Current Champion{leaders.length > 1 ? "s" : ""}</span>
              </div>
              <p className="mt-1 text-xl font-bold text-text leading-tight break-words">{joinNames(leaders)}</p>
              <p className="text-sm font-semibold text-accent">{bottles(leaders[0].total)}</p>
            </>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-accent/80 py-1">
              <CrownIcon className="w-4 h-4" />
              <span className="text-sm font-medium">No champion yet — be the first!</span>
            </div>
          )}
        </div>

        {lastLeaders.length > 0 && (
          <p className="text-center text-sm text-text-muted -mt-1">
            Last month&apos;s champion{lastLeaders.length > 1 ? "s" : ""}:{" "}
            <span className="font-semibold text-text">{joinNames(lastLeaders)}</span> ({bottles(lastLeaders[0].total)})
          </p>
        )}

        {/* Leaderboard */}
        {board.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-6 opacity-60">
            {gm ? "No servers yet — add one below." : "No servers yet"}
          </p>
        ) : (
          <ol className="space-y-2">
            {board.map((s) => (
              <LeaderRow
                key={s.id}
                server={s}
                gm={gm}
                busy={busyIds.has(s.id)}
                confirming={confirmRemoveId === s.id}
                onAdjust={onAdjust}
                onAskRemove={() => setConfirmRemoveId(s.id)}
                onCancelRemove={() => setConfirmRemoveId(null)}
                onConfirmRemove={async () => {
                  if (await onRemove(s.id)) setConfirmRemoveId(null);
                }}
              />
            ))}
          </ol>
        )}

        {/* GM-only tools */}
        {gm && (
          <div className="space-y-3 pt-1">
            <form onSubmit={submitAdd} className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Server name"
                aria-label={`New server name for ${location}`}
                className="form-input !h-11 !text-base"
                maxLength={60}
              />
              <button
                type="submit"
                disabled={adding || !newName.trim()}
                className="h-11 px-4 shrink-0 bg-accent text-bg text-sm font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
              >
                {adding ? "Adding…" : "+ Add Server"}
              </button>
            </form>

            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full h-10 text-xs font-semibold uppercase tracking-wider text-text-muted border border-border rounded-lg hover:text-text hover:border-accent/60 cursor-pointer"
            >
              {showHistory ? "Hide History" : "History"}
            </button>

            {showHistory && (
              <div className="rounded-lg border border-border bg-surface/60 p-2">
                {history.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-3">No changes yet this month or last.</p>
                ) : (
                  <ul className="divide-y divide-border text-sm">
                    {history.map((h) => (
                      <li key={h.id} className="flex items-center gap-2 py-1.5 px-1">
                        <span className={`w-8 shrink-0 font-bold tabular-nums ${h.delta > 0 ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                          {h.delta > 0 ? "+1" : "−1"}
                        </span>
                        <span className="flex-1 min-w-0 truncate text-text">{names.get(h.server_id) || "Unknown"}</span>
                        <span className="shrink-0 text-xs text-text-muted">{formatLogTime(h.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function LeaderRow({
  server,
  gm,
  busy,
  confirming,
  onAdjust,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: {
  server: RankedServer;
  gm: boolean;
  busy: boolean;
  confirming: boolean;
  onAdjust: (serverId: string, delta: 1 | -1) => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}) {
  const medal = server.total > 0 ? MEDAL_COLORS[server.rank] : undefined;

  if (confirming) {
    return (
      <li className="rounded-xl border border-[#ef4444]/50 bg-surface px-3 py-3 space-y-2">
        <p className="text-sm text-text">
          Remove <strong>{server.name}</strong> from this month&apos;s board? Their history is kept.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onConfirmRemove}
            disabled={busy}
            className="h-11 flex-1 bg-[#ef4444] text-white text-sm font-semibold rounded-lg hover:bg-[#dc2626] disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Removing…" : "Remove"}
          </button>
          <button onClick={onCancelRemove} className="h-11 flex-1 text-sm text-text-muted border border-border rounded-lg hover:text-text cursor-pointer">
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li
      className="flex items-center gap-3 rounded-xl border-2 bg-surface px-3 py-2.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
      style={{ borderColor: medal ? `${medal}66` : "var(--color-border)" }}
    >
      <span
        className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold tabular-nums"
        style={medal ? { background: `${medal}26`, color: medal } : { color: "var(--color-text-muted)" }}
      >
        {server.rank}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-text truncate">{server.name}</p>
        {gm && (
          <button onClick={onAskRemove} className="text-xs text-text-muted hover:text-[#ef4444] cursor-pointer">
            Remove
          </button>
        )}
      </div>

      {gm ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <AdjustButton label={`Remove a bottle from ${server.name}`} disabled={server.total === 0} onClick={() => onAdjust(server.id, -1)}>
            −
          </AdjustButton>
          <span className={`w-10 text-center text-2xl font-bold tabular-nums text-text transition-opacity ${busy ? "opacity-50" : ""}`}>
            {server.total}
          </span>
          <AdjustButton label={`Add a bottle for ${server.name}`} disabled={false} onClick={() => onAdjust(server.id, 1)} primary>
            +
          </AdjustButton>
        </div>
      ) : (
        <span className="shrink-0 text-3xl font-bold tabular-nums" style={{ color: medal || "var(--color-text)" }}>
          {server.total}
        </span>
      )}
    </li>
  );
}

function AdjustButton({ children, label, disabled, onClick, primary }: { children: React.ReactNode; label: string; disabled: boolean; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`w-11 h-11 rounded-lg text-2xl font-bold leading-none flex items-center justify-center select-none touch-manipulation cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
        primary ? "bg-accent text-bg hover:bg-accent-hover" : "bg-bg border border-border text-text hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}
