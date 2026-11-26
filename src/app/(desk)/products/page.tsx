"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, Download, Upload, Percent, EyeOff, Eye, Search } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, available, fmt, schemeLabel } from "@/lib/calc";
import type { PriceList, Product, Scheme } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import PriceListEditor from "@/components/PriceListEditor";
import { BulkPriceModal, ImportModal, exportProducts } from "@/components/ProductTools";
import { Chips, Empty, Thumb, ViewSwitch, ask, toast, useViewMode } from "@/components/ui";

type Tab = "products" | "unlisted" | "lists" | "schemes" | "history";
type Sort = "name" | "price" | "margin" | "stock";

function Products() {
  const params = useSearchParams();
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const purchases = useStore((s) => s.purchases);
  const schemes = useStore((s) => s.schemes);
  const routes = useStore((s) => s.routes);
  const suppliers = useStore((s) => s.suppliers);
  const customers = useStore((s) => s.customers);
  const priceLists = useStore((s) => s.priceLists);
  const history = useStore((s) => s.priceHistory);
  const upsert = useStore((s) => s.upsertProduct);
  const del = useStore((s) => s.deleteProduct);
  const setStatus = useStore((s) => s.setProductStatus);
  const upsertScheme = useStore((s) => s.upsertScheme);
  const delScheme = useStore((s) => s.deleteScheme);
  const delList = useStore((s) => s.deletePriceList);
  const user = useUser();
  const by = user?.initials ?? "—";
  const canEdit = user?.role === "sales";
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "products");
  const [view, setView] = useViewMode("catalog", "tiles");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sup, setSup] = useState("all");
  const [show, setShow] = useState<"all" | "active" | "inactive">("all");
  const [stk, setStk] = useState<"all" | "in" | "low" | "out">("all");
  const [sort, setSort] = useState<Sort>("name");
  const [edit, setEdit] = useState<Product | null>(null);
  const [sch, setSch] = useState<Scheme | null>(null);
  const [pl, setPl] = useState<PriceList | null>(null);
  const [imp, setImp] = useState(false);
  const [bulk, setBulk] = useState(false);

  const unlisted = products.filter((p) => p.status === "unlisted");
  const listed = products.filter((p) => p.status !== "unlisted");
  const categories = useMemo(() => Array.from(new Set(listed.map((p) => p.category))).sort(), [listed]);
  const pendingFor = (id: string) => history.find((h) => h.productId === id && h.status === "pending");
  const used = (p: Product) => p.stock > 0 || p.damaged > 0 || orders.some((o) => o.lines.some((l) => l.productId === p.id)) || purchases.some((o) => o.lines.some((l) => l.productId === p.id));
  const margin = (p: Product) => (p.cartonPrice ? ((p.cartonPrice - p.costPrice) / p.cartonPrice) * 100 : 0);
  const blank: Product = { id: `p${Date.now()}`, status: "active", code: "", name: "", brand: "", supplier: suppliers[0]?.name ?? "", category: categories[0] ?? "General", barcode: "", packSize: 12, cartonPrice: 0, costPrice: 0, taxPct: 18, stock: 0, batches: [], damaged: 0, reserved: 0, reorder: 120, leadDays: 5, bin: "", hue: Math.floor(Math.random() * 360) };

  const rows = listed
    .filter((p) => (p.name + p.code + p.brand + p.barcode + p.category).toLowerCase().includes(q.toLowerCase()))
    .filter((p) => (cat === "all" || p.category === cat) && (sup === "all" || p.supplier === sup) && (show === "all" || p.status === show))
    .filter((p) => stk === "all" || (stk === "in" ? available(p) > 0 : stk === "out" ? available(p) === 0 : available(p) > 0 && available(p) < p.reorder))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "price" ? b.cartonPrice - a.cartonPrice : sort === "margin" ? margin(b) - margin(a) : available(b) - available(a)));
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? "—";
  const tabs: [Tab, string, number?][] = [["products", "Catalog", listed.length], ["unlisted", "To list", unlisted.length], ["lists", "Price lists"], ["schemes", "Schemes"], ["history", "Price history"]];

  const actions = (p: Product) => canEdit && (
    <span className="inline-flex gap-1">
      <button className="btn h-7 px-2" title="Edit" onClick={() => setEdit(p)}><Pencil size={13} /></button>
      {used(p) ? (
        <button className="btn h-7 px-2" title={p.status === "active" ? "Deactivate (hide from bookers)" : "Activate"} onClick={() => { const was = p.status; setStatus(p.id, was === "active" ? "inactive" : "active"); toast(was === "active" ? `${p.name} hidden from bookers` : `${p.name} is active again`, { undo: () => setStatus(p.id, was) }); }}>{p.status === "active" ? <EyeOff size={13} /> : <Eye size={13} />}</button>
      ) : (
        <button className="btn btn-danger h-7 px-2" title="Delete (never used)" onClick={async () => { if (await ask({ title: `Delete ${p.name}?`, body: "It was never used, so it will be removed completely.", confirm: "Delete", danger: true })) { if (del(p.id)) toast(`${p.name} deleted`); } }}><Trash2 size={13} /></button>
      )}
    </span>
  );
  const stockChip = (p: Product) => { const a = available(p); return <span className={`chip num ${a === 0 ? "chip-bad" : a < p.reorder ? "chip-warn" : "chip-ok"}`}>{a === 0 ? "Out" : `${Math.floor(a / p.packSize)} ctn`}</span>; };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-panel p-1">
          {tabs.map(([t, l, n]) => <button key={t} onClick={() => setTab(t)} className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${tab === t ? "bg-accent text-accentink" : "text-ink2"}`}>{l}{n ? <span className="num rounded bg-black/10 px-1 text-[10.5px]">{n}</span> : null}</button>)}
        </div>
        {canEdit && tab === "products" && (
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={exportProducts}><Download size={14} /> Export</button>
            <button className="btn" onClick={() => setImp(true)}><Upload size={14} /> Import CSV</button>
            <button className="btn" onClick={() => setBulk(true)}><Percent size={14} /> Bulk price</button>
            <button className="btn btn-primary" onClick={() => setEdit(blank)}><Plus size={14} /> Add product</button>
          </div>
        )}
        {canEdit && tab === "lists" && <button className="btn btn-primary ml-auto" onClick={() => setPl({ id: `pl${Date.now()}`, name: "", adjustPct: 0, overrides: {} })}><Plus size={14} /> New price list</button>}
        {canEdit && tab === "schemes" && <button className="btn btn-primary ml-auto" onClick={() => setSch({ id: `s${Date.now()}`, productId: products.find((p) => p.status === "active")?.id ?? "", type: "discount", minCtn: 10, discPct: 2, freeCtn: 1 })}><Plus size={14} /> Add scheme</button>}
      </div>

      {tab === "products" && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-[260px]"><Search size={14} className="absolute left-2.5 top-2.5 text-ink3" /><input className="field" style={{ paddingLeft: 32 }} placeholder="Search name, code, barcode…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="field w-44" value={sup} onChange={(e) => setSup(e.target.value)}><option value="all">All suppliers</option>{suppliers.map((s) => <option key={s.id}>{s.name}</option>)}</select>
            <select className="field w-36" value={stk} onChange={(e) => setStk(e.target.value as typeof stk)}><option value="all">Any stock</option><option value="in">In stock</option><option value="low">Running low</option><option value="out">Out of stock</option></select>
            <select className="field w-32" value={show} onChange={(e) => setShow(e.target.value as typeof show)}><option value="all">All status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
            <select className="field w-40" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="name">Sort: name</option><option value="price">Sort: price (high)</option><option value="margin">Sort: margin (high)</option><option value="stock">Sort: stock (high)</option></select>
            <div className="ml-auto flex items-center gap-2"><span className="text-xs text-ink3">{rows.length} shown</span><ViewSwitch mode={view} onChange={setView} /></div>
          </div>
          <Chips value={cat} onChange={setCat} items={[{ k: "all", label: "All categories", count: listed.length }, ...categories.map((c) => ({ k: c, label: c, count: listed.filter((p) => p.category === c).length }))]} />
        </div>
      )}

      <div className={`min-h-0 flex-1 overflow-auto ${tab === "products" && view === "tiles" ? "" : "panel"}`}>
        {tab === "products" && rows.length === 0 && <div className="panel"><Empty title="No products match" hint="Try a different word, or clear the filters." action={{ label: "Clear filters", onClick: () => { setQ(""); setCat("all"); setSup("all"); setStk("all"); setShow("all"); } }} /></div>}

        {tab === "products" && rows.length > 0 && view === "tiles" && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(215px,1fr))] gap-3">
            {rows.map((p) => {
              const pend = pendingFor(p.id);
              const m = margin(p);
              return (
                <div key={p.id} className={`panel flex flex-col gap-2.5 p-3.5 transition hover:border-accent ${p.status === "inactive" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between"><Thumb p={p} size={52} />{p.status === "inactive" ? <span className="chip chip-mute">Inactive</span> : stockChip(p)}</div>
                  <div><div className="text-[13.5px] font-semibold leading-snug">{p.name}</div><div className="num mt-0.5 text-[11px] text-ink3">{p.code} · {p.packSize}/ctn</div></div>
                  <span className="chip chip-mute self-start">{p.category}</span>
                  <div className="mt-auto flex items-end justify-between">
                    <div><div className="num text-[20px] font-bold leading-none">{fmt(p.cartonPrice)}</div><div className="mt-1 text-[10.5px] text-ink3">per carton{pend && <span className="ml-1 font-semibold text-[var(--warn-fg)]">→ {fmt(pend.newPrice)} pending</span>}</div></div>
                    <span className={`num text-[11.5px] font-semibold ${m < 5 ? "text-[var(--bad-fg)]" : "text-ink2"}`}>{Math.round(m)}%</span>
                  </div>
                  {canEdit && <div className="flex justify-end border-t border-line pt-2">{actions(p)}</div>}
                </div>
              );
            })}
          </div>
        )}

        {tab === "products" && rows.length > 0 && view === "compact" && (
          <div>
            {rows.map((p) => (
              <div key={p.id} className={`row-hover flex items-center gap-3 border-b border-line px-3 py-1.5 text-[12.5px] ${p.status === "inactive" ? "opacity-60" : ""}`}>
                <Thumb p={p} size={22} /><span className="num w-16 text-ink3">{p.code}</span><span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="hidden w-44 truncate text-ink3 md:block">{p.category}</span><span className="num w-20 text-right font-semibold">{fmt(p.cartonPrice)}</span>
                <span className="w-20 text-right">{stockChip(p)}</span><span className="w-20 text-right">{actions(p)}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "products" && rows.length > 0 && view === "table" && (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 z-10 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Category</th><th>Supplier</th><th className="text-right">Pcs / ctn</th><th className="text-right">Carton price</th><th className="text-right">Margin</th><th className="text-right">Stock</th><th className="pl-6">Status</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => {
                const pend = pendingFor(p.id);
                const m = margin(p);
                return (
                  <tr key={p.id} className={`row-hover border-t border-line ${p.status === "inactive" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2"><div className="flex items-center gap-2.5"><Thumb p={p} size={28} /><div><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · {p.barcode || "no barcode"} · rack {p.bin || "—"}</div></div></div></td>
                    <td className="text-ink2">{p.category}</td><td className="text-ink2">{p.supplier}</td>
                    <td className="num text-right">{p.packSize}</td>
                    <td className="num text-right font-semibold">{fmt(p.cartonPrice)}{pend && <div className="text-[10.5px] font-semibold text-[var(--warn-fg)]">→ {fmt(pend.newPrice)} awaiting owner</div>}</td>
                    <td className="num text-right"><span className={m < 5 ? "font-semibold text-[var(--bad-fg)]" : ""}>{Math.round(m)}%</span></td>
                    <td className="text-right">{stockChip(p)}</td>
                    <td className="pl-6">{p.status === "active" ? <span className="chip chip-ok">Active</span> : <span className="chip chip-mute">Inactive</span>}</td>
                    <td className="pr-4 text-right">{actions(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === "unlisted" && (unlisted.length === 0 ? <Empty title="Nothing waiting" hint="New items from purchasing orders appear here until you list and price them" /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th text-left"><th className="px-4 py-2.5">Item</th><th>Supplier</th><th className="text-right">Cost / ctn</th><th className="pl-6">Stock</th><th /></tr></thead>
            <tbody>
              {unlisted.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="px-4 py-2.5"><div className="font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · {p.packSize} pcs/ctn</div></td>
                  <td className="text-ink2">{p.supplier}</td><td className="num text-right">{fmt(p.costPrice)}</td>
                  <td className="pl-6">{p.stock > 0 ? <span className="chip chip-bad">{Math.round(p.stock / p.packSize)} ctn arrived, cannot be sold</span> : <span className="chip chip-warn">On order</span>}</td>
                  <td className="pr-4 text-right">{canEdit && <button className="btn btn-primary h-7" onClick={() => setEdit({ ...p, cartonPrice: Math.round(p.costPrice * 1.15 / 10) * 10, bin: p.bin || "E-01" })}>List and price</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}

        {tab === "lists" && (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th text-left"><th className="px-4 py-2.5">Price list</th><th className="text-right">Adjustment</th><th className="text-right">Product overrides</th><th className="text-right">Customers</th><th /></tr></thead>
            <tbody>
              {priceLists.map((l) => (
                <tr key={l.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2.5 font-semibold">{l.name}{l.id === "pl1" && <span className="chip chip-mute ml-2">Default</span>}</td>
                  <td className="num text-right">{l.adjustPct > 0 ? "+" : ""}{l.adjustPct}%</td>
                  <td className="num text-right">{Object.keys(l.overrides).length || "—"}</td>
                  <td className="num text-right">{customers.filter((c) => c.priceListId === l.id).length}</td>
                  <td className="space-x-1 pr-4 text-right">{canEdit && <><button className="btn h-7" onClick={() => setPl(l)}><Pencil size={13} /> Edit prices</button>{l.id !== "pl1" && <button className="btn btn-danger h-7 px-2" onClick={async () => { if (await ask({ title: `Delete the ${l.name} price list?`, confirm: "Delete", danger: true })) toast(delList(l.id) ? "Price list deleted" : "Customers still use this list. Move them to another list first."); }}><Trash2 size={13} /></button>}</>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "schemes" && (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th>Rule</th><th>Valid</th><th>Applies to</th><th /></tr></thead>
            <tbody>
              {schemes.map((s) => (
                <tr key={s.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2 font-semibold">{nameOf(s.productId)}</td>
                  <td><span className={`chip ${s.type === "free" ? "chip-info" : "chip-ok"}`}>{schemeLabel(s)}</span></td>
                  <td className="num text-ink2">{s.from || s.to ? `${s.from ?? "…"} → ${s.to ?? "…"}` : "Always"}</td>
                  <td className="text-ink2">{s.route || "All routes"}</td>
                  <td className="space-x-1 pr-4 text-right">{canEdit && <><button className="btn h-7 px-2" onClick={() => setSch(s)}><Pencil size={13} /></button><button className="btn btn-danger h-7 px-2" onClick={async () => { if (await ask({ title: "Delete this scheme?", body: "New orders will stop getting this discount. Existing orders are not changed.", confirm: "Delete", danger: true })) { delScheme(s.id); toast("Scheme deleted"); } }}><Trash2 size={13} /></button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "history" && (history.length === 0 ? <Empty title="No price changes yet" hint="Every change is recorded here with who made it" /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">When</th><th>Product</th><th className="text-right">Old</th><th className="text-right">New</th><th className="text-right">Change</th><th className="pl-6">By</th><th>Status</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-line">
                  <td className="px-4 py-2 text-ink3">{ago(h.at)}</td><td className="font-medium">{nameOf(h.productId)} <span className="text-[11px] text-ink3">{h.note}</span></td>
                  <td className="num text-right text-ink2">{h.oldPrice ? fmt(h.oldPrice) : "—"}</td><td className="num text-right font-semibold">{fmt(h.newPrice)}</td>
                  <td className="num text-right">{h.oldPrice ? `${h.pct > 0 ? "+" : ""}${h.pct.toFixed(1)}%` : "listed"}</td><td className="pl-6">{h.by}</td>
                  <td><span className={`chip ${h.status === "applied" ? "chip-ok" : h.status === "pending" ? "chip-warn" : "chip-bad"}`}>{h.status === "pending" ? "awaiting owner" : h.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>

      {imp && <ImportModal onClose={() => setImp(false)} />}
      {bulk && <BulkPriceModal onClose={() => setBulk(false)} />}
      {pl && <PriceListEditor list={pl} onClose={() => setPl(null)} />}
      {edit && (
        <MasterForm<Product>
          title={edit.status === "unlisted" ? `List ${edit.name}` : products.some((p) => p.id === edit.id) ? "Edit product" : "Add product"} initial={edit} onClose={() => setEdit(null)}
          fields={[
            { key: "image", label: "Picture", type: "image" },
            { key: "name", label: "Name", required: true }, { key: "code", label: "Code", required: true }, { key: "category", label: "Category", datalist: categories, required: true }, { key: "brand", label: "Brand" },
            { key: "supplier", label: "Supplier", type: "select", options: suppliers.map((s) => [s.name, s.name]) }, { key: "barcode", label: "Barcode" },
            { key: "packSize", label: "Pieces per carton", type: "number" }, { key: "cartonPrice", label: "Sale price / carton (Rs.)", type: "number" },
            { key: "costPrice", label: "Cost / carton (Rs.)", type: "number" }, { key: "taxPct", label: "Sales tax %", type: "number" },
            { key: "reorder", label: "Reorder level (pcs)", type: "number" }, { key: "leadDays", label: "Supplier lead time (days)", type: "number" }, { key: "bin", label: "Rack" },
          ]}
          validate={(v) => ({
            code: !v.code ? "" : products.some((p) => p.id !== v.id && p.code.toLowerCase() === v.code.toLowerCase()) ? "Another product already uses this code" : "",
            packSize: !(v.packSize >= 1) ? "Pieces per carton must be at least 1" : "",
            cartonPrice: v.cartonPrice < 0 ? "Price cannot be negative" : "",
            costPrice: v.costPrice < 0 ? "Cost cannot be negative" : "",
            taxPct: v.taxPct < 0 || v.taxPct > 100 ? "Tax must be between 0 and 100" : "",
            reorder: v.reorder < 0 ? "Reorder level cannot be negative" : "",
            leadDays: v.leadDays < 0 || v.leadDays > 90 ? "Lead time must be 0 to 90 days" : "",
            barcode: v.barcode && !/^\d{8,14}$/.test(v.barcode) ? "Barcode is 8 to 14 digits" : "",
          })}
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
          fields={[
            { key: "productId", label: "Product", type: "select", options: products.filter((p) => p.status === "active").map((p) => [p.id, p.name]) },
            { key: "type", label: "Type", type: "select", options: [["discount", "Discount %"], ["free", "Free cartons"]] },
            { key: "minCtn", label: "Buy at least (cartons)", type: "number" },
            sch.type === "free" ? { key: "freeCtn", label: "Free cartons per that many", type: "number" } : { key: "discPct", label: "Discount %", type: "number" },
            { key: "from", label: "Valid from", type: "date" }, { key: "to", label: "Valid to", type: "date" },
            { key: "route", label: "Only for route", type: "select", options: [["", "All routes"], ...routes.map((r) => [r.name, r.name] as [string, string])] },
          ]}
          validate={(v) => ({
            minCtn: !(v.minCtn >= 1) ? "Buy at least 1 carton" : "",
            discPct: v.type === "discount" && (v.discPct <= 0 || v.discPct > 50) ? "Discount must be between 0 and 50%" : "",
            freeCtn: v.type === "free" && !(v.freeCtn >= 1) ? "Give at least 1 free carton" : "",
            to: v.from && v.to && v.to < v.from ? "End date is before the start date" : "",
          })}
          footer={(v) => <div className="text-xs text-ink2">{v.type === "free" ? `Buy ${v.minCtn} cartons, get ${v.freeCtn} free. The free cartons appear as a separate zero-price line on the order.` : `Buy ${v.minCtn}+ cartons, ${v.discPct}% off. Applied automatically; a hand-typed discount overrides it.`}</div>}
          onSave={(v) => { upsertScheme({ ...v, from: v.from || undefined, to: v.to || undefined, route: v.route || undefined }); setSch(null); toast("Scheme saved"); }} />
      )}
    </div>
  );
}
export default function Page() { return <Suspense><Products /></Suspense>; }
