"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt } from "@/lib/calc";
import type { Product, Scheme } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import { Thumb, toast } from "@/components/ui";

export default function Products() {
  const products = useStore((s) => s.products);
  const schemes = useStore((s) => s.schemes);
  const upsert = useStore((s) => s.upsertProduct);
  const del = useStore((s) => s.deleteProduct);
  const upsertScheme = useStore((s) => s.upsertScheme);
  const delScheme = useStore((s) => s.deleteScheme);
  const user = useUser();
  const canEdit = user?.role === "sales";
  const [tab, setTab] = useState<"products" | "schemes">("products");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Product | null>(null);
  const [sch, setSch] = useState<Scheme | null>(null);
  const blank: Product = { id: `p${Date.now()}`, code: "", name: "", brand: "", supplier: "Unilever Pakistan", packSize: 12, cartonPrice: 0, costPrice: 0, taxPct: 18, stock: 0, batches: [], damaged: 0, reserved: 0, reorder: 120, leadDays: 5, bin: "A-00", hue: Math.floor(Math.random() * 360) };
  const rows = products.filter((p) => (p.name + p.code + p.brand).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex rounded-xl border border-line bg-panel p-1">
          {(["products", "schemes"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`h-7 rounded-lg px-3 text-[12.5px] font-semibold capitalize ${tab === t ? "bg-accent text-accentink" : "text-ink2"}`}>{t === "products" ? "Products & prices" : "Schemes"}</button>)}
        </div>
        {tab === "products" && <input className="field max-w-xs" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />}
        {canEdit && tab === "products" && <button className="btn btn-primary ml-auto" onClick={() => setEdit(blank)}><Plus size={14} /> Add product</button>}
        {canEdit && tab === "schemes" && <button className="btn btn-primary ml-auto" onClick={() => setSch({ id: `s${Date.now()}`, productId: products[0].id, minCtn: 10, discPct: 2 })}><Plus size={14} /> Add scheme</button>}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        {tab === "products" ? (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Supplier</th><th className="text-right">Pcs / ctn</th><th className="text-right">Carton price</th><th className="text-right">Piece price</th><th className="text-right">Margin</th><th className="text-right">Tax</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2"><div className="flex items-center gap-2.5"><Thumb p={p} size={28} /><div><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · rack {p.bin}</div></div></div></td>
                  <td className="text-ink2">{p.supplier}</td>
                  <td className="num text-right">{p.packSize}</td>
                  <td className="num text-right font-semibold">{fmt(p.cartonPrice)}</td>
                  <td className="num text-right text-ink2">{(p.cartonPrice / p.packSize).toFixed(1)}</td>
                  <td className="num text-right">{p.cartonPrice ? Math.round(((p.cartonPrice - p.costPrice) / p.cartonPrice) * 100) : 0}%</td>
                  <td className="num text-right text-ink2">{p.taxPct}%</td>
                  <td className="space-x-1 pr-4 text-right">{canEdit && <>
                    <button className="btn h-7 px-2" onClick={() => setEdit(p)}><Pencil size={13} /></button>
                    <button className="btn btn-danger h-7 px-2" onClick={() => { del(p.id); toast(`${p.name} deleted`); }}><Trash2 size={13} /></button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Rule</th><th className="text-right">Discount</th><th /></tr></thead>
            <tbody>
              {schemes.map((s) => { const p = products.find((x) => x.id === s.productId); return (
                <tr key={s.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2 font-semibold">{p?.name ?? "—"}</td>
                  <td className="text-ink2">Buy <span className="num font-semibold text-ink">{s.minCtn}+</span> cartons, automatic discount on the order line</td>
                  <td className="num text-right font-semibold">{s.discPct}%</td>
                  <td className="space-x-1 pr-4 text-right">{canEdit && <><button className="btn h-7 px-2" onClick={() => setSch(s)}><Pencil size={13} /></button><button className="btn btn-danger h-7 px-2" onClick={() => delScheme(s.id)}><Trash2 size={13} /></button></>}</td>
                </tr>); })}
            </tbody>
          </table>
        )}
      </div>
      {edit && (
        <MasterForm<Product> title={products.some((p) => p.id === edit.id) ? "Edit product" : "Add product"} initial={edit} onClose={() => setEdit(null)}
          fields={[
            { key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "brand", label: "Brand" },
            { key: "supplier", label: "Supplier" }, { key: "packSize", label: "Pieces per carton", type: "number" }, { key: "cartonPrice", label: "Sale price / carton (Rs.)", type: "number" },
            { key: "costPrice", label: "Cost / carton (Rs.)", type: "number" }, { key: "taxPct", label: "Sales tax %", type: "number" },
            { key: "reorder", label: "Reorder level (pcs)", type: "number" }, { key: "leadDays", label: "Supplier lead time (days)", type: "number" }, { key: "bin", label: "Rack" },
          ]}
          onSave={(v) => { upsert(v); setEdit(null); toast("Product saved"); }} />
      )}
      {sch && (
        <MasterForm<Scheme> title="Scheme" initial={sch} onClose={() => setSch(null)}
          fields={[{ key: "productId", label: "Product", type: "select", options: products.map((p) => [p.id, p.name]) }, { key: "minCtn", label: "Minimum cartons", type: "number" }, { key: "discPct", label: "Discount %", type: "number" }]}
          onSave={(v) => { upsertScheme(v); setSch(null); toast("Scheme saved"); }} />
      )}
    </div>
  );
}
