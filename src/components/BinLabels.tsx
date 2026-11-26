"use client";
import { Printer } from "lucide-react";
import { ZONES } from "@/lib/seed";
import type { Bin, Product } from "@/lib/types";
import Barcode from "./Barcode";
import { Modal } from "./ui";

export function BinLabels({ bins, onClose }: { bins: Bin[]; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={`Bin labels · ${bins.length}`} width={760}>
      <div className="text-xs text-ink2">Stick one on each bin face. Scanning it confirms a putaway or a pick.</div>
      <div className="printable mt-3 grid grid-cols-3 gap-2 bg-white p-3 text-[#16201b]">
        {bins.map((b) => (
          <div key={b.code} className="rounded border-2 border-[#16201b] p-2 text-center" style={{ breakInside: "avoid" }}>
            <div className="num text-[26px] font-bold leading-none">{b.code}</div>
            <div className="mt-0.5 text-[9.5px] text-[#4b5a52]">{ZONES[b.zone] ?? "Zone " + b.zone}</div>
            <div className="mt-1.5 flex justify-center overflow-hidden"><Barcode value={b.code} height={30} unit={1.3} /></div>
            <div className="num mt-0.5 text-[9px]">Capacity {b.capacity} ctn</div>
          </div>
        ))}
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print labels</button></div>
    </Modal>
  );
}

export function PutawayLabel({ p, batch, expiry, ctn, bin, onClose }: { p: Product; batch: string; expiry: string; ctn: number; bin: string; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title="Putaway label" width={420}>
      <div className="printable mx-auto w-[330px] rounded border-2 border-[#16201b] bg-white p-3 text-[#16201b]">
        <div className="text-[11px] font-bold">{p.name}</div>
        <div className="num mt-0.5 flex justify-between text-[10px]"><span>Batch <b>{batch}</b></span><span>Exp <b>{expiry}</b></span><span>{Math.round(ctn * 10) / 10} ctn</span></div>
        <div className="mt-2 rounded bg-[#16201b] py-1.5 text-center text-white"><div className="text-[9px] uppercase tracking-widest">Put away in</div><div className="num text-[30px] font-bold leading-none">{bin}</div></div>
        <div className="mt-2 flex justify-center overflow-hidden"><Barcode value={bin} height={34} unit={1.4} /></div>
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}
