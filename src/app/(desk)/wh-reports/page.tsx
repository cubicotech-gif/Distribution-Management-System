"use client";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt } from "@/lib/calc";
import { good } from "@/lib/grn";
import { lineDelta } from "@/lib/counts";
import { KIND, statusSplit } from "@/lib/stockctl";
import { ADJ_CODES } from "@/lib/types";
import { Chips, Empty } from "@/components/ui";

type Tab = "stock" | "moves" | "grn" | "dispatch" | "pick" | "counts" | "returns" | "damaged";
type Cell = string | number;
interface Report { heads: string[]; rows: Cell[][]; right?: number[]; note?: string; totals?: Cell[] }
const RANGE: Record<string, number> = { "7": 7, "30": 30, "90": 90, all: 99999 };
const c1 = (pcs: number, pack: number) => Math.round((pcs / pack) * 10) / 10;
const dt = (ts?: number) => (ts ? new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

export default function WhReports() {
  const products = useStore((s) => s.products);
  const ledger = useStore((s) => s.ledger);
  const grns = useStore((s) => s.grns);
  const trips = useStore((s) => s.trips);
  const orders = useStore((s) => s.orders);
  const users = useStore((s) => s.users);
  const counts = useStore((s) => s.counts);
  const returns = useStore((s) => s.returns);
  const customers = useStore((s) => s.customers);
  const destructions = useStore((s) => s.destructions);
  const adjustments = useStore((s) => s.adjustments);
  const role = useUser()?.role;
  const money = role === "purchasing" || role === "admin";
  const [tab, setTab] = useState<Tab>("stock");
  const [range, setRange] = useState("30");
  const from = Date.now() - RANGE[range] * 86400000;
  const P = (id: string) => products.find((p) => p.id === id);

  const report: Report = useMemo(() => {
    if (tab === "stock") {
      const rows = products.filter((p) => p.status !== "unlisted" || p.stock > 0).map((p) => { const s = statusSplit(p); return [p.name, p.code, c1(p.stock, p.packSize), c1(s.reserved, p.packSize), c1(s.available, p.packSize), c1(s.held, p.packSize), c1(s.damaged, p.packSize), c1(s.expired, p.packSize), new Set(p.batches.filter((b) => b.qty > 0).map((b) => b.bin)).size, ...(money ? [Math.round((p.stock / p.packSize) * p.costPrice)] : [])]; });
      const sum = (i: number) => Math.round(rows.reduce((t, r) => t + (r[i] as number), 0) * 10) / 10;
      return { heads: ["Product", "Code", "On hand (ctn)", "Reserved", "Available", "On hold", "Damaged", "Expired", "Bins", ...(money ? ["Value at cost"] : [])], rows, right: [2, 3, 4, 5, 6, 7, 8, 9], totals: ["Total", "", sum(2), sum(3), sum(4), sum(5), sum(6), sum(7), "", ...(money ? [sum(9)] : [])], note: "Quantities in cartons. Expired stock is not counted as available." };
    }
    if (tab === "moves") {
      const es = ledger.filter((e) => e.at >= from);
      const rows = (Object.keys(KIND) as (keyof typeof KIND)[]).map((k) => {
        const x = es.filter((e) => e.kind === k);
        const inn = x.filter((e) => e.qty > 0).reduce((t, e) => t + e.qty / (P(e.productId)?.packSize ?? 1), 0);
        const out = x.filter((e) => e.qty < 0).reduce((t, e) => t + -e.qty / (P(e.productId)?.packSize ?? 1), 0);
        const mv = x.filter((e) => e.qty === 0).reduce((t, e) => t + e.pcs / (P(e.productId)?.packSize ?? 1), 0);
        return [KIND[k].label, x.length, Math.round(inn * 10) / 10, Math.round(out * 10) / 10, Math.round(mv * 10) / 10];
      }).filter((r) => (r[1] as number) > 0);
      return { heads: ["Movement type", "Entries", "Cartons in", "Cartons out", "Cartons moved or held"], rows, right: [1, 2, 3, 4], note: "Every stock movement in the period, summed by type. Open the Movement ledger on the Stock page for each line." };
    }
    if (tab === "grn") {
      const rows = grns.filter((g) => g.arrivedAt >= from).sort((a, b) => b.arrivedAt - a.arrivedAt).map((g) => [g.folio, g.supplier, g.deliveryNote, g.vehicle, g.lines.reduce((t, l) => t + l.arrived, 0), g.lines.reduce((t, l) => t + l.rejected, 0), g.lines.reduce((t, l) => t + l.damaged, 0), g.lines.reduce((t, l) => t + l.held, 0), g.lines.reduce((t, l) => t + good(l), 0), g.status === "approved" ? "Approved" : g.status === "counted" ? "To approve" : "Counting", g.by, dt(g.arrivedAt)]);
      return { heads: ["GRN", "Supplier", "Delivery note", "Vehicle", "Arrived", "Rejected", "Damaged", "Held", "Good", "Status", "By", "Date"], rows, right: [4, 5, 6, 7, 8], note: "Cartons per delivery." };
    }
    if (tab === "dispatch") {
      const rows = trips.filter((t) => t.createdAt >= from).map((t) => { const os = t.orderIds.map((id) => orders.find((o) => o.id === id)!).filter(Boolean); return [t.folio, t.vehicle, users.find((u) => u.id === t.driverId)?.name ?? "", users.find((u) => u.id === t.keId)?.name ?? "", os.length, os.reduce((s, o) => s + (o.cartons ?? 0), 0), dt(t.dispatchedAt), t.seal ?? "—", t.gatePass ?? "—", t.status === "loading" ? "Loading" : t.status === "out" ? "On the road" : "Settled"]; });
      return { heads: ["Trip", "Vehicle", "Driver", "KE", "Invoices", "Cartons", "Left", "Seal", "Gate pass", "Status"], rows, right: [4, 5], note: "Every truck released from the depot." };
    }
    if (tab === "pick") {
      const picked = orders.filter((o) => o.pickedBy && (o.trail.find((t) => t.status === "picked")?.at ?? o.createdAt) >= from);
      const who = Array.from(new Set(picked.map((o) => o.pickedBy!)));
      const rows = who.map((w) => {
        const os = picked.filter((o) => o.pickedBy === w);
        const lines = os.reduce((t, o) => t + o.lines.length, 0);
        const short = os.reduce((t, o) => t + o.lines.filter((l) => l.shortReason).length, 0);
        const scan = os.reduce((t, o) => t + (o.pickStats?.scan ?? 0), 0), man = os.reduce((t, o) => t + (o.pickStats?.manual ?? 0), 0);
        return [users.find((u) => u.initials === w)?.name ?? w, os.length, lines, short, lines ? `${Math.round((short / lines) * 100)}%` : "—", scan, man, scan + man ? `${Math.round((scan / (scan + man)) * 100)}%` : "—"];
      });
      return { heads: ["Picker", "Orders", "Lines", "Short lines", "Short %", "Stops scanned", "Stops manual", "Scan rate"], rows, right: [1, 2, 3, 4, 5, 6, 7], note: "Short lines are lines picked below the ordered quantity. Scan rate is the share of stops confirmed by scanning instead of by hand. Wave picks do not record scan counts." };
    }
    if (tab === "counts") {
      const rows = counts.filter((c) => c.status === "posted" && (c.postedAt ?? 0) >= from).map((c) => { const matched = c.lines.filter((l) => lineDelta(l) === 0).length; const diffs = c.lines.length - matched; const pcs = c.lines.reduce((t, l) => t + Math.abs(lineDelta(l)), 0); return [c.folio, c.mode === "full" ? "Full stock take" : "Count", c.lines.length, matched, `${Math.round((matched / c.lines.length) * 100)}%`, diffs, pcs, dt(c.postedAt), c.by]; });
      const byCode = Object.entries(ADJ_CODES).map(([k, l]) => { const xs = adjustments.filter((a) => a.code === k && a.at >= from); return xs.length ? `${l}: ${xs.length}` : ""; }).filter(Boolean).join(" · ");
      return { heads: ["Count", "Type", "Lines", "Matched", "Accuracy", "Differences", "Pieces off", "Posted", "By"], rows, right: [2, 3, 4, 5, 6], note: `Adjustments by reason in this period: ${byCode || "none"}.` };
    }
    if (tab === "returns") {
      const rows = returns.filter((r) => r.at >= from).map((r) => [r.folio, P(r.productId)?.name ?? "", customers.find((c) => c.id === r.customerId)?.name ?? "", r.receivedQty ?? r.qtyPcs, r.reason, r.status === "graded" ? "Graded" : r.status === "received" ? "To grade" : "On the way", r.disposition ? ({ restock: "Back to stock", deal: "Stock as a deal", supplier: "To supplier", destroy: "Destroy" } as Record<string, string>)[r.disposition] : "—", ...(money ? [r.credit ? Math.round(r.value ?? 0) : 0] : [])]);
      return { heads: ["Return", "Product", "Customer", "Pieces", "Reason", "Status", "Outcome", ...(money ? ["Credit note"] : [])], rows, right: [3, 7], note: "Customer returns in the period." };
    }
    const rows = products.filter((p) => p.damaged > 0 || p.quarantine.length > 0 || destructions.some((d) => d.productId === p.id && (d.status === "pending" || d.status === "approved"))).map((p) => {
      const held = p.quarantine.reduce((s, b) => s + b.qty, 0);
      const des = destructions.filter((d) => d.productId === p.id && (d.status === "pending" || d.status === "approved")).reduce((s, d) => s + d.qtyPcs, 0);
      return [p.name, p.supplier, p.damaged, held, des, ...(money ? [Math.round(((p.damaged + held + des) / p.packSize) * p.costPrice)] : [])];
    });
    return { heads: ["Product", "Supplier", "Damaged (pcs)", "On hold (pcs)", "To destroy (pcs)", ...(money ? ["Value at cost"] : [])], rows, right: [2, 3, 4, 5], note: "Stock that cannot be sold: damaged, on quality hold, or waiting to be destroyed." };
  }, [tab, range, products, ledger, grns, trips, orders, users, counts, returns, customers, destructions, adjustments, money, from]);

  const exportCsv = () => {
    const q = (v: Cell) => `"${String(v).replace(/"/g, '""')}"`;
    const url = URL.createObjectURL(new Blob([[report.heads, ...report.rows].map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `warehouse-${tab}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const tabs: [Tab, string][] = [["stock", "Stock summary"], ["moves", "Movements"], ["grn", "Goods received"], ["dispatch", "Dispatch register"], ["pick", "Pick accuracy"], ["counts", "Count accuracy"], ["returns", "Returns"], ["damaged", "Damaged & held"]];
  const timed = tab !== "stock" && tab !== "damaged";

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap rounded-xl border border-line bg-panel p-1">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`h-7 rounded-lg px-3 text-[12.5px] font-semibold ${tab === k ? "bg-accent text-accentink" : "text-ink2"}`}>{l}</button>)}</div>
        {timed && <Chips value={range} onChange={setRange} items={[{ k: "7", label: "7 days" }, { k: "30", label: "30 days" }, { k: "90", label: "90 days" }, { k: "all", label: "Everything" }]} />}
        <button className="btn ml-auto" onClick={exportCsv} disabled={!report.rows.length}><Download size={14} /> Export CSV</button>
      </div>
      {report.note && <div className="text-xs text-ink2">{report.note}{!money && " Prices are not shown to warehouse staff."}</div>}
      <div className="panel min-h-0 flex-1 overflow-auto">
        {report.rows.length === 0 ? <Empty title="Nothing in this period" hint="Try a longer date range." action={timed ? { label: "Show everything", onClick: () => setRange("all") } : undefined} /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 z-10 bg-panel text-left">{report.heads.map((h, i) => <th key={h} className={`${i === 0 ? "px-4" : ""} py-2.5 ${report.right?.includes(i) ? "text-right" : ""} ${i > 0 ? "pl-3" : ""} ${i === report.heads.length - 1 ? "pr-4" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>{report.rows.map((r, i) => <tr key={i} className="row-hover border-t border-line">{r.map((c, j) => <td key={j} className={`${j === 0 ? "px-4 font-medium" : "pl-3"} py-2 ${j === r.length - 1 ? "pr-4" : ""} ${report.right?.includes(j) ? "num text-right" : ""} ${typeof c === "number" ? "num" : ""}`}>{typeof c === "number" && report.right?.includes(j) ? fmt(c) === String(Math.round(c)) && c % 1 === 0 ? fmt(c) : c : c}</td>)}</tr>)}</tbody>
            {report.totals && <tfoot><tr className="border-t-2 border-line font-semibold">{report.totals.map((c, j) => <td key={j} className={`${j === 0 ? "px-4" : "pl-3"} num py-2.5 ${j === (report.totals?.length ?? 0) - 1 ? "pr-4" : ""} ${report.right?.includes(j) ? "text-right" : ""}`}>{typeof c === "number" ? fmt(c) : c}</td>)}</tr></tfoot>}
          </table>
        )}
      </div>
    </div>
  );
}
