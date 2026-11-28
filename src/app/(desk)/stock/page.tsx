"use client";
import { Suspense, useState } from "react";
import { can } from "@/lib/perm";
import { useRouter, useSearchParams } from "next/navigation";
import LedgerTab from "@/components/stock/LedgerTab";
import ExpiryTab from "@/components/stock/ExpiryTab";
import TraceTab from "@/components/stock/TraceTab";
import AgeingTab from "@/components/stock/AgeingTab";
import { statusSplit } from "@/lib/stockctl";
import { ChevronRight } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { available, coverDays, fmt, monthsLeft } from "@/lib/calc";
import { Chips, Thumb, ViewSwitch, toast, useViewMode } from "@/components/ui";
import type { Product } from "@/lib/types";

function StockTab({ onLedger, onTrace }: { onLedger: (productId: string) => void; onTrace: (productId: string, batch: string) => void }) {
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const adjustments = useStore((s) => s.adjustments);
  const startCount = useStore((s) => s.startCount);
  const router = useRouter();
  const user = useUser();
  const role = user?.role;
  const canCount = can(user, "count");
  const showCost = role === "admin" || role === "purchasing";
  const [q, setQ] = useState(params.get("q") ?? "");
  const [view, setView] = useViewMode("stock", "table");
  const [cat, setCat] = useState("all");
  const [flt, setFlt] = useState<"all" | "low" | "expiry" | "damaged">("all");
  const [open, setOpen] = useState<string | null>(null);
  const goCount = (id: string) => { startCount([id], "cycle", user?.initials ?? "—"); router.push("/counts?tab=sessions"); };
  const categories = Array.from(new Set(products.map((p) => p.category))).sort();
  const rows = products
    .filter((p) => (p.name + p.code + p.brand + p.bin).toLowerCase().includes(q.toLowerCase()))
    .filter((p) => cat === "all" || p.category === cat)
    .filter((p) => flt === "all" || (flt === "low" ? available(p) < p.reorder : flt === "damaged" ? p.damaged > 0 : p.batches.some((b) => monthsLeft(b.expiry) <= 2)));
  const low = products.filter((p) => available(p) < p.reorder).length;
  const near = products.reduce((s, p) => s + p.batches.filter((b) => monthsLeft(b.expiry) <= 2).length, 0);
  const tot = (() => { const t = { available: 0, reserved: 0, held: 0, damaged: 0, expired: 0 }; for (const p of products) { const x = statusSplit(p); t.available += x.available / p.packSize; t.reserved += x.reserved / p.packSize; t.held += x.held / p.packSize; t.damaged += x.damaged / p.packSize; t.expired += x.expired / p.packSize; } return t; })();
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
      <div className="grid grid-cols-5 gap-3">
        {([["Available to sell", tot.available, "chip-ok"], ["Reserved for orders", tot.reserved, "chip-info"], ["Quality hold", tot.held, "chip-warn"], ["Damaged", tot.damaged, "chip-bad"], ["Expired (still on shelf)", tot.expired, "chip-bad"]] as const).map(([l, v, c]) => (
          <div key={l} className="panel flex items-center justify-between px-3.5 py-2.5"><span className="text-xs text-ink2">{l}</span><span className={`chip ${c} num`}>{fmt(v)} ctn</span></div>
        ))}
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
              {canCount && <button className="btn h-7 justify-center" onClick={() => goCount(p.id)}>Count</button>}
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
              {canCount && <button className="btn h-7" onClick={() => goCount(p.id)}>Count</button>}
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
                    <td className="num text-right">{p.damaged ? <span className="chip chip-bad">{Math.round((p.damaged / p.packSize) * 10) / 10}</span> : null}{p.quarantine.length ? <span className="chip chip-warn ml-1" title="Held for quality check">{Math.round(p.quarantine.reduce((a, q) => a + q.qty, 0) / p.packSize * 10) / 10} held</span> : null}{statusSplit(p).expired > 0 ? <span className="chip chip-bad ml-1">expired</span> : null}{!p.damaged && !p.quarantine.length && statusSplit(p).expired === 0 ? <span className="text-ink3">—</span> : null}</td>
                    <td className="num text-right text-ink2">{d.toFixed(0)}d</td>
                    {showCost && <td className="num text-right text-ink2">{fmt(p.costPrice)}</td>}
                    {showCost && <td className="num text-right">{fmt((p.stock / p.packSize) * p.costPrice)}</td>}
                    {canCount && <td className="pr-3 text-right" onClick={(e) => e.stopPropagation()}><button className="btn h-7" onClick={() => goCount(p.id)}>Count</button></td>}
                  </tr>
                  {open === p.id && (
                    <tr key={p.id + "b"} className="bg-panel2"><td /><td colSpan={9} className="px-2 py-2.5">
                      <div className="flex flex-wrap gap-2">
                        <div className="flex w-full items-center justify-between"><span className="th">Batches</span><button className="btn h-7" onClick={() => onLedger(p.id)}>Movement ledger</button></div>
                        {[...p.batches].sort((a, b) => a.expiry.localeCompare(b.expiry)).map((b, i) => {
                          const m = monthsLeft(b.expiry);
                          return <button key={b.id} onClick={() => onTrace(p.id, b.no)} title="Trace this batch" className="rounded-lg border border-line bg-panel px-3 py-1.5 text-left hover:border-accent"><div className="num text-[12px] font-semibold">{b.no} <span className="font-normal text-ink3">· {b.bin}</span> {i === 0 && <span className="text-[10px] font-bold text-accent">PICKS FIRST</span>}</div><div className="flex items-center gap-2 text-[11px] text-ink2"><span className="num">{fmt(b.qty / p.packSize)} ctn</span><span className={`chip ${m <= 1 ? "chip-bad" : m <= 2 ? "chip-warn" : "chip-mute"}`}>exp {b.expiry} · {m}mo</span></div></button>;
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
    </div>
  );
}
type Tab = "stock" | "ledger" | "expiry" | "trace" | "ageing";
function Shell() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "stock");
  const [ledgerFor, setLedgerFor] = useState<string | undefined>();
  const [trace, setTrace] = useState<{ productId: string; batch: string } | undefined>(params.get("product") && params.get("batch") ? { productId: params.get("product")!, batch: params.get("batch")! } : undefined);
  const tabs: [Tab, string][] = [["stock", "Stock"], ["ledger", "Movement ledger"], ["expiry", "Expiry"], ["trace", "Trace & recall"], ["ageing", "Ageing"]];
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex rounded-xl border border-line bg-panel p-1 self-start">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`h-7 rounded-lg px-3 text-[12.5px] font-semibold ${tab === k ? "bg-accent text-accentink" : "text-ink2"}`}>{l}</button>)}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "stock" && <StockTab onLedger={(id) => { setLedgerFor(id); setTab("ledger"); }} onTrace={(id, b) => { setTrace({ productId: id, batch: b }); setTab("trace"); }} />}
        {tab === "ledger" && <LedgerTab key={ledgerFor ?? "all"} initialProduct={ledgerFor} />}
        {tab === "expiry" && <ExpiryTab onTrace={(id, b) => { setTrace({ productId: id, batch: b }); setTab("trace"); }} />}
        {tab === "trace" && <TraceTab key={trace ? `${trace.productId}|${trace.batch}` : "none"} start={trace} />}
        {tab === "ageing" && <AgeingTab />}
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Shell /></Suspense>; }
