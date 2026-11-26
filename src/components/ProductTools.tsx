"use client";
import { useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import type { ImportRow } from "@/lib/store";
import { fmt } from "@/lib/calc";
import { Modal, toast } from "./ui";

const HEAD = ["code", "name", "brand", "supplier", "pack_size", "sale_price", "cost_price", "reorder_cartons", "lead_days", "rack"];

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export function exportProducts() {
  const ps = useStore.getState().products;
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = ps.map((p) => [p.code, p.name, p.brand, p.supplier, p.packSize, p.cartonPrice, p.costPrice, Math.round(p.reorder / p.packSize), p.leadDays, p.bin].map(q).join(","));
  download("products.csv", [HEAD.join(","), ...rows].join("\n"));
}
export const downloadTemplate = () => download("products-template.csv", HEAD.join(",") + "\nSE-01,Surf Excel 1kg,Unilever,Unilever Pakistan,12,8500,7310,20,5,A-01");

function splitCsv(line: string) {
  const out: string[] = []; let cur = ""; let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const products = useStore((s) => s.products);
  const importProducts = useStore((s) => s.importProducts);
  const user = useUser();
  const [text, setText] = useState("");

  const parsed = useMemo(() => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { rows: [] as ImportRow[], errors: [] as string[], news: 0, upd: 0 };
    const head = splitCsv(lines[0]).map((h) => h.toLowerCase());
    const idx = (k: string) => head.indexOf(k);
    const rows: ImportRow[] = []; const errors: string[] = [];
    lines.slice(1).forEach((ln, i) => {
      const c = splitCsv(ln);
      const get = (k: string) => (idx(k) >= 0 ? c[idx(k)] : undefined);
      const num = (k: string) => { const v = get(k); if (v === undefined || v === "") return undefined; const n = Number(v); return Number.isFinite(n) ? n : NaN; };
      const code = get("code");
      if (!code) { errors.push(`Row ${i + 2}: missing code`); return; }
      const nums = ["pack_size", "sale_price", "cost_price", "reorder_cartons", "lead_days"].map((k) => [k, num(k)] as const);
      const bad = nums.find(([, v]) => v !== undefined && Number.isNaN(v));
      if (bad) { errors.push(`Row ${i + 2} (${code}): ${bad[0]} is not a number`); return; }
      const ex = products.find((p) => p.code.toLowerCase() === code.toLowerCase());
      const pack = num("pack_size") ?? ex?.packSize ?? 12;
      const rc = num("reorder_cartons");
      rows.push({ code, name: get("name"), brand: get("brand"), supplier: get("supplier"), packSize: num("pack_size"), cartonPrice: num("sale_price"), costPrice: num("cost_price"), reorder: rc !== undefined ? rc * pack : undefined, leadDays: num("lead_days"), bin: get("rack") });
    });
    const upd = rows.filter((r) => products.some((p) => p.code.toLowerCase() === r.code.toLowerCase())).length;
    return { rows, errors, news: rows.length - upd, upd };
  }, [text, products]);

  return (
    <Modal open onClose={onClose} title="Import products from CSV" width={640}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-ink2">
          <span>Columns: <span className="num">{HEAD.join(", ")}</span>. Existing codes are updated, new codes are added. Rows with no sale price wait in &quot;To list&quot;.</span>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={downloadTemplate}><Download size={14} /> Template</button>
          <label className="btn cursor-pointer"><Upload size={14} /> Choose file<input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); }} /></label>
        </div>
        <textarea className="field num h-40 resize-none py-2 text-[12px]" placeholder={HEAD.join(",") + "\nSE-01,Surf Excel 1kg,..."} value={text} onChange={(e) => setText(e.target.value)} />
        {text && (
          <div className="rounded-xl border border-line bg-panel2 p-3 text-[12.5px]">
            <div className="flex flex-wrap gap-2"><span className="chip chip-ok">{parsed.news} new</span><span className="chip chip-info">{parsed.upd} updated</span>{parsed.errors.length > 0 && <span className="chip chip-bad">{parsed.errors.length} with errors (skipped)</span>}</div>
            {parsed.errors.slice(0, 4).map((e) => <div key={e} className="mt-1 text-[11.5px] text-[var(--bad-fg)]">{e}</div>)}
            <div className="mt-1 text-[11.5px] text-ink3">Price changes above 10% on existing products go to the owner for approval.</div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!parsed.rows.length} onClick={() => {
            const r = importProducts(parsed.rows, user?.initials ?? "—");
            toast(`${r.added} added, ${r.updated} updated${r.pending ? `. ${r.pending} price changes sent to owner` : ""}`);
            onClose();
          }}>Import {parsed.rows.length} rows</button>
        </div>
      </div>
    </Modal>
  );
}

export function BulkPriceModal({ onClose }: { onClose: () => void }) {
  const products = useStore((s) => s.products).filter((p) => p.cartonPrice > 0);
  const bulk = useStore((s) => s.bulkPrice);
  const user = useUser();
  const suppliers = Array.from(new Set(products.map((p) => p.supplier)));
  const [sup, setSup] = useState("all");
  const [pct, setPct] = useState(3);
  const sel = products.filter((p) => sup === "all" || p.supplier === sup);
  return (
    <Modal open onClose={onClose} title="Bulk price update" width={520}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><div className="th mb-1">Supplier</div><select className="field" value={sup} onChange={(e) => setSup(e.target.value)}><option value="all">All products</option>{suppliers.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><div className="th mb-1">Change %</div><input className="field num font-semibold" type="number" step="0.5" value={pct} onChange={(e) => setPct(+e.target.value)} /></div>
        </div>
        <div className="max-h-52 overflow-auto rounded-xl border border-line">
          {sel.map((p) => { const n = Math.round(p.cartonPrice * (1 + pct / 100)); return <div key={p.id} className="flex items-center justify-between border-b border-line px-3 py-1.5 text-xs last:border-0"><span>{p.name}</span><span className="num"><span className="text-ink3">{fmt(p.cartonPrice)}</span> → <b>{fmt(n)}</b>{n < p.costPrice && <span className="ml-1 text-[var(--bad-fg)]">below cost</span>}</span></div>; })}
        </div>
        {Math.abs(pct) > 10 && <div className="text-xs text-[var(--warn-fg)]">Above 10%: the owner has to approve before these prices apply.</div>}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!sel.length || pct === 0} onClick={() => { const r = bulk(sel.map((p) => p.id), pct, user?.initials ?? "—"); toast(r.pending ? "Sent to owner for approval" : `Prices updated on ${r.applied} products`); onClose(); }}>Update {sel.length} products</button>
        </div>
      </div>
    </Modal>
  );
}
