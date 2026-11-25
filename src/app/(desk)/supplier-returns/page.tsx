"use client";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt, monthsLeft } from "@/lib/calc";
import { Thumb, toast } from "@/components/ui";

export default function SupplierReturns() {
  const products = useStore((s) => s.products);
  const returns = useStore((s) => s.supplierReturns);
  const create = useStore((s) => s.createSupplierReturn);
  const user = useUser();
  const damaged = products.filter((p) => p.damaged > 0);
  const near = products.flatMap((p) => p.batches.filter((b) => monthsLeft(b.expiry) <= 2).map((b) => ({ p, b })));
  const [reason, setReason] = useState("Damaged in transit");
  void useState;
  return (
    <div className="mx-auto flex h-full max-w-[1000px] flex-col gap-3">
      <div><h1 className="text-[18px] font-bold">Returns to factory</h1><p className="text-ink2">Damaged stock counted by the warehouse. Send it back with a debit note so the supplier credits the cost.</p></div>
      <div className="panel">
        <div className="th border-b border-line px-4 py-2.5">Damaged stock on hand</div>
        {damaged.length === 0 && <div className="p-4 text-ink3">Nothing to return.</div>}
        {damaged.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
            <Thumb p={p} size={30} /><div className="min-w-0 flex-1"><div className="font-semibold">{p.name}</div><div className="text-xs text-ink2">{p.supplier}</div></div>
            <span className="chip chip-bad num">{p.damaged} pcs · Rs. {fmt((p.costPrice / p.packSize) * p.damaged)}</span>
            <select className="field w-44" value={reason} onChange={(e) => setReason(e.target.value)}>{["Damaged in transit", "Manufacturing defect", "Customer return, damaged"].map((r) => <option key={r}>{r}</option>)}</select>
            <button className="btn btn-primary" onClick={() => { create(p.id, p.damaged, reason, user?.initials ?? "—"); toast("Debit note created"); }}>Return all</button>
          </div>
        ))}
      </div>
      <div className="panel">
        <div className="th border-b border-line px-4 py-2.5">Expiring soon: ask supplier for replacement or credit</div>
        {near.map(({ p, b }) => <div key={b.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"><span className="flex-1">{p.name} <span className="num text-ink3">{b.no}</span></span><span className="chip chip-warn num">{b.expiry} · {Math.floor(b.qty / p.packSize)} ctn</span></div>)}
        {near.length === 0 && <div className="p-4 text-ink3">None</div>}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <div className="th border-b border-line px-4 py-2.5">Debit notes sent</div>
        {returns.length === 0 && <div className="p-4 text-ink3">None yet</div>}
        {returns.map((r) => <div key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"><span className="num w-20 text-ink3">{r.folio}</span><span className="flex-1">{products.find((p) => p.id === r.productId)?.name} × {r.qtyPcs} pcs · {r.supplier}</span><span className="num">Rs. {fmt(r.value)}</span><span className="text-xs text-ink3">{ago(r.at)}</span></div>)}
      </div>
    </div>
  );
}
