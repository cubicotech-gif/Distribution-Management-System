"use client";
import { Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { accepted, good } from "@/lib/grn";
import type { Grn } from "@/lib/types";
import Barcode from "./Barcode";
import { Modal } from "./ui";

export function GrnDoc({ g, onClose }: { g: Grn; onClose: () => void }) {
  const products = useStore((s) => s.products);
  const po = useStore((s) => s.purchases.find((p) => p.id === g.poId));
  return (
    <Modal open onClose={onClose} title={`Goods received note ${g.folio}`} width={760}>
      <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
        <div className="flex items-start justify-between">
          <div><div className="text-lg font-bold tracking-wide">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">Goods received note · Lahore Depot</div></div>
          <div className="text-right"><div className="num text-base font-bold">{g.folio}</div><div className="num text-xs text-[#4b5a52]">{po?.folio} · {new Date(g.arrivedAt).toLocaleString("en-GB")}</div>
            <div className="mt-1 inline-block rounded border border-[#16201b] px-2 py-0.5 text-[10px] font-bold uppercase">{g.status === "approved" ? "Approved" : g.status === "counted" ? "Counted, awaiting approval" : "Draft count"}</div></div>
        </div>
        <div className="my-4 grid grid-cols-4 gap-3 rounded-lg bg-[#f4f6f3] p-3 text-xs">
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Supplier</div><b>{g.supplier}</b></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Delivery note</div><b className="num">{g.deliveryNote || "—"}</b></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Vehicle</div><b className="num">{g.vehicle || "—"}</b></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Driver</div><b>{g.driver || "—"}</b></div>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1.5">Product</th><th>Batch</th><th>Expiry</th><th className="text-right">Arrived</th><th className="text-right">Rejected</th><th className="text-right">Damaged</th><th className="text-right">Held</th><th className="text-right">Good</th></tr></thead>
          <tbody>{g.lines.map((l, i) => { const p = products.find((x) => x.id === l.productId); return (
            <tr key={i} className="border-b border-[#e4e8e2]"><td className="py-1.5">{p?.name}</td><td className="num">{l.batch || "—"}</td><td className="num">{l.expiry || "—"}</td>
              <td className="num text-right">{l.arrived}</td><td className="num text-right">{l.rejected || ""}</td><td className="num text-right">{l.damaged || ""}</td><td className="num text-right">{l.held || ""}</td><td className="num text-right font-bold">{good(l)}</td></tr>); })}</tbody>
          <tfoot><tr><td colSpan={3} className="pt-2 text-[10px] text-[#8a968f]">Quantities in cartons. {g.lines.some((l) => l.reason) && "Reasons: " + Array.from(new Set(g.lines.filter((l) => l.reason).map((l) => l.reason))).join(", ")}</td>
            <td className="num pt-2 text-right font-bold">{g.lines.reduce((s, l) => s + l.arrived, 0)}</td><td /><td /><td /><td className="num pt-2 text-right font-bold">{g.lines.reduce((s, l) => s + good(l), 0)}</td></tr></tfoot>
        </table>
        <div className="mt-10 grid grid-cols-3 gap-6 text-[11px] text-[#8a968f]"><span>Counted by ({g.by}) ____________</span><span>Driver ____________</span><span>Approved by ____________</span></div>
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}

export function LabelSheet({ g, onClose }: { g: Grn; onClose: () => void }) {
  const products = useStore((s) => s.products);
  const labels = g.lines.filter((l) => accepted(l) > 0 && l.batch).flatMap((l) => {
    const p = products.find((x) => x.id === l.productId)!;
    return Array.from({ length: Math.min(good(l), 6) }, (_, i) => ({ key: `${l.productId}-${i}`, p, l }));
  });
  return (
    <Modal open onClose={onClose} title={`Carton labels · ${g.folio}`} width={760}>
      <div className="text-xs text-ink2">One label per carton (first 6 per product shown). Stick on the carton so the picker can match batch and expiry.</div>
      <div className="printable mt-3 grid grid-cols-3 gap-2 bg-white p-3 text-[#16201b]">
        {labels.map(({ key, p, l }) => (
          <div key={key} className="rounded border border-[#16201b] p-2" style={{ breakInside: "avoid" }}>
            <div className="truncate text-[11px] font-bold">{p.name}</div>
            <div className="mt-0.5 flex justify-between text-[10px]"><span className="num">Batch <b>{l.batch}</b></span><span className="num">Exp <b>{l.expiry}</b></span></div>
            <div className="mt-0.5 flex justify-between text-[10px]"><span className="num">Rack <b>{p.bin || "—"}</b></span><span className="num">{p.packSize} pcs</span></div>
            <div className="mt-1 flex justify-center overflow-hidden"><Barcode value={`${p.code}-${l.batch}`} height={28} unit={0.9} /></div>
            <div className="num mt-0.5 text-center text-[9px]">{p.code}-{l.batch}</div>
          </div>
        ))}
        {labels.length === 0 && <div className="col-span-3 p-6 text-center text-ink3">Nothing to label yet.</div>}
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" disabled={!labels.length} onClick={() => window.print()}><Printer size={14} /> Print labels</button></div>
    </Modal>
  );
}
