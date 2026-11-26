"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Modal, Thumb, toast } from "./ui";
import type { NewItem } from "@/lib/store";

export default function NewPO({ onClose, preset }: { onClose: () => void; preset?: Record<string, number> }) {
  const products = useStore((s) => s.products).filter((p) => p.status !== "inactive");
  const createPO = useStore((s) => s.createPO);
  const [supplier, setSupplier] = useState(() => products.find((p) => preset && preset[p.id])?.supplier ?? "Unilever Pakistan");
  const [qty, setQty] = useState<Record<string, number>>(() => preset ?? {});
  const suppliersAll = useStore((s) => s.suppliers);
  const iso = (d: number) => new Date(d).toISOString().slice(0, 10);
  const lead = suppliersAll.find((x) => x.name === supplier)?.leadDays ?? 5;
  const [exp, setExp] = useState<string | null>(null);
  const expected = exp ?? iso(Date.now() + lead * 86400000);
  const [items, setItems] = useState<NewItem[]>([]);
  const [ni, setNi] = useState<NewItem>({ name: "", brand: "", packSize: 12, costPrice: 0, ordered: 10 });
  const lines = Object.entries(qty).filter(([, n]) => n > 0).map(([productId, ordered]) => ({ productId, ordered }));
  const suppliers = Array.from(new Set(products.map((p) => p.supplier)));
  return (
    <Modal open onClose={onClose} title="New factory purchase order" width={560}>
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_170px] gap-3">
          <select className="field" value={supplier} onChange={(e) => { setSupplier(e.target.value); setQty({}); setExp(null); }}>{suppliers.map((s) => <option key={s}>{s}</option>)}</select>
          <label className="block"><input className={`field ${expected < iso(Date.now()) ? "field-err" : ""}`} type="date" value={expected} onChange={(e) => setExp(e.target.value)} title="Expected delivery date" />{expected < iso(Date.now()) && <div className="mt-1 text-[11px] font-semibold text-[var(--bad-fg)]">Date is in the past</div>}</label>
        </div>
        <div className="text-[11px] text-ink3">Expected delivery date. Defaults to today plus the supplier&apos;s lead time ({lead} days).</div>
        <div className="rounded-xl border border-line">
          {products.filter((p) => p.supplier === supplier).map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-0">
              <Thumb p={p} size={22} /><span className="flex-1">{p.name}</span>
              <span className="num w-24 text-right text-xs text-ink3">{Math.floor((p.stock - p.reserved) / p.packSize)} ctn left</span>
              <input className="cell num w-20 !border-line2 font-semibold" type="number" min={0} value={qty[p.id] ?? 0} onChange={(e) => setQty({ ...qty, [p.id]: Math.max(0, +e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-dashed border-line2 bg-panel2 p-3">
          <div className="mb-2 text-xs font-semibold text-ink2">New item not in the catalog yet</div>
          <div className="grid grid-cols-[1fr_70px_90px_70px_auto] gap-2">
            <input className="field" placeholder="Product name" value={ni.name} onChange={(e) => setNi({ ...ni, name: e.target.value })} />
            <input className="field num" type="number" title="Pieces per carton" value={ni.packSize} onChange={(e) => setNi({ ...ni, packSize: +e.target.value })} />
            <input className="field num" type="number" title="Cost per carton" placeholder="Cost/ctn" value={ni.costPrice || ""} onChange={(e) => setNi({ ...ni, costPrice: +e.target.value })} />
            <input className="field num" type="number" title="Cartons to order" value={ni.ordered} onChange={(e) => setNi({ ...ni, ordered: +e.target.value })} />
            <button className="btn" disabled={!ni.name || ni.ordered <= 0} onClick={() => { setItems([...items, ni]); setNi({ name: "", brand: "", packSize: 12, costPrice: 0, ordered: 10 }); }}>Add</button>
          </div>
          {items.map((it, i) => <div key={i} className="mt-2 flex items-center justify-between text-xs"><span>{it.name} · {it.packSize}/ctn · {it.ordered} ctn</span><span className="chip chip-warn">Back office will list and price it</span></div>)}
        </div>
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={(!lines.length && !items.length) || expected < iso(Date.now())} onClick={() => { createPO(supplier, lines, items, Date.parse(expected + "T12:00:00")); onClose(); toast(items.length ? "PO sent. New items are waiting for back office to list" : "Purchase order sent to factory"); }}>Send to factory</button></div>
      </div>
    </Modal>
  );
}
