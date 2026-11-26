"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/calc";
import type { PriceList } from "@/lib/types";
import { Modal, Thumb, toast } from "./ui";

export default function PriceListEditor({ list, onClose }: { list: PriceList; onClose: () => void }) {
  const products = useStore((s) => s.products).filter((p) => p.status === "active");
  const save = useStore((s) => s.upsertPriceList);
  const customers = useStore((s) => s.customers);
  const [name, setName] = useState(list.name);
  const [pct, setPct] = useState(list.adjustPct);
  const [ov, setOv] = useState<Record<string, number>>({ ...list.overrides });
  const used = customers.filter((c) => c.priceListId === list.id).length;
  return (
    <Modal open onClose={onClose} title={list.name ? `Price list · ${list.name}` : "New price list"} width={640}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><div className="th mb-1">Name</div><input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wholesale" /></div>
          <div><div className="th mb-1">Adjust standard prices by %</div><input className="field num font-semibold" type="number" step="0.5" value={pct} onChange={(e) => setPct(+e.target.value)} /></div>
        </div>
        <div className="text-xs text-ink2">{used} customer{used === 1 ? "" : "s"} use this list. Type a price in the last column to override one product; leave it empty to follow the percentage.</div>
        <div className="max-h-[42vh] overflow-auto rounded-xl border border-line">
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-3 py-2">Product</th><th className="text-right">Standard</th><th className="text-right">List price</th><th className="text-right">Override</th></tr></thead>
            <tbody>
              {products.map((p) => {
                const calc = Math.round(p.cartonPrice * (1 + pct / 100));
                const o = ov[p.id];
                return (
                  <tr key={p.id} className="border-t border-line">
                    <td className="px-3 py-1.5"><div className="flex items-center gap-2"><Thumb p={p} size={22} />{p.name}</div></td>
                    <td className="num text-right text-ink2">{fmt(p.cartonPrice)}</td>
                    <td className="num text-right font-semibold">{fmt(o ?? calc)}{(o ?? calc) < p.costPrice && <span className="ml-1 text-[10.5px] text-[var(--bad-fg)]">below cost</span>}</td>
                    <td className="w-28 text-right"><input className="cell num" type="number" placeholder="—" value={o ?? ""} onChange={(e) => { const v = e.target.value; const n = { ...ov }; if (v === "") delete n[p.id]; else n[p.id] = +v; setOv(n); }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => { save({ ...list, name: name.trim(), adjustPct: pct, overrides: ov }); toast("Price list saved"); onClose(); }}>Save</button>
        </div>
      </div>
    </Modal>
  );
}
