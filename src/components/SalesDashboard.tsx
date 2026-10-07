"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SALES_LOCATIONS,
  InvalidPinError,
  addServer,
  adjustServer,
  fetchLogs,
  fetchServers,
  getStoredPin,
  monthKey,
  monthLabel,
  removeServer,
  shiftMonth,
  storePin,
  verifyPin,
  type SalesLocation,
  type SalesLogEntry,
  type SalesServer,
} from "@/lib/sales";
import SalesColumn from "./SalesColumn";
import SalesPinModal from "./SalesPinModal";
import SalesPastMonths from "./SalesPastMonths";

const LOCATION_KEY = "hb_sales_location";
const REFRESH_MS = 60_000;

export default function SalesDashboard() {
  const [month, setMonth] = useState(() => monthKey());
  const [servers, setServers] = useState<SalesServer[]>([]);
  const [logs, setLogs] = useState<SalesLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pin, setPin] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [error, setError] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [mobileLocation, setMobileLocation] = useState<SalesLocation>(SALES_LOCATIONS[0]);

  const queues = useRef(new Map<string, Promise<void>>());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const current = monthKey();
    try {
      const [s, l] = await Promise.all([fetchServers(), fetchLogs({ months: [current, shiftMonth(current, -1)] })]);
      setMonth(current);
      setServers(s);
      setLogs(l);
      setLoadError("");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load sales data.");
    }
    setLoading(false);
  }, []);

  // Initial load, periodic refresh for viewers, and refresh when the tab regains focus
  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Restore GM unlock for this browser session, re-checking the PIN in case it changed
  useEffect(() => {
    const stored = getStoredPin();
    if (stored) {
      setPin(stored);
      verifyPin(stored).then((ok) => { if (!ok) lock(); }).catch(() => {});
    }
    try {
      const saved = localStorage.getItem(LOCATION_KEY);
      if (saved && (SALES_LOCATIONS as readonly string[]).includes(saved)) setMobileLocation(saved as SalesLocation);
    } catch { /* ignore */ }
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  function lock() {
    storePin(null);
    setPin(null);
  }

  function showError(msg: string) {
    setError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(""), 6000);
  }

  function handleFailure(err: unknown) {
    if (err instanceof InvalidPinError) lock();
    showError(err instanceof Error ? err.message : "Something went wrong.");
  }

  // Reconcile with the database shortly after the last write
  function scheduleRefresh() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(load, 1500);
  }

  function setBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // Taps are queued per server so quick repeated taps all count, in order.
  // The total only changes after the database confirms each one.
  function handleAdjust(serverId: string, delta: 1 | -1) {
    if (!pin) return;
    const server = servers.find((s) => s.id === serverId);
    if (!server) return;
    setBusy(serverId, true);

    const prev = queues.current.get(serverId) || Promise.resolve();
    const next = prev.then(async () => {
      try {
        await adjustServer(pin, serverId, delta);
        const entry: SalesLogEntry = {
          id: `local-${crypto.randomUUID()}`,
          server_id: serverId,
          location: server.location,
          delta,
          month: monthKey(),
          created_at: new Date().toISOString(),
        };
        setLogs((l) => [...l, entry]);
        scheduleRefresh();
      } catch (err) {
        handleFailure(err);
      }
    });
    queues.current.set(serverId, next);
    next.then(() => {
      if (queues.current.get(serverId) === next) {
        queues.current.delete(serverId);
        setBusy(serverId, false);
      }
    });
  }

  async function handleRemove(serverId: string): Promise<boolean> {
    if (!pin) return false;
    setBusy(serverId, true);
    try {
      await removeServer(pin, serverId);
      setServers((list) => list.map((s) => (s.id === serverId ? { ...s, active: false } : s)));
      scheduleRefresh();
      return true;
    } catch (err) {
      handleFailure(err);
      return false;
    } finally {
      setBusy(serverId, false);
    }
  }

  async function handleAdd(name: string, location: string): Promise<boolean> {
    if (!pin) return false;
    try {
      await addServer(pin, name, location);
      setServers(await fetchServers());
      return true;
    } catch (err) {
      handleFailure(err);
      return false;
    }
  }

  function pickLocation(loc: SalesLocation) {
    setMobileLocation(loc);
    try { localStorage.setItem(LOCATION_KEY, loc); } catch { /* ignore */ }
  }

  const gm = !!pin;

  return (
    <>
      {/* Month + actions */}
      <div className="flex flex-col items-center gap-3 py-5 sm:flex-row sm:justify-between">
        <div className="text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-text-muted">Bottles sold this month</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-wider text-text">{monthLabel(month)}</h1>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setPastOpen(true)}
            className="h-11 px-4 text-sm font-semibold border border-border rounded-lg text-text hover:border-accent cursor-pointer"
          >
            Past Months
          </button>
          {gm ? (
            <>
              <span className="h-11 px-3 inline-flex items-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/40">
                <span className="w-2 h-2 rounded-full bg-accent" /> GM Mode
              </span>
              <button
                onClick={lock}
                className="h-11 px-4 text-sm font-semibold border border-border rounded-lg text-text-muted hover:text-text cursor-pointer"
              >
                Lock
              </button>
            </>
          ) : (
            <button
              onClick={() => setPinOpen(true)}
              className="h-11 px-4 text-sm font-semibold bg-accent text-bg rounded-lg hover:bg-accent-hover cursor-pointer"
            >
              GM Unlock
            </button>
          )}
        </div>
      </div>

      {/* Mobile / tablet location picker */}
      <div className="grid grid-cols-3 gap-2 mb-4 lg:hidden" role="tablist" aria-label="Location">
        {SALES_LOCATIONS.map((loc) => {
          const active = loc === mobileLocation;
          return (
            <button
              key={loc}
              role="tab"
              aria-selected={active}
              onClick={() => pickLocation(loc)}
              className={`min-h-12 px-2 py-2 rounded-lg text-sm font-bold uppercase tracking-wide leading-tight cursor-pointer border-2 transition-colors ${
                active ? "bg-accent text-bg border-accent" : "bg-surface text-text-muted border-border hover:text-text"
              }`}
            >
              {/* let "Westerville/PO Box" wrap after the slash */}
              {loc.replace("/", "/​")}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-text-muted text-center py-16">Loading…</p>
      ) : loadError && servers.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-sm text-[#ef4444]">Couldn&apos;t load sales data: {loadError}</p>
          <button onClick={load} className="h-11 px-4 text-sm border border-border rounded-lg hover:border-accent cursor-pointer">
            Try again
          </button>
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-3">
          {SALES_LOCATIONS.map((loc, idx) => (
            <SalesColumn
              key={loc}
              location={loc}
              month={month}
              servers={servers}
              logs={logs}
              gm={gm}
              busyIds={busyIds}
              onAdjust={handleAdjust}
              onRemove={handleRemove}
              onAdd={handleAdd}
              className={`${loc === mobileLocation ? "flex" : "hidden"} lg:flex ${idx < SALES_LOCATIONS.length - 1 ? "lg:border-r lg:border-border" : ""}`}
            />
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md flex items-start gap-3 rounded-xl border border-[#ef4444]/60 bg-[#2a1414] px-4 py-3 shadow-2xl">
          <p className="flex-1 text-sm text-[#fca5a5]">{error}</p>
          <button onClick={() => setError("")} aria-label="Dismiss" className="text-[#fca5a5] text-xl leading-none cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {pinOpen && (
        <SalesPinModal
          onClose={() => setPinOpen(false)}
          onUnlocked={(p) => {
            storePin(p);
            setPin(p);
            setPinOpen(false);
          }}
        />
      )}

      {pastOpen && <SalesPastMonths currentMonth={month} servers={servers} onClose={() => setPastOpen(false)} />}
    </>
  );
}
