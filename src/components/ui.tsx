"use client";
import { useEffect, useState } from "react";
import type { Customer, OrderStatus, Product } from "@/lib/types";
import { creditUsedPct } from "@/lib/calc";
import { useStore } from "@/lib/store";

export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => {
    const p = useStore.persist;
    if (p.hasHydrated()) setH(true);
    return p.onFinishHydration(() => setH(true));
  }, []);
  return h;
}

export const Kbd = ({ children }: { children: React.ReactNode }) => <span className="kbd">{children}</span>;

export function Avatar({ initials, size = 24, tone = 0 }: { initials: string; size?: number; tone?: number }) {
  const hue = [155, 210, 30, 280, 340][tone % 5];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{
        width: size, height: size, fontSize: size * 0.4,
        background: `hsl(${hue} 45% 88%)`, color: `hsl(${hue} 50% 24%)`,
      }}
    >
      {initials}
    </span>
  );
}

export function Thumb({ p, size = 28 }: { p: Pick<Product, "hue" | "brand">; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, hsl(${p.hue} 70% 62%), hsl(${p.hue} 65% 46%))`,
        color: "white",
      }}
    >
      {p.brand.slice(0, 2).toUpperCase()}
    </span>
  );
}

const STATUS: Record<OrderStatus, [string, string]> = {
  booked: ["Pending", "chip-warn"],
  approved: ["In warehouse", "chip-info"],
  picked: ["Ready to invoice", "chip-ok"],
  invoiced: ["Out for delivery", "chip-info"],
  delivered: ["Delivered", "chip-ok"],
  paid: ["Paid", "chip-ok"],
  hold: ["On hold", "chip-bad"],
  cancelled: ["Cancelled", "chip-mute"],
};
export const statusLabel = (s: OrderStatus) => STATUS[s][0];
export function StatusChip({ status }: { status: OrderStatus }) {
  return <span className={`chip ${STATUS[status][1]}`}>{STATUS[status][0]}</span>;
}

export function Meter({ pct, tone }: { pct: number; tone?: "ok" | "warn" | "bad" }) {
  const t = tone ?? (pct >= 90 ? "bad" : pct >= 70 ? "warn" : "ok");
  const col = t === "bad" ? "#d9483b" : t === "warn" ? "#e0a21a" : "var(--accent)";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--mute-bg)" }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(3, pct)}%`, background: col }} />
    </div>
  );
}

export function CreditMeter({ c }: { c: Customer }) {
  if (c.type === "cash") return <span className="chip chip-mute">Cash customer</span>;
  const pct = creditUsedPct(c);
  return (
    <div className="min-w-[160px]">
      <div className="mb-1 flex justify-between text-[11px] text-ink2">
        <span>Credit used</span>
        <span className="num">{pct}%</span>
      </div>
      <Meter pct={pct} />
    </div>
  );
}

export function AgingBar({ c }: { c: Customer }) {
  // illustrative split of balance across age buckets, driven by oldest due
  const b = c.balance;
  const d = c.oldestDue;
  const w = d > 60 ? [0.3, 0.2, 0.2, 0.3] : d > 30 ? [0.4, 0.3, 0.3, 0] : d > 15 ? [0.65, 0.35, 0, 0] : [1, 0, 0, 0];
  const cols = ["var(--ok-fg)", "#d9a319", "#e07a2b", "#d9483b"];
  const labels = ["0-30", "31-60", "61-90", "90+"];
  return (
    <div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full gap-px" style={{ background: "var(--mute-bg)" }}>
        {w.map((x, i) => x > 0 && <div key={i} style={{ width: `${x * 100}%`, background: cols[i] }} />)}
      </div>
      <div className="mt-1 flex gap-2 text-[10.5px] text-ink3">
        {w.map((x, i) => x > 0 && (
          <span key={i} className="num">{labels[i]}d {Math.round((b * x) / 1000)}k</span>
        ))}
      </div>
    </div>
  );
}

export function Spark({ seed, w = 54, h = 16 }: { seed: number; w?: number; h?: number }) {
  const pts = Array.from({ length: 10 }, (_, i) => 0.5 + 0.4 * Math.sin(seed * 1.7 + i * 0.9) * Math.cos(seed + i * 0.3));
  const path = pts.map((v, i) => `${i ? "L" : "M"}${(i / 9) * w},${h - v * h}`).join(" ");
  return (
    <svg width={w} height={h} className="text-accent">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-center text-ink3">
      <div className="text-[13px] font-semibold text-ink2">{title}</div>
      {hint && <div className="text-xs">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 560 }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-4 pt-[8vh]" onMouseDown={onClose}>
      <div className="panel pop w-full max-h-[84vh] overflow-auto" style={{ maxWidth: width }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-[14px] font-semibold">{title}</div>
          <button className="btn h-7 px-2" onClick={onClose}>Esc</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

let toastFn: (m: string) => void = () => {};
export const toast = (m: string) => toastFn(m);
export function Toaster() {
  const [items, setItems] = useState<{ id: number; m: string }[]>([]);
  useEffect(() => {
    toastFn = (m) => {
      const id = Math.random();
      setItems((x) => [...x, { id, m }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2600);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2">
      {items.map((i) => (
        <div key={i.id} className="slidein rounded-xl bg-[#16201b] px-4 py-2 text-[13px] font-medium text-white shadow-lg">
          {i.m}
        </div>
      ))}
    </div>
  );
}
