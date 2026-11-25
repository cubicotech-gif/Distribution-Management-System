"use client";
import { Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { Modal } from "./ui";
import type { Order } from "@/lib/types";

export default function Challan({ o, onClose }: { o: Order; onClose: () => void }) {
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const c = customers.find((x) => x.id === o.customerId)!;
  return (
    <Modal open onClose={onClose} title={`Delivery challan ${o.challanNo}`} width={640}>
      <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
        <div className="flex justify-between"><div><div className="text-lg font-bold">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">Delivery challan (no prices)</div></div><div className="text-right"><div className="num font-bold">{o.challanNo}</div><div className="num text-xs text-[#4b5a52]">{o.folio}</div></div></div>
        <div className="my-3 rounded-lg bg-[#f4f6f3] p-3 text-xs"><b>{c.name}</b> · {c.area} · {c.phone}</div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1.5">Product</th><th>Batch (expiry)</th><th className="text-right">Qty</th></tr></thead>
          <tbody>{o.lines.map((l, i) => { const p = products.find((x) => x.id === l.productId)!; const al = (o.allocation ?? []).filter((a) => a.i === i); return (
            <tr key={i} className="border-b border-[#e4e8e2]"><td className="py-1.5">{p.name}</td><td className="num">{al.length ? al.map((a) => `${a.batch} (${a.expiry})`).join(", ") : "—"}</td><td className="num text-right">{l.qty} {l.unit.toUpperCase()}</td></tr>); })}</tbody>
        </table>
        <div className="mt-8 flex justify-between text-[11px] text-[#8a968f]"><span>Picked by ____________</span><span>Checked by ____________</span></div>
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}
