"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { available, coverDays, fmt, monthsLeft } from "@/lib/calc";
import { Chips, Modal, Thumb, ViewSwitch, toast, useViewMode } from "@/components/ui";
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
  const [view, setView] = useViewMode("stock", "table");
  const [cat, setCat] = useState("all");
  const [flt, setFlt] = useState<"all" | "low" | "expiry" | "damaged">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [cnt, setCnt] = useState<Product | null>(null);
  const [ctn, setCtn] = useState(0);
  const [loose, setLoose] = useState(0);
  const [reason, setReason] = useState("Routine cycle count");
  const categories = Array.from(new Set(products.map((p) => p.category))).sort();
  const rows = products
    .filter((p) => (p.name + p.code + p.brand + p.bin).toLowerCase().includes(q.toLowerCase()))
    .filter((p) => cat === "all" || p.category === cat)
    .filter((p) => flt === "all" || (flt === "low" ? available(p) < p.reorder : flt === "damaged" ? p.damaged > 0 : p.batches.some((b) => monthsLeft(b.expiry) <= 2)));
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
        <ViewSwitch mode={view} onChange={setView} />
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <Chips value={cat} onChange={setCat} items={[{ k: "all", label: "All categories", count: products.length }, ...categories.map((c) => ({ k: c, label: c, count: products.filter((p) => p.category === c).length }))]} />
        <Chips value={flt} onChange={setFlt} items={[{ k: "all", label: "Everything" }, { k: "low", label: "Running low" }, { k: "expiry", label: "Expiring soon" }, { k: "damaged", label: "Has damaged" }]} />
      </div>
      {view === "tiles" && (
        <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(215px,1fr))] content-start gap-3 overflow-auto">
          {rows.map((p) => { const a = available(p); const m = [...p.batches].sort((x, y) => x.expiry.localeCompare(y.expiry))[0]; return (
            <div key={p.id} className="panel flex flex-col gap-2 p-3.5">
              <div className="flex items-start justify-between"><Thumb p={p} size={44} /><span className={`chip num ${a < p.reorder ? "chip-warn" : "chip-ok"}`}>{fmt(a / p.packSize)} ctn</span></div>
              <div className="text-[13.5px] font-semibold leading-snug">{p.name}</div>
              <div className="num text-[11px] text-ink3">{p.code} · rack {p.bin || "—"}</div>
              <div className="flex flex-wrap gap-1"><span className="chip chip-mute">{p.category}</span>{p.damaged > 0 && <span className="chip chip-bad">{Math.round(p.damaged / p.packSize * 10) / 10} damaged</span>}{m && monthsLeft(m.expiry) <= 2 && <span className="chip chip-warn">exp {m.expiry}</span>}</div>
              <div className="mt-auto flex items-center justify-between text-[11px] text-ink2"><span>On hand <b className="num">{fmt(p.stock / p.packSize)}</b></span><span>Cover <b className="num">{coverDays(p).toFixed(0)}d</b></span></div>
              {canCount && <button className="btn h-7 justify-center" onClick={() => { setCnt(p); setCtn(0); setLoose(0); }}>Count</button>}
            </div>); })}
        </div>
      )}
      {view === "compact" && (
        <div className="panel min-h-0 flex-1 overflow-auto">
          {rows.map((p) => { const a = available(p); return (
            <div key={p.id} className="row-hover flex items-center gap-3 border-b border-line px-3 py-1.5 text-[12.5px]">
              <Thumb p={p} size={22} /><span className="num w-14 text-ink3">{p.bin}</span><span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
              <span className="hidden w-44 truncate text-ink3 md:block">{p.category}</span><span className="num w-16 text-right">{fmt(p.stock / p.packSize)}</span>
              <span className={`chip num w-16 justify-center ${a < p.reorder ? "chip-warn" : "chip-ok"}`}>{fmt(a / p.packSize)}</span>
              {canCount && <button className="btn h-7" onClick={() => { setCnt(p); setCtn(0); setLoose(0); }}>Count</button>}
            </div>); })}
        </div>
      )}
      <div className={`panel min-h-0 flex-1 overflow-auto ${view === "table" ? "" : "hidden"}`}>
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
                    <td className="py-2"><div className="flex items-center gap-2.5"><Thumb p={p} size={28} /><div><div className="font-semibold">{p.name} {p.status === "unlisted" && <span className="chip chip-warn ml-1">Not listed</span>}{p.status === "inactive" && <span className="chip chip-mute ml-1">Inactive</span>}</div><div className="num text-[11px] text-ink3">{p.code} · {p.packSize} pcs/ctn</div></div></div></td>
                    <td className="num font-semibold">{p.bin}{p.batches.some((b) => b.bin === "RCV") && <span className="chip chip-warn ml-1.5 !py-0 text-[9.5px]">dock</span>}</td>
                    <td className="num text-right">{fmt(p.stock / p.packSize)}</td>
                    <td className="num text-right text-ink2">{fmt(p.reserved / p.packSize)}</td>
                    <td className="num text-right"><span className={`chip ${isLow ? "chip-warn" : "chip-ok"}`}>{fmt(av / p.packSize)}</span></td>
                    <td className="num text-right">{p.damaged ? <span className="chip chip-bad">{Math.round((p.damaged / p.packSize) * 10) / 10}</span> : null}{p.quarantine.length ? <span className="chip chip-warn ml-1" title="Held for quality check">{Math.round(p.quarantine.reduce((a, q) => a + q.qty, 0) / p.packSize * 10) / 10} held</span> : null}{!p.damaged && !p.quarantine.length ? <span className="text-ink3">—</span> : null}</td>
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
                          return <div key={b.id} className="rounded-lg border border-line bg-panel px-3 py-1.5"><div className="num text-[12px] font-semibold">{b.no} <span className="font-normal text-ink3">· {b.bin}</span> {i === 0 && <span className="text-[10px] font-bold text-accent">PICKS FIRST</span>}</div><div className="flex items-center gap-2 text-[11px] text-ink2"><span className="num">{fmt(b.qty / p.packSize)} ctn</span><span className={`chip ${m <= 1 ? "chip-bad" : m <= 2 ? "chip-warn" : "chip-mute"}`}>exp {b.expiry} · {m}mo</span></div></div>;
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
