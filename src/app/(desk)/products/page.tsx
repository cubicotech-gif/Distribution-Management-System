"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload, Percent, EyeOff, Eye } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt } from "@/lib/calc";
import type { Product, Scheme } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import { BulkPriceModal, ImportModal, exportProducts } from "@/components/ProductTools";
import { Empty, Thumb, toast } from "@/components/ui";

type Tab = "products" | "unlisted" | "schemes" | "history";

function Products() {
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const purchases = useStore((s) => s.purchases);
  const schemes = useStore((s) => s.schemes);
  const history = useStore((s) => s.priceHistory);
  const upsert = useStore((s) => s.upsertProduct);
  const del = useStore((s) => s.deleteProduct);
  const setStatus = useStore((s) => s.setProductStatus);
  const upsertScheme = useStore((s) => s.upsertScheme);
  const delScheme = useStore((s) => s.deleteScheme);
  const user = useUser();
  const by = user?.initials ?? "—";
  const canEdit = user?.role === "sales";
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "products");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "active" | "inactive">("all");
  const [edit, setEdit] = useState<Product | null>(null);
  const [sch, setSch] = useState<Scheme | null>(null);
  const [imp, setImp] = useState(false);
  const [bulk, setBulk] = useState(false);
  const unlisted = products.filter((p) => p.status === "unlisted");
  const pendingFor = (id: string) => history.find((h) => h.productId === id && h.status === "pending");
  const used = (p: Product) => p.stock > 0 || p.damaged > 0 || orders.some((o) => o.lines.some((l) => l.productId === p.id)) || purchases.some((o) => o.lines.some((l) => l.productId === p.id));
  const blank: Product = { id: `p${Date.now()}`, status: "active", code: "", name: "", brand: "", supplier: "Unilever Pakistan", packSize: 12, cartonPrice: 0, costPrice: 0, taxPct: 18, stock: 0, batches: [], damaged: 0, reserved: 0, reorder: 120, leadDays: 5, bin: "", hue: Math.floor(Math.random() * 360) };
  const rows = products.filter((p) => p.status !== "unlisted" && (p.name + p.code + p.brand).toLowerCase().includes(q.toLowerCase()) && (show === "all" || p.status === show));
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const tabs: [Tab, string, number?][] = [["products", "Products & prices"], ["unlisted", "To list", unlisted.length], ["schemes", "Schemes"], ["history", "Price history"]];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-panel p-1">
          {tabs.map(([t, l, n]) => <button key={t} onClick={() => setTab(t)} className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${tab === t ? "bg-accent text-accentink" : "text-ink2"}`}>{l}{n ? <span className="num rounded bg-black/10 px-1 text-[10.5px]">{n}</span> : null}</button>)}
        </div>
        {tab === "products" && <>
          <input className="field max-w-[220px]" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field w-32" value={show} onChange={(e) => setShow(e.target.value as typeof show)}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </>}
        {canEdit && tab === "products" && (
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={exportProducts}><Download size={14} /> Export</button>
            <button className="btn" onClick={() => setImp(true)}><Upload size={14} /> Import CSV</button>
            <button className="btn" onClick={() => setBulk(true)}><Percent size={14} /> Bulk price</button>
            <button className="btn btn-primary" onClick={() => setEdit(blank)}><Plus size={14} /> Add product</button>
          </div>
        )}
        {canEdit && tab === "schemes" && <button className="btn btn-primary ml-auto" onClick={() => setSch({ id: `s${Date.now()}`, productId: products[0].id, minCtn: 10, discPct: 2 })}><Plus size={14} /> Add scheme</button>}
      </div>

      <div className="panel min-h-0 flex-1 overflow-auto">
        {tab === "products" && (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 z-10 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Supplier</th><th className="text-right">Pcs / ctn</th><th className="text-right">Carton price</th><th className="text-right">Margin</th><th className="pl-6">Status</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => {
                const pend = pendingFor(p.id);
                const m = p.cartonPrice ? Math.round(((p.cartonPrice - p.costPrice) / p.cartonPrice) * 100) : 0;
                return (
                  <tr key={p.id} className={`row-hover border-t border-line ${p.status === "inactive" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2"><div className="flex items-center gap-2.5"><Thumb p={p} size={28} /><div><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · rack {p.bin || "—"}</div></div></div></td>
                    <td className="text-ink2">{p.supplier}</td>
                    <td className="num text-right">{p.packSize}</td>
                    <td className="num text-right font-semibold">{fmt(p.cartonPrice)}{pend && <div className="text-[10.5px] font-semibold text-[var(--warn-fg)]">→ {fmt(pend.newPrice)} awaiting owner</div>}</td>
                    <td className="num text-right"><span className={m < 5 ? "font-semibold text-[var(--bad-fg)]" : ""}>{m}%</span></td>
                    <td className="pl-6">{p.status === "active" ? <span className="chip chip-ok">Active</span> : <span className="chip chip-mute">Inactive</span>}</td>
                    <td className="space-x-1 pr-4 text-right">{canEdit && <>
                      <button className="btn h-7 px-2" title="Edit" onClick={() => setEdit(p)}><Pencil size={13} /></button>
                      {used(p) ? (
                        <button className="btn h-7 px-2" title={p.status === "active" ? "Deactivate (hide from bookers)" : "Activate"} onClick={() => { setStatus(p.id, p.status === "active" ? "inactive" : "active"); toast(p.status === "active" ? `${p.name} hidden from bookers` : `${p.name} is active again`); }}>{p.status === "active" ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                      ) : (
                        <button className="btn btn-danger h-7 px-2" title="Delete (never used)" onClick={() => { if (del(p.id)) toast(`${p.name} deleted`); }}><Trash2 size={13} /></button>
                      )}</>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === "unlisted" && (unlisted.length === 0 ? <Empty title="Nothing waiting" hint="New items from purchasing orders appear here until you list and price them" /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th text-left"><th className="px-4 py-2.5">Item</th><th>Supplier</th><th className="text-right">Cost / ctn</th><th>Stock</th><th /></tr></thead>
            <tbody>
              {unlisted.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-2.5"><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · {p.packSize} pcs/ctn</div></td>
                  <td className="text-ink2">{p.supplier}</td>
                  <td className="num text-right">{fmt(p.costPrice)}</td>
                  <td>{p.stock > 0 ? <span className="chip chip-bad">{Math.round(p.stock / p.packSize)} ctn arrived, cannot be sold</span> : <span className="chip chip-warn">On order</span>}</td>
                  <td className="pr-4 text-right">{canEdit && <button className="btn btn-primary h-7" onClick={() => setEdit({ ...p, cartonPrice: Math.round(p.costPrice * 1.15 / 10) * 10, bin: p.bin || "E-01" })}>List and price</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

        {tab === "schemes" && (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Rule</th><th className="text-right">Discount</th><th /></tr></thead>
            <tbody>
              {schemes.map((s) => (
                <tr key={s.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2 font-semibold">{nameOf(s.productId)}</td>
                  <td className="text-ink2">Buy <span className="num font-semibold text-ink">{s.minCtn}+</span> cartons, automatic discount on the order line</td>
                  <td className="num text-right font-semibold">{s.discPct}%</td>
                  <td className="space-x-1 pr-4 text-right">{canEdit && <><button className="btn h-7 px-2" onClick={() => setSch(s)}><Pencil size={13} /></button><button className="btn btn-danger h-7 px-2" onClick={() => delScheme(s.id)}><Trash2 size={13} /></button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "history" && (history.length === 0 ? <Empty title="No price changes yet" hint="Every change is recorded here with who made it" /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">When</th><th>Product</th><th className="text-right">Old</th><th className="text-right">New</th><th className="text-right">Change</th><th>By</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-line">
                  <td className="px-4 py-2 text-ink3">{ago(h.at)}</td><td className="font-medium">{nameOf(h.productId)} <span className="text-[11px] text-ink3">{h.note}</span></td>
                  <td className="num text-right text-ink2">{h.oldPrice ? fmt(h.oldPrice) : "—"}</td><td className="num text-right font-semibold">{fmt(h.newPrice)}</td>
                  <td className="num text-right">{h.oldPrice ? `${h.pct > 0 ? "+" : ""}${h.pct.toFixed(1)}%` : "listed"}</td><td>{h.by}</td>
                  <td><span className={`chip ${h.status === "applied" ? "chip-ok" : h.status === "pending" ? "chip-warn" : "chip-bad"}`}>{h.status === "pending" ? "awaiting owner" : h.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      {imp && <ImportModal onClose={() => setImp(false)} />}
      {bulk && <BulkPriceModal onClose={() => setBulk(false)} />}
      {edit && (
        <MasterForm<Product>
          title={edit.status === "unlisted" ? `List ${edit.name}` : products.some((p) => p.id === edit.id) ? "Edit product" : "Add product"} initial={edit} onClose={() => setEdit(null)}
          fields={[
            { key: "name", label: "Name" }, { key: "code", label: "Code" }, { key: "brand", label: "Brand" },
            { key: "supplier", label: "Supplier" }, { key: "packSize", label: "Pieces per carton", type: "number" }, { key: "cartonPrice", label: "Sale price / carton (Rs.)", type: "number" },
            { key: "costPrice", label: "Cost / carton (Rs.)", type: "number" }, { key: "taxPct", label: "Sales tax %", type: "number" },
            { key: "reorder", label: "Reorder level (pcs)", type: "number" }, { key: "leadDays", label: "Supplier lead time (days)", type: "number" }, { key: "bin", label: "Rack" },
          ]}
          footer={(v) => {
            const old = products.find((p) => p.id === v.id)?.cartonPrice ?? 0;
            const m = v.cartonPrice ? ((v.cartonPrice - v.costPrice) / v.cartonPrice) * 100 : 0;
            const pct = old > 0 ? ((v.cartonPrice - old) / old) * 100 : 0;
            return (
              <div className="space-y-1 text-xs">
                <div className="num text-ink2">Margin {m.toFixed(1)}% · piece price {v.packSize ? (v.cartonPrice / v.packSize).toFixed(1) : "—"}</div>
                {v.cartonPrice > 0 && v.cartonPrice < v.costPrice && <div className="font-semibold text-[var(--bad-fg)]">Sale price is below cost. You will lose money on every carton.</div>}
                {v.cartonPrice > 0 && v.cartonPrice >= v.costPrice && m < 5 && <div className="font-semibold text-[var(--warn-fg)]">Margin is under 5%.</div>}
                {Math.abs(pct) > 10 && <div className="font-semibold text-[var(--warn-fg)]">Price changes by {pct.toFixed(1)}%. The owner has to approve it before it applies.</div>}
                {edit.status === "unlisted" && !(v.cartonPrice > 0) && <div className="text-ink3">Enter a sale price to list this item for bookers.</div>}
              </div>
            );
          }}
          onSave={(v) => {
            if (edit.status === "unlisted") {
              if (!(v.cartonPrice > 0)) { toast("Enter a sale price first"); return; }
              upsert({ ...v, status: "active" }, by); toast(`${v.name} is listed. Bookers can sell it now`);
            } else { upsert(!products.some((p) => p.id === v.id) && !(v.cartonPrice > 0) ? { ...v, status: "unlisted" } : v, by); toast("Product saved"); }
            setEdit(null);
          }} />
      )}
      {sch && (
        <MasterForm<Scheme> title="Scheme" initial={sch} onClose={() => setSch(null)}
          fields={[{ key: "productId", label: "Product", type: "select", options: products.filter((p) => p.status === "active").map((p) => [p.id, p.name]) }, { key: "minCtn", label: "Minimum cartons", type: "number" }, { key: "discPct", label: "Discount %", type: "number" }]}
          onSave={(v) => { upsertScheme(v); setSch(null); toast("Scheme saved"); }} />
      )}
    </div>
  );
}
export default function Page() { return <Suspense><Products /></Suspense>; }
