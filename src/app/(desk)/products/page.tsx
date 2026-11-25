"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt } from "@/lib/calc";
import type { Product } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import { Thumb, toast } from "@/components/ui";

export default function Products() {
  const products = useStore((s) => s.products);
  const upsert = useStore((s) => s.upsertProduct);
  const del = useStore((s) => s.deleteProduct);
  const user = useUser();
  const canEdit = user?.role === "admin";
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Product | null>(null);
  const blank: Product = { id: `p${Date.now()}`, code: "", name: "", brand: "", packSize: 12, cartonPrice: 0, taxPct: 18, stock: 0, reserved: 0, reorder: 120, hue: Math.floor(Math.random() * 360), expiry: "2027-12" };
  const rows = products.filter((p) => (p.name + p.code + p.brand).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <input className="field max-w-xs" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        {canEdit ? <button className="btn btn-primary ml-auto" onClick={() => setEdit(blank)}><Plus size={14} /> Add product</button> : <span className="ml-auto text-xs text-ink3">Only Admin can edit products and prices</span>}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Brand</th><th className="text-right">Pcs / carton</th><th className="text-right">Carton price</th><th className="text-right">Piece price</th><th className="text-right">Tax</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="row-hover border-t border-line">
                <td className="px-4 py-2"><div className="flex items-center gap-2.5"><Thumb p={p} size={28} /><div><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code}</div></div></div></td>
                <td className="text-ink2">{p.brand}</td>
                <td className="num text-right">{p.packSize}</td>
                <td className="num text-right font-semibold">{fmt(p.cartonPrice)}</td>
                <td className="num text-right text-ink2">{(p.cartonPrice / p.packSize).toFixed(1)}</td>
                <td className="num text-right text-ink2">{p.taxPct}%</td>
                <td className="space-x-1 pr-4 text-right">
                  {canEdit && <>
                    <button className="btn h-7 px-2" onClick={() => setEdit(p)}><Pencil size={13} /></button>
                    <button className="btn btn-danger h-7 px-2" onClick={() => { del(p.id); toast(`${p.name} deleted`); }}><Trash2 size={13} /></button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <MasterForm<Product> title={products.some((p) => p.id === edit.id) ? "Edit product" : "Add product"} initial={edit} onClose={() => setEdit(null)}
          fields={[
            { key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "brand", label: "Brand" },
            { key: "packSize", label: "Pieces per carton", type: "number" }, { key: "cartonPrice", label: "Carton price (Rs.)", type: "number" },
            { key: "taxPct", label: "Sales tax %", type: "number" }, { key: "reorder", label: "Reorder level (pcs)", type: "number" }, { key: "expiry", label: "Expiry (YYYY-MM)" },
          ]}
          onSave={(v) => { upsert(v); setEdit(null); toast("Product saved"); }} />
      )}
    </div>
  );
}
