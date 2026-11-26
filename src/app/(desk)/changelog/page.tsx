"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ago } from "@/lib/calc";
import { Chips, Empty } from "@/components/ui";

export default function ChangeLog() {
  const log = useStore((s) => s.changeLog);
  const priceHistory = useStore((s) => s.priceHistory);
  const products = useStore((s) => s.products);
  const [q, setQ] = useState("");
  const [ent, setEnt] = useState("all");
  const all = [
    ...log,
    ...priceHistory.map((h) => ({ id: h.id, at: h.at, by: h.by, entity: "price" as const, text: `${products.find((p) => p.id === h.productId)?.name}: ${h.oldPrice ? h.oldPrice.toLocaleString() : "listed"} → ${h.newPrice.toLocaleString()}${h.status === "pending" ? " (awaiting owner)" : ""}` })),
  ].sort((a, b) => b.at - a.at);
  const ents = ["all", ...Array.from(new Set(all.map((x) => x.entity)))];
  const rows = all.filter((x) => (ent === "all" || x.entity === ent) && x.text.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto flex h-full max-w-[900px] flex-col gap-3">
      <div><h1 className="text-[18px] font-bold">Change log</h1><p className="text-ink2">Every change to products, prices, customers, routes, suppliers and schemes, with who made it.</p></div>
      <div className="flex flex-wrap items-center gap-3"><input className="field max-w-xs" placeholder="Search changes…" value={q} onChange={(e) => setQ(e.target.value)} /><Chips value={ent} onChange={setEnt} items={ents.map((e) => ({ k: e, label: e === "all" ? "Everything" : e, count: e === "all" ? all.length : all.filter((x) => x.entity === e).length }))} /></div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        {rows.length === 0 && <Empty title="No changes yet" hint="Edit a product, customer or route to see it here" />}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
            <span className="chip chip-mute w-24 justify-center capitalize">{r.entity}</span><span className="flex-1">{r.text}</span>
            <span className="num text-xs text-ink2">{r.by}</span><span className="w-20 text-right text-xs text-ink3">{ago(r.at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
