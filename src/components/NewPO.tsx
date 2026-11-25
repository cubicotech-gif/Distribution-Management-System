"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Modal, Thumb, toast } from "./ui";

export default function NewPO({ onClose, preset }: { onClose: () => void; preset?: Record<string, number> }) {
  const products = useStore((s) => s.products);
  const createPO = useStore((s) => s.createPO);
  const [supplier, setSupplier] = useState(() => products.find((p) => preset && preset[p.id])?.supplier ?? "Unilever Pakistan");
  const [qty, setQty] = useState<Record<string, number>>(() => preset ?? {});
  const lines = Object.entries(qty).filter(([, n]) => n > 0).map(([productId, ordered]) => ({ productId, ordered }));
  const suppliers = Array.from(new Set(products.map((p) => p.supplier)));
  return (
    <Modal open onClose={onClose} title="New factory purchase order" width={560}>
      <div className="space-y-3">
        <select className="field" value={supplier} onChange={(e) => { setSupplier(e.target.value); setQty({}); }}>{suppliers.map((s) => <option key={s}>{s}</option>)}</select>
        <div className="rounded-xl border border-line">
          {products.filter((p) => p.supplier === supplier).map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-0">
              <Thumb p={p} size={22} /><span className="flex-1">{p.name}</span>
              <span className="num w-24 text-right text-xs text-ink3">{Math.floor((p.stock - p.reserved) / p.packSize)} ctn left</span>
              <input className="cell num w-20 !border-line2 font-semibold" type="number" min={0} value={qty[p.id] ?? 0} onChange={(e) => setQty({ ...qty, [p.id]: Math.max(0, +e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!lines.length} onClick={() => { createPO(supplier, lines); onClose(); toast("Purchase order sent to factory"); }}>Send to factory</button></div>
      </div>
    </Modal>
  );
}
