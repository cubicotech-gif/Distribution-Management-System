"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { ago, available, fmt, orderTotal } from "@/lib/calc";

export default function Dashboard() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const activity = useStore((s) => s.activity);
  const purchases = useStore((s) => s.purchases);
  const sales = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + orderTotal(o), 0);
  const stages = [
    ["Needs approval", orders.filter((o) => o.status === "booked" || o.status === "hold").length, "/orders"],
    ["In warehouse", orders.filter((o) => o.status === "approved").length, "/pick"],
    ["Ready to invoice", orders.filter((o) => o.status === "picked").length, "/invoices"],
    ["Out for delivery", orders.filter((o) => o.status === "invoiced").length, "/invoices"],
    ["Awaiting payment", orders.filter((o) => o.status === "delivered").length, "/recovery"],
  ] as const;
  const low = products.filter((p) => available(p) < p.reorder);
  const late = customers.filter((c) => c.balance > 0 && c.oldestDue > c.creditDays).sort((a, b) => b.oldestDue - a.oldestDue).slice(0, 4);
  const grn = purchases.filter((p) => p.status === "received").length;
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="text-[22px] font-bold">Good morning</h1>
        <p className="text-ink2">{orders.length} orders in the system worth <span className="num font-semibold text-ink">Rs. {fmt(sales)}</span>. {grn > 0 && <>{grn} delivery waiting for approval. </>}{low.length} items below reorder level.</p>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {stages.map(([l, n, href]) => (
          <Link key={l} href={href} className="panel p-4 transition hover:border-accent">
            <div className="th">{l}</div><div className="num mt-1 text-[28px] font-bold">{n}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-4">
          <div className="mb-2 text-[13px] font-semibold">Needs attention: low stock</div>
          {low.length === 0 && <div className="text-ink3">All good</div>}
          {low.map((p) => <div key={p.id} className="flex justify-between border-t border-line py-1.5 first:border-0"><span>{p.name}</span><span className="num chip chip-warn">{Math.floor(available(p) / p.packSize)} ctn</span></div>)}
        </div>
        <div className="panel p-4">
          <div className="mb-2 text-[13px] font-semibold">Overdue customers</div>
          {late.map((c) => <div key={c.id} className="flex justify-between border-t border-line py-1.5 first:border-0"><span>{c.name}</span><span className="num chip chip-bad">{c.oldestDue}d · {fmt(c.balance / 1000)}k</span></div>)}
        </div>
        <div className="panel p-4">
          <div className="mb-2 text-[13px] font-semibold">Live activity</div>
          {activity.length === 0 && <div className="text-ink3">Actions across all roles show up here as they happen.</div>}
          {activity.slice(0, 7).map((a) => <div key={a.id} className="slidein border-t border-line py-1.5 text-xs first:border-0"><span className="text-ink3">{ago(a.at)}</span> · {a.text}</div>)}
        </div>
      </div>
    </div>
  );
}
