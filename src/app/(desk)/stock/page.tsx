"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { available, coverDays, fmt, monthsLeft } from "@/lib/calc";
import { Modal, Thumb, toast } from "@/components/ui";
import type { Product } from "@/lib/types";

function Stock() {
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const adjustments = useStore((s) => s.adjustments);
  const count = useStore((s) => s.cycleCount);
  const user = useUser();
  const role = user?.role;
  const canCount = role === "warehouse";
  const showCost = role === "admin" || role === "purchasing";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState<string | null>(null);
  const [cnt, setCnt] = useState<Product | null>(null);
  const [ctn, setCtn] = useState(0);
  const [loose, setLoose] = useState(0);
  const [reason, setReason] = useState("Routine cycle count");
  const rows = products.filter((p) => (p.name + p.code + p.brand + p.bin).toLowerCase().includes(q.toLowerCase()));
  const low = products.filter((p) => available(p) < p.reorder).length;
  const near = products.reduce((s, p) => s + p.batches.filter((b) => monthsLeft(b.expiry) <= 2).length, 0);
  const pend = adjustments.filter((a) => a.status === "pending").length;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input className="field max-w-xs" placeholder="Search product, code, rack…" value={q} onChange={(e) => setQ(e.target.value)} />
        {low > 0 && <span className="chip chip-warn">{low} below reorder level</span>}
        {near > 0 && <span className="chip chip-bad">{near} batches expire within 2 months</span>}
        {pend > 0 && <span className="chip chip-info">{pend} stock count waiting for owner</span>}
        <span className="ml-auto text-xs text-ink2">Cartons · click a row to see batches</span>
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 z-10 bg-panel text-left"><th className="w-6" /><th className="py-2.5">Product</th><th>Rack</th><th className="text-right">On hand</th><th className="text-right">Reserved</th><th className="text-right">Available</th><th className="text-right">Damaged</th><th className="text-right">Cover</th>{showCost && <th className="text-right">Cost / ctn</th>}{showCost && <th className="text-right">Value</th>}{canCount && <th />}</tr></thead>
          <tbody>
            {rows.map((p) => {
              const av = available(p);
              const isLow = av < p.reorder;
              const d = coverDays(p);
              return (
                <>
                  <tr key={p.id} className="row-hover cursor-pointer border-t border-line" onClick={() => setOpen(open === p.id ? null : p.id)}>
                    <td className="pl-3"><ChevronRight size={14} className={`text-ink3 transition ${open === p.id ? "rotate-90" : ""}`} /></td>
                    <td className="py-2"><div className="flex items-center gap-2.5"><Thumb p={p} size={28} /><div><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · {p.packSize} pcs/ctn</div></div></div></td>
                    <td className="num font-semibold">{p.bin}</td>
                    <td className="num text-right">{fmt(p.stock / p.packSize)}</td>
                    <td className="num text-right text-ink2">{fmt(p.reserved / p.packSize)}</td>
                    <td className="num text-right"><span className={`chip ${isLow ? "chip-warn" : "chip-ok"}`}>{fmt(av / p.packSize)}</span></td>
                    <td className="num text-right">{p.damaged ? <span className="chip chip-bad">{Math.round((p.damaged / p.packSize) * 10) / 10}</span> : <span className="text-ink3">—</span>}</td>
                    <td className="num text-right text-ink2">{d.toFixed(0)}d</td>
                    {showCost && <td className="num text-right text-ink2">{fmt(p.costPrice)}</td>}
                    {showCost && <td className="num text-right">{fmt((p.stock / p.packSize) * p.costPrice)}</td>}
                    {canCount && <td className="pr-3 text-right" onClick={(e) => e.stopPropagation()}><button className="btn h-7" onClick={() => { setCnt(p); setCtn(0); setLoose(0); }}>Count</button></td>}
                  </tr>
                  {open === p.id && (
                    <tr key={p.id + "b"} className="bg-panel2"><td /><td colSpan={9} className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        {[...p.batches].sort((a, b) => a.expiry.localeCompare(b.expiry)).map((b, i) => {
                          const m = monthsLeft(b.expiry);
                          return <div key={b.id} className="rounded-lg border border-line bg-panel px-3 py-1.5"><div className="num text-[12px] font-semibold">{b.no} {i === 0 && <span className="text-[10px] font-bold text-accent">PICKS FIRST</span>}</div><div className="flex items-center gap-2 text-[11px] text-ink2"><span className="num">{fmt(b.qty / p.packSize)} ctn</span><span className={`chip ${m <= 1 ? "chip-bad" : m <= 2 ? "chip-warn" : "chip-mute"}`}>exp {b.expiry} · {m}mo</span></div></div>;
                        })}
                      </div>
                    </td></tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      {cnt && (
        <Modal open onClose={() => setCnt(null)} title={`Blind count · ${cnt.name}`} width={440}>
          <div className="space-y-3">
            <div className="text-xs text-ink2">Rack <b className="num">{cnt.bin}</b>. Count what is physically there. The system quantity is hidden so the count stays honest.</div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="th mb-1">Full cartons</div><input className="field num text-[16px] font-semibold" type="number" min={0} autoFocus value={ctn} onChange={(e) => setCtn(Math.max(0, +e.target.value))} /></div>
              <div><div className="th mb-1">Loose pieces</div><input className="field num text-[16px] font-semibold" type="number" min={0} value={loose} onChange={(e) => setLoose(Math.max(0, +e.target.value))} /></div>
            </div>
            <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>{["Routine cycle count", "Suspected shortage", "Found extra stock", "After damage check"].map((r) => <option key={r}>{r}</option>)}</select>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setCnt(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                const counted = ctn * cnt.packSize + loose;
                const diff = counted - cnt.stock;
                count(cnt.id, counted, reason, user?.initials ?? "—");
                toast(diff === 0 ? "Count matches the system" : `Variance ${diff > 0 ? "+" : ""}${diff} pcs recorded`);
                setCnt(null);
              }}>Submit count</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default function Page() { return <Suspense><Stock /></Suspense>; }
