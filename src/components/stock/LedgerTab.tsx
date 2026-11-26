"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/calc";
import { KIND, withBalance } from "@/lib/stockctl";
import type { StockEntry } from "@/lib/types";
import { Chips, Empty, Thumb } from "../ui";

type Group = "all" | "in" | "out" | "move" | "flag";
const RANGE: Record<string, number> = { "7": 7, "30": 30, all: 9999 };
const ctn = (pcs: number, pack: number) => Math.round((pcs / pack) * 10) / 10;

export default function LedgerTab({ initialProduct }: { initialProduct?: string }) {
  const products = useStore((s) => s.products);
  const ledger = useStore((s) => s.ledger);
  const [pid, setPid] = useState(initialProduct ?? "all");
  const [group, setGroup] = useState<Group>("all");
  const [range, setRange] = useState("30");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(60);
  const cur = products.find((p) => p.id === pid);

  const rows = useMemo(() => {
    const from = Date.now() - RANGE[range] * 86400000;
    const base: { e: StockEntry; after?: number }[] = pid !== "all" && cur ? withBalance(ledger, pid, cur.stock) : ledger.map((e) => ({ e })).sort((a, b) => b.e.at - a.e.at);
    const ql = q.trim().toLowerCase();
    return base.filter(({ e }) => e.at >= from && (group === "all" || KIND[e.kind].tone === group)
      && (pid === "all" || e.productId === pid)
      && (!ql || `${e.ref} ${e.batch} ${e.note ?? ""} ${e.from ?? ""} ${e.to ?? ""} ${products.find((p) => p.id === e.productId)?.name}`.toLowerCase().includes(ql)));
  }, [ledger, pid, cur, group, range, q, products]);

  const exportCsv = () => {
    const qv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["time", "product", "type", "ref", "batch", "from", "to", "pieces_change", "balance_cartons", "by", "note"].join(","),
      ...rows.map(({ e, after }) => [new Date(e.at).toISOString(), products.find((p) => p.id === e.productId)?.name ?? "", KIND[e.kind].label, e.ref, e.batch, e.from ?? "", e.to ?? "", e.qty, after !== undefined ? ctn(after, cur!.packSize) : "", e.by, e.note ?? ""].map(qv).join(","))];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "stock-ledger.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="field w-64" value={pid} onChange={(e) => { setPid(e.target.value); setLimit(60); }}><option value="all">All products</option>{products.filter((p) => p.status !== "unlisted").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="field w-36" value={range} onChange={(e) => setRange(e.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">Everything</option></select>
        <input className="field w-60" placeholder="Search ref, batch, customer, bin…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Chips value={group} onChange={setGroup} items={[{ k: "all", label: "All" }, { k: "in", label: "Stock in" }, { k: "out", label: "Stock out" }, { k: "move", label: "Moves" }, { k: "flag", label: "Holds & adjustments" }]} />
        <button className="btn ml-auto" onClick={exportCsv} disabled={!rows.length}><Download size={14} /> Export CSV</button>
      </div>
      {cur && <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-2.5"><Thumb p={cur} size={32} /><div className="flex-1"><div className="font-semibold">{cur.name}</div><div className="num text-[11px] text-ink3">{cur.code} · {cur.packSize} pcs per carton</div></div><div className="text-right"><div className="th">On hand now</div><div className="num text-[18px] font-bold">{fmt(cur.stock / cur.packSize)} ctn</div></div></div>}
      <div className="panel min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? <Empty title="No movements match" hint="Widen the date range or clear the search." action={{ label: "Show everything", onClick: () => { setRange("all"); setQ(""); setGroup("all"); } }} /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 z-10 bg-panel text-left"><th className="px-4 py-2.5">When</th><th>Type</th><th>Ref</th>{pid === "all" && <th>Product</th>}<th>Batch</th><th>Bin</th><th className="text-right">Change</th>{cur && <th className="text-right">Balance</th>}<th className="pl-5">By</th><th>Note</th></tr></thead>
            <tbody>
              {rows.slice(0, limit).map(({ e, after }) => {
                const p = products.find((x) => x.id === e.productId);
                const k = KIND[e.kind];
                return (
                  <tr key={e.id} className="row-hover border-t border-line">
                    <td className="px-4 py-2"><div>{new Date(e.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div><div className="num text-[10.5px] text-ink3">{new Date(e.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</div></td>
                    <td><span className={`chip ${k.tone === "in" ? "chip-ok" : k.tone === "out" ? "chip-mute" : k.tone === "flag" ? "chip-warn" : "chip-info"}`}>{k.label}</span></td>
                    <td className="num font-medium">{e.ref}</td>
                    {pid === "all" && <td className="font-medium">{p?.name}</td>}
                    <td className="num text-ink2">{e.batch}</td>
                    <td className="num text-ink2">{e.from && e.to ? `${e.from} → ${e.to}` : e.to ? `→ ${e.to}` : e.from ? `${e.from} →` : "—"}</td>
                    <td className="num text-right font-semibold" style={{ color: e.qty > 0 ? "var(--ok-fg)" : e.qty < 0 ? "var(--bad-fg)" : "var(--ink-3)" }}>{e.qty === 0 ? `${ctn(e.pcs, p?.packSize ?? 1)} ctn` : `${e.qty > 0 ? "+" : "−"}${ctn(Math.abs(e.qty), p?.packSize ?? 1)} ctn`}</td>
                    {cur && <td className="num text-right">{after !== undefined ? ctn(after, cur.packSize) : ""}</td>}
                    <td className="pl-5 text-ink2">{e.by}</td><td className="max-w-[260px] truncate text-ink2" title={e.note}>{e.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {rows.length > limit && <div className="border-t border-line p-3 text-center"><button className="btn" onClick={() => setLimit(limit + 100)}>Show more ({rows.length - limit} left)</button></div>}
      </div>
    </div>
  );
}
