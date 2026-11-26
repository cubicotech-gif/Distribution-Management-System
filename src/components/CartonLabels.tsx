"use client";
import { Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Order } from "@/lib/types";
import Barcode from "./Barcode";
import { Modal } from "./ui";

export default function CartonLabels({ o, n, onClose }: { o: Order; n: number; onClose: () => void }) {
  const c = useStore((s) => s.customers.find((x) => x.id === o.customerId));
  return (
    <Modal open onClose={onClose} title={`Customer carton labels · ${n}`} width={720}>
      <div className="text-xs text-ink2">One label per carton or bag going to this customer. The driver and KE match them to the invoice at the shop.</div>
      <div className="printable mt-3 grid grid-cols-2 gap-2 bg-white p-3 text-[#16201b]">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="rounded border-2 border-[#16201b] p-3" style={{ breakInside: "avoid" }}>
            <div className="flex items-start justify-between"><div className="text-[17px] font-bold leading-tight">{c?.name}</div><div className="num rounded bg-[#16201b] px-2 py-0.5 text-[13px] font-bold text-white">{i + 1} / {n}</div></div>
            <div className="mt-0.5 text-[11px] text-[#4b5a52]">{c?.area} · {c?.route}</div>
            <div className="num mt-1 flex justify-between text-[11px]"><span>Challan <b>{o.challanNo}</b></span><span>{o.wave ?? ""}</span></div>
            <div className="mt-1.5 flex justify-center overflow-hidden"><Barcode value={o.challanNo ?? o.folio} height={30} unit={1.3} /></div>
          </div>
        ))}
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print labels</button></div>
    </Modal>
  );
}
