"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { available, coverDays, fmt, velocity } from "@/lib/calc";
import { Thumb } from "@/components/ui";
import NewPO from "@/components/NewPO";

export default function Planner() {
  const products = useStore((s) => s.products).filter((p) => p.status === "active");
  const purchases = useStore((s) => s.purchases);
  const [po, setPo] = useState<Record<string, number> | null>(null);
  const onOrder = (id: string) => purchases.filter((p) => p.status === "ordered").flatMap((p) => p.lines).filter((l) => l.productId === id).reduce((s, l) => s + l.ordered, 0);
  const rows = products.map((p) => {
    const cover = coverDays(p);
    const incoming = onOrder(p.id);
    const target = (p.leadDays + 14) * velocity(p); // lead time + 2 weeks safety
    const sugg = Math.max(0, Math.ceil((target - available(p) - incoming * p.packSize) / p.packSize));
    const status = cover < p.leadDays ? "bad" : cover < p.leadDays + 3 ? "warn" : "ok";
    return { p, cover, incoming, sugg, status };
  }).sort((a, b) => a.cover - b.cover);
  const bySupplier = rows.filter((r) => r.sugg > 0).reduce<Record<string, Record<string, number>>>((m, r) => { (m[r.p.supplier] ??= {})[r.p.id] = r.sugg; return m; }, {});

  return (
    <div className="flex h-full flex-col gap-3">
      <div><h1 className="text-[18px] font-bold">Reorder planner</h1><p className="text-ink2">Days of cover = available stock ÷ daily sales. Suggested quantity covers the supplier&apos;s lead time plus two weeks, minus what is already on the way.</p></div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(bySupplier).map(([s, lines]) => <button key={s} className="btn btn-primary" onClick={() => setPo(lines)}>Create PO for {s} ({Object.keys(lines).length} items)</button>)}
        {Object.keys(bySupplier).length === 0 && <span className="chip chip-ok">All items covered</span>}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Supplier</th><th className="text-right">Available</th><th className="text-right">Daily sales</th><th className="text-right">Cover</th><th className="text-right">Lead time</th><th className="text-right">On the way</th><th className="text-right">Suggest (ctn)</th></tr></thead>
          <tbody>
            {rows.map(({ p, cover, incoming, sugg, status }) => (
              <tr key={p.id} className="row-hover border-t border-line">
                <td className="px-4 py-2"><div className="flex items-center gap-2.5"><Thumb p={p} size={26} /><span className="font-semibold">{p.name}</span></div></td>
                <td className="text-ink2">{p.supplier}</td>
                <td className="num text-right">{fmt(available(p) / p.packSize)} ctn</td>
                <td className="num text-right text-ink2">{(velocity(p) / p.packSize).toFixed(1)} ctn</td>
                <td className="text-right"><span className={`chip num chip-${status === "ok" ? "ok" : status}`}>{cover.toFixed(0)} days</span></td>
                <td className="num text-right text-ink2">{p.leadDays}d</td>
                <td className="num text-right">{incoming ? `${incoming} ctn` : "—"}</td>
                <td className="num text-right font-bold">{sugg || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {po && <NewPO preset={po} onClose={() => setPo(null)} />}
    </div>
  );
}
