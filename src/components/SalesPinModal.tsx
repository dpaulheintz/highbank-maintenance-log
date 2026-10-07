"use client";

import { useEffect, useRef, useState } from "react";
import { verifyPin } from "@/lib/sales";

interface Props {
  onClose: () => void;
  onUnlocked: (pin: string) => void;
}

export default function SalesPinModal({ onClose, onUnlocked }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin.trim() || checking) return;
    setChecking(true);
    setError("");
    try {
      if (await verifyPin(pin.trim())) {
        onUnlocked(pin.trim());
      } else {
        setError("Incorrect PIN");
        setPin("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check the PIN. Try again.");
    }
    setChecking(false);
  }

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <form onSubmit={submit} className="bg-surface border border-border rounded-xl w-full max-w-xs shadow-2xl p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-bold uppercase tracking-wider text-accent">GM Unlock</h2>
          <p className="text-xs text-text-muted mt-1">Enter the GM PIN to edit leaderboards.</p>
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(""); }}
          placeholder="PIN"
          aria-label="GM PIN"
          className="form-input !h-12 !text-xl text-center tracking-[0.5em]"
          maxLength={12}
        />
        {error && <p className="text-sm text-[#ef4444] text-center font-medium">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-11 flex-1 text-sm text-text-muted border border-border rounded-lg hover:text-text cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={checking || !pin.trim()}
            className="h-11 flex-1 bg-accent text-bg text-sm font-semibold rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
          >
            {checking ? "Checking…" : "Unlock"}
          </button>
        </div>
      </form>
    </div>
  );
}
