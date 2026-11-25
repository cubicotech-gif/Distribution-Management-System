"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { available, fmt } from "@/lib/calc";
import { Meter, Thumb } from "@/components/ui";

function Stock() {
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const [q, setQ] = useState(params.get("q") ?? "");
  const rows = products.filter((p) => (p.name + p.code + p.brand).toLowerCase().includes(q.toLowerCase()));
  const low = products.filter((p) => available(p) < p.reorder).length;
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <input className="field max-w-xs" placeholder="Search product, code or brand…" value={q} onChange={(e) => setQ(e.target.value)} />
        {low > 0 && <span className="chip chip-warn">{low} items below reorder level</span>}
        <span className="ml-auto text-xs text-ink2">Quantities in cartons, pieces in brackets</span>
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Pack</th><th className="text-right">On hand</th><th className="text-right">Reserved</th><th className="text-right">Available</th><th className="w-40">vs reorder level</th><th>Expiry</th><th className="text-right">Carton price</th></tr></thead>
          <tbody>
            {rows.map((p) => {
              const av = available(p);
              const pct = Math.round((av / (p.reorder * 2)) * 100);
              const isLow = av < p.reorder;
              return (
                <tr key={p.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2"><div className="flex items-center gap-2.5"><Thumb p={p} size={28} /><div><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · {p.brand}</div></div></div></td>
                  <td className="num text-ink2">{p.packSize} pcs</td>
                  <td className="num text-right">{fmt(p.stock / p.packSize)} <span className="text-ink3">({fmt(p.stock)})</span></td>
                  <td className="num text-right text-ink2">{fmt(p.reserved / p.packSize)}</td>
                  <td className="num text-right font-semibold">{fmt(av / p.packSize)}</td>
                  <td className="pr-6"><Meter pct={Math.min(100, pct)} tone={isLow ? "warn" : "ok"} /></td>
                  <td className="num text-ink2">{p.expiry}</td>
                  <td className="num text-right">{fmt(p.cartonPrice)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Stock /></Suspense>; }
