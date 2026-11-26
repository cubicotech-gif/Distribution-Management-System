"use client";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt, monthsLeft } from "@/lib/calc";
import { Modal, Thumb, toast } from "@/components/ui";
import { Printer } from "lucide-react";
import Barcode from "@/components/Barcode";
import type { SupplierReturn } from "@/lib/types";

export default function SupplierReturns() {
  const products = useStore((s) => s.products);
  const returns = useStore((s) => s.supplierReturns);
  const create = useStore((s) => s.createSupplierReturn);
  const user = useUser();
  const damaged = products.filter((p) => p.damaged > 0);
  const near = products.flatMap((p) => p.batches.filter((b) => monthsLeft(b.expiry) <= 2).map((b) => ({ p, b })));
  const [reason, setReason] = useState("Damaged in transit");
  const [doc, setDoc] = useState<SupplierReturn | null>(null);
  const [veh, setVeh] = useState("");
  const [drv, setDrv] = useState("");
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
        {returns.map((r) => <div key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"><span className="num w-20 text-ink3">{r.folio}</span><span className="flex-1">{products.find((p) => p.id === r.productId)?.name} × {r.qtyPcs} pcs · {r.supplier}</span><span className="num">Rs. {fmt(r.value)}</span><span className="text-xs text-ink3">{ago(r.at)}</span><button className="btn h-7" onClick={() => setDoc(r)}><Printer size={13} /> Debit note and gate pass</button></div>)}
      </div>
      {doc && (
        <Modal open onClose={() => setDoc(null)} title={`${doc.folio} · debit note and gate pass`} width={680}>
          <div className="no-print mb-3 grid grid-cols-2 gap-3"><input className="field" placeholder="Vehicle number (e.g. LEA-4821)" value={veh} onChange={(e) => setVeh(e.target.value)} /><input className="field" placeholder="Driver name" value={drv} onChange={(e) => setDrv(e.target.value)} /></div>
          <div className="printable rounded-xl border-2 border-[#16201b] bg-white p-6 text-[#16201b]">
            <div className="flex items-start justify-between"><div><div className="text-lg font-bold tracking-wide">ZARIE DISTRIBUTORS</div><div className="text-xs font-bold uppercase tracking-widest text-[#4b5a52]">Debit note · gate pass (goods returned to supplier)</div></div><div className="text-right"><div className="num text-[18px] font-bold">{doc.folio}</div><div className="num text-xs text-[#4b5a52]">{new Date(doc.at).toLocaleDateString("en-GB")}</div></div></div>
            <div className="my-4 grid grid-cols-3 gap-3 rounded-lg bg-[#f4f6f3] p-3 text-xs"><div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Supplier</div><b>{doc.supplier}</b></div><div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Vehicle</div><b className="num">{veh || "____________"}</b></div><div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Driver</div><b>{drv || "____________"}</b></div></div>
            <table className="w-full text-xs"><thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1.5">Product</th><th>Reason</th><th className="text-right">Pieces</th><th className="text-right">Value at cost</th></tr></thead>
              <tbody><tr className="border-b border-[#e4e8e2]"><td className="py-1.5">{products.find((p) => p.id === doc.productId)?.name}</td><td>{doc.reason}</td><td className="num text-right">{doc.qtyPcs}</td><td className="num text-right">{fmt(doc.value)}</td></tr></tbody></table>
            <div className="mt-3 flex justify-center"><Barcode value={doc.folio} height={30} unit={1.4} /></div>
            <div className="mt-8 grid grid-cols-3 gap-6 text-[11px] text-[#8a968f]"><span>Warehouse in-charge ____________</span><span>Security guard ____________</span><span>Driver ____________</span></div>
          </div>
          <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setDoc(null)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
        </Modal>
      )}
    </div>
  );
}
