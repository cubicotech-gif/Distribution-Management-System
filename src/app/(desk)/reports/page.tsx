"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { aging, BUCKETS, fmt, invoiced, lineNet, monthsLeft, orderTotal } from "@/lib/calc";

type Tab = "product" | "customer" | "booker" | "receivables" | "stock" | "returns";
const TABS: [Tab, string][] = [["product", "Sales by product"], ["customer", "Sales by customer"], ["booker", "Sales by booker"], ["receivables", "Receivables aging"], ["stock", "Stock & expiry"], ["returns", "Returns"]];

export default function Reports() {
  const orders = useStore((s) => s.orders).filter((o) => o.status !== "cancelled");
  const products = useStore((s) => s.products);
  const customers = useStore((s) => s.customers);
  const users = useStore((s) => s.users);
  const returns = useStore((s) => s.returns);
  const [tab, setTab] = useState<Tab>("product");

  const byProduct = useMemo(() => products.map((p) => {
    let qty = 0, rev = 0, cost = 0;
    for (const o of orders) for (const l of o.lines) if (l.productId === p.id) { const ctn = l.unit === "ctn" ? l.qty : l.qty / p.packSize; qty += ctn; rev += lineNet(l); cost += ctn * p.costPrice; }
    return { p, qty, rev, margin: rev ? ((rev - cost) / rev) * 100 : 0 };
  }).filter((x) => x.qty > 0).sort((a, b) => b.rev - a.rev), [orders, products]);

  const T = ({ heads, children }: { heads: string[]; children: React.ReactNode }) => (
    <table className="w-full text-[12.5px]"><thead><tr className="th sticky top-0 bg-panel text-left">{heads.map((h, i) => <th key={h} className={`${i === 0 ? "px-4" : ""} py-2.5 ${i > 0 ? "text-right" : ""}`}>{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
  );
  const td = "num text-right py-2";
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-panel p-1 self-start">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`h-7 rounded-lg px-3 text-[12.5px] font-semibold ${tab === k ? "bg-accent text-accentink" : "text-ink2"}`}>{l}</button>)}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        {tab === "product" && <T heads={["Product", "Cartons", "Sales (net)", "Margin"]}>{byProduct.map(({ p, qty, rev, margin }) => <tr key={p.id} className="border-t border-line"><td className="px-4 py-2 font-medium">{p.name}</td><td className={td}>{fmt(qty)}</td><td className={td}>{fmt(rev)}</td><td className={td}>{margin.toFixed(1)}%</td></tr>)}</T>}
        {tab === "customer" && <T heads={["Customer", "Orders", "Sales (incl. tax)"]}>{customers.map((c) => ({ c, os: orders.filter((o) => o.customerId === c.id) })).filter((x) => x.os.length).sort((a, b) => b.os.reduce((s, o) => s + orderTotal(o), 0) - a.os.reduce((s, o) => s + orderTotal(o), 0)).map(({ c, os }) => <tr key={c.id} className="border-t border-line"><td className="px-4 py-2 font-medium">{c.name}</td><td className={td}>{os.length}</td><td className={td}>{fmt(os.reduce((s, o) => s + orderTotal(o), 0))}</td></tr>)}</T>}
        {tab === "booker" && <T heads={["Booker", "Orders", "Sales (incl. tax)", "Target", "Achieved"]}>{users.filter((u) => u.role === "booker").map((b) => { const os = orders.filter((o) => o.bookerId === b.id); const s = os.reduce((a, o) => a + orderTotal(o), 0) + (b.baseline ?? 0); return <tr key={b.id} className="border-t border-line"><td className="px-4 py-2 font-medium">{b.name}</td><td className={td}>{os.length}</td><td className={td}>{fmt(s)}</td><td className={td}>{fmt(b.target ?? 0)}</td><td className={td}>{Math.round((s / (b.target ?? 1)) * 100)}%</td></tr>; })}</T>}
        {tab === "receivables" && <T heads={["Customer", ...BUCKETS.map((b) => `${b} days`), "Total"]}>{customers.filter((c) => c.balance > 0).map((c) => ({ c, a: aging(useStore.getState().orders, c) })).sort((x, y) => y.c.balance - x.c.balance).map(({ c, a }) => <tr key={c.id} className="border-t border-line"><td className="px-4 py-2 font-medium">{c.name}</td>{a.map((v, i) => <td key={i} className={td} style={{ color: i >= 2 && v > 0 ? "var(--bad-fg)" : undefined }}>{v ? fmt(v) : "—"}</td>)}<td className={`${td} font-semibold`}>{fmt(c.balance)}</td></tr>)}</T>}
        {tab === "stock" && <T heads={["Product", "On hand (ctn)", "Damaged (pcs)", "Value at cost", "Earliest expiry"]}>{products.map((p) => { const e = [...p.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))[0]; return <tr key={p.id} className="border-t border-line"><td className="px-4 py-2 font-medium">{p.name}</td><td className={td}>{fmt(p.stock / p.packSize)}</td><td className={td}>{p.damaged || "—"}</td><td className={td}>{fmt((p.stock / p.packSize) * p.costPrice)}</td><td className={td}>{e ? <span className={`chip ${monthsLeft(e.expiry) <= 2 ? "chip-warn" : "chip-mute"}`}>{e.expiry}</span> : "—"}</td></tr>; })}</T>}
        {tab === "returns" && <T heads={["Return", "Product", "Pcs", "Reason", "Status", "Credit note"]}>{returns.map((r) => <tr key={r.id} className="border-t border-line"><td className="px-4 py-2 font-medium num">{r.folio}</td><td className={td}>{products.find((p) => p.id === r.productId)?.name}</td><td className={td}>{r.qtyPcs}</td><td className={td}>{r.reason}</td><td className={td}>{r.status === "graded" ? ({ restock: "Restocked", deal: "Restocked as deal", supplier: "To supplier", destroy: "Destroyed" } as Record<string, string>)[r.disposition ?? ""] : r.status === "received" ? "Awaiting grading" : "On the way back"}</td><td className={td}>{r.value ? fmt(r.value) : "—"}</td></tr>)}</T>}
      </div>
      <div className="hidden">{String(invoiced)}</div>
    </div>
  );
}
