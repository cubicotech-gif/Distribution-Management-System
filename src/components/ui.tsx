"use client";
import { useEffect, useState } from "react";
import type { Customer, OrderStatus, Product } from "@/lib/types";
import { aging, BUCKETS, creditUsedPct } from "@/lib/calc";
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

export function Thumb({ p, size = 28 }: { p: Pick<Product, "hue" | "brand"> & { image?: string }; size?: number }) {
  if (p.image)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.image} alt="" className="shrink-0 rounded-lg object-cover" style={{ width: size, height: size }} />;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
      style={{
        width: size, height: size, fontSize: Math.max(9, size * 0.34),
        background: `linear-gradient(135deg, hsl(${p.hue} 70% 62%), hsl(${p.hue} 65% 46%))`,
        color: "white",
      }}
    >
      {p.brand.slice(0, 2).toUpperCase()}
    </span>
  );
}

export type ViewMode = "table" | "tiles" | "compact";
export function useViewMode(key: string, def: ViewMode = "table"): [ViewMode, (m: ViewMode) => void] {
  const [m, setM] = useState<ViewMode>(def);
  useEffect(() => {
    try { const v = localStorage.getItem("view:" + key) as ViewMode | null; if (v) setM(v); } catch {}
  }, [key]);
  return [m, (v) => { setM(v); try { localStorage.setItem("view:" + key, v); } catch {} }];
}
export function ViewSwitch({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const items: [ViewMode, string, React.ReactNode][] = [
    ["table", "Detailed list", <svg key="t" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M1.5 6.5h13M6 6.5v7" /></svg>],
    ["tiles", "Tiles", <svg key="g" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="1.5" y="1.5" width="5" height="5" rx="1.2" /><rect x="9.5" y="1.5" width="5" height="5" rx="1.2" /><rect x="1.5" y="9.5" width="5" height="5" rx="1.2" /><rect x="9.5" y="9.5" width="5" height="5" rx="1.2" /></svg>],
    ["compact", "Compact list", <svg key="c" width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M2 3.5h12M2 6.5h12M2 9.5h12M2 12.5h12" /></svg>],
  ];
  return (
    <div className="flex rounded-xl border border-line bg-panel p-0.5">
      {items.map(([k, label, icon]) => (
        <button key={k} title={label} onClick={() => onChange(k)} className={`grid h-7 w-8 place-items-center rounded-lg transition-colors ${mode === k ? "bg-accent text-accentink" : "text-ink2 hover:bg-panel2"}`}>{icon}</button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ items, value, onChange }: { items: { k: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <button key={i.k} onClick={() => onChange(i.k)} className={`flex h-7 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${value === i.k ? "border-accent bg-accentsoft text-accent" : "border-line bg-panel text-ink2 hover:border-line2"}`}>
          {i.label}{i.count !== undefined && <span className="num text-[10.5px] opacity-70">{i.count}</span>}
        </button>
      ))}
    </div>
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
export function StatusChip({ status, packed, held }: { status: OrderStatus; packed?: boolean; held?: boolean }) {
  if (status === "picked" && packed === false) return <span className="chip chip-info">Being packed</span>;
  if (status === "approved" && held) return <span className="chip chip-bad">Pick on hold</span>;
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
  const orders = useStore((s) => s.orders);
  const b = aging(orders, c);
  const total = b.reduce((x, y) => x + y, 0) || 1;
  const cols = ["var(--ok-fg)", "#d9a319", "#e07a2b", "#d9483b"];
  return (
    <div>
      <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full" style={{ background: "var(--mute-bg)" }}>
        {b.map((x, i) => x > 0 && <div key={i} style={{ width: `${(x / total) * 100}%`, background: cols[i] }} />)}
      </div>
      <div className="mt-1 flex gap-2 text-[10.5px] text-ink3">
        {b.map((x, i) => x > 0 && <span key={i} className="num">{BUCKETS[i]}d {Math.round(x / 1000)}k</span>)}
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

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: { label: string; onClick?: () => void; href?: string } }) {
  const btn = action && (action.href
    ? <a href={action.href} className="btn btn-primary mt-3">{action.label}</a>
    : <button className="btn btn-primary mt-3" onClick={action.onClick}>{action.label}</button>);
  return (
    <div className="flex h-full min-h-44 flex-col items-center justify-center gap-1 px-6 text-center text-ink3">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-50"><rect x="6" y="9" width="28" height="22" rx="4" /><path d="M6 17h28M14 24h6" strokeLinecap="round" /></svg>
      <div className="text-[13.5px] font-semibold text-ink2">{title}</div>
      {hint && <div className="max-w-[320px] text-xs">{hint}</div>}
      {btn}
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <svg className="spin" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 3a9 9 0 1 0 9 9" opacity=".9" /></svg>;
}

/** Runs an action with a short, visible "working" state so double clicks are impossible and users get feedback. */
export function useBusy(ms = 380): [boolean, (fn: () => void | Promise<void>) => void] {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setTimeout(async () => { try { await fn(); } finally { setBusy(false); } }, ms);
  };
  return [busy, run];
}

type ConfirmOpts = { title: string; body?: string; confirm?: string; danger?: boolean };
let askFn: (o: ConfirmOpts) => Promise<boolean> = async () => true;
export const ask = (o: ConfirmOpts) => askFn(o);
export function ConfirmHost() {
  const [o, setO] = useState<(ConfirmOpts & { res: (v: boolean) => void }) | null>(null);
  useEffect(() => {
    askFn = (opts) => new Promise((res) => setO({ ...opts, res }));
  }, []);
  useEffect(() => {
    if (!o) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") { o.res(false); setO(null); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [o]);
  if (!o) return null;
  const done = (v: boolean) => { o.res(v); setO(null); };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onMouseDown={() => done(false)}>
      <div className="panel pop w-full max-w-[400px] p-5" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <div className="text-[15px] font-bold">{o.title}</div>
        {o.body && <div className="mt-1.5 text-[13px] leading-relaxed text-ink2">{o.body}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={() => done(false)}>Cancel</button>
          <button autoFocus className={`btn ${o.danger ? "" : "btn-primary"}`} style={o.danger ? { background: "var(--bad-fg)", borderColor: "var(--bad-fg)", color: "white" } : undefined} onClick={() => done(true)}>{o.confirm ?? "Confirm"}</button>
        </div>
      </div>
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

let toastFn: (m: string, o?: { undo?: () => void }) => void = () => {};
export const toast = (m: string, o?: { undo?: () => void }) => toastFn(m, o);
export function Toaster() {
  const [items, setItems] = useState<{ id: number; m: string; n: number; undo?: () => void }[]>([]);
  useEffect(() => {
    toastFn = (m, o) => {
      const id = Math.random();
      const life = o?.undo ? 6000 : 2800;
      setItems((x) => {
        const last = x[x.length - 1];
        // identical message right after itself (e.g. scanning carton after carton): count it instead of stacking
        if (last && last.m === m && !o?.undo) return [...x.slice(0, -1), { ...last, n: last.n + 1 }];
        return [...x.slice(-2), { id, m, n: 1, undo: o?.undo }];
      });
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id && !(i.m === m && i.n > 1 && false))), life);
    };
  }, []);
  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-[80] flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      {items.map((i) => (
        <div key={i.id} className="slidein pointer-events-auto flex items-center gap-3 rounded-xl bg-[#16201b] px-4 py-2 text-[13px] font-medium text-white shadow-lg">
          {i.m}{i.n > 1 && <span className="num rounded bg-white/15 px-1.5 text-[11px] font-bold">×{i.n}</span>}
          {i.undo && <button className="rounded-md bg-white/15 px-2 py-0.5 text-[12px] font-bold hover:bg-white/25" onClick={() => { i.undo!(); setItems((x) => x.filter((y) => y.id !== i.id)); }}>Undo</button>}
        </div>
      ))}
    </div>
  );
}
