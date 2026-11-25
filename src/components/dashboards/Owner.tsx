"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { ago, available, fmt, invoiced, monthsLeft, orderTotal, overdueAmount, short } from "@/lib/calc";
import { HISTORY } from "@/lib/seed";
import { Card, Row, Tile, Bars } from "../dash";
import { Avatar, Meter } from "../ui";

export default function Owner() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const users = useStore((s) => s.users);
  const payments = useStore((s) => s.payments);
  const approvals = useStore((s) => s.approvals).filter((a) => a.status === "pending");
  const activity = useStore((s) => s.activity);

  const k = useMemo(() => {
    const live = orders.filter((o) => o.status !== "cancelled");
    const mid = new Date(); mid.setHours(0, 0, 0, 0);
    const today = live.filter((o) => o.createdAt >= mid.getTime()).reduce((s, o) => s + orderTotal(o), 0);
    const bookers = users.filter((u) => u.role === "booker");
    const target = bookers.reduce((s, u) => s + (u.target ?? 0), 0);
    const mtd = bookers.reduce((s, u) => s + (u.baseline ?? 0), 0) + live.reduce((s, o) => s + orderTotal(o), 0);
    const recv = customers.reduce((s, c) => s + c.balance, 0);
    const over = customers.reduce((s, c) => s + overdueAmount(orders, c), 0);
    const stockVal = products.reduce((s, p) => s + (p.stock / p.packSize) * p.costPrice, 0);
    const nearVal = products.reduce((s, p) => s + p.batches.filter((b) => monthsLeft(b.expiry) <= 2).reduce((a, b) => a + (b.qty / p.packSize) * p.costPrice, 0), 0);
    let rev = 0, cost = 0;
    for (const o of live.filter(invoiced)) for (const l of o.lines) {
      const p = products.find((x) => x.id === l.productId); if (!p) continue;
      rev += l.qty * l.rate * (1 - l.discPct / 100);
      cost += l.qty * (l.unit === "ctn" ? p.costPrice : p.costPrice / p.packSize);
    }
    const margin = rev ? ((rev - cost) / rev) * 100 : 0;
    const cyc = live.filter((o) => o.trail.some((t) => t.status === "delivered")).map((o) => (o.trail.find((t) => t.status === "delivered")!.at - o.createdAt) / 3600000);
    const cycle = cyc.length ? cyc.reduce((a, b) => a + b, 0) / cyc.length : 0;
    const collected = 3_240_000 + payments.reduce((s, p) => s + p.amount, 0);
    return { today, mtd, target, recv, over, stockVal, nearVal, margin, cycle, collected, bookers, live };
  }, [orders, customers, products, users, payments]);

  const days = [...HISTORY, k.today || 0];
  const labels = days.map((_, i) => { const d = new Date(Date.now() - (days.length - 1 - i) * 86400000); return String(d.getDate()); });
  const expiring = products.flatMap((p) => p.batches.filter((b) => monthsLeft(b.expiry) <= 2).map((b) => ({ p, b }))).slice(0, 5);
  const topOver = customers.map((c) => ({ c, o: overdueAmount(orders, c) })).filter((x) => x.o > 0).sort((a, b) => b.o - a.o).slice(0, 4);

  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-4">
      <div className="flex items-end justify-between">
        <div><h1 className="text-[22px] font-bold">Business overview</h1><p className="text-ink2">Read-only view. Departments run their own work; you step in only for exceptions.</p></div>
        {approvals.length > 0 && <Link href="/approvals" className="btn btn-primary">{approvals.length} waiting for your approval →</Link>}
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Tile label="Sales today" value={`Rs. ${short(k.today)}`} sub="All booked orders incl. tax" />
        <Tile label="Month to date" value={`Rs. ${short(k.mtd)}`} sub={<>{Math.round((k.mtd / k.target) * 100)}% of Rs. {short(k.target)} target</>} />
        <Tile label="Receivables" value={`Rs. ${short(k.recv)}`} sub={<span style={{ color: "var(--bad-fg)" }}>Rs. {short(k.over)} overdue</span>} href="/reports" />
        <Tile label="Collected this month" value={`Rs. ${short(k.collected)}`} sub="Cash, cheque and online" />
        <Tile label="Stock value (cost)" value={`Rs. ${short(k.stockVal)}`} sub={`${products.length} products`} href="/stock" />
        <Tile label="Expiry risk" value={`Rs. ${short(k.nearVal)}`} sub="Expiring within 2 months" tone={k.nearVal > 0 ? "warn" : undefined} href="/stock" />
        <Tile label="Gross margin" value={`${k.margin.toFixed(1)}%`} sub="On invoiced orders" tone="ok" />
        <Tile label="Order to delivery" value={`${k.cycle.toFixed(1)} h`} sub="Average, booked to delivered" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card title="Sales, last 14 days" className="col-span-2"><Bars data={days} labels={labels} /></Card>
        <Card title="Needs your decision" action={<Link href="/approvals" className="text-xs font-semibold text-accent">Open</Link>}>
          {approvals.length === 0 && <div className="py-4 text-ink3">Nothing waiting. Credit, discount and stock-count exceptions will appear here.</div>}
          {approvals.slice(0, 4).map((a) => (
            <Row key={a.id}><div className="min-w-0"><div className="truncate font-medium">{a.text}</div><div className="truncate text-[11px] text-ink3">{a.detail}</div></div><span className="num shrink-0 font-semibold">{short(a.amount)}</span></Row>
          ))}
        </Card>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card title="Booker performance (month)">
          {k.bookers.map((b) => {
            const mine = k.live.filter((o) => o.bookerId === b.id).reduce((s, o) => s + orderTotal(o), 0);
            const ach = (b.baseline ?? 0) + mine;
            const pct = Math.round((ach / (b.target ?? 1)) * 100);
            return <Row key={b.id}><Avatar initials={b.initials} size={26} /><div className="flex-1"><div className="flex justify-between"><span className="font-medium">{b.name}</span><span className="num text-xs text-ink2">{pct}%</span></div><Meter pct={Math.min(100, pct)} tone={pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad"} /></div></Row>;
          })}
        </Card>
        <Card title="Overdue customers">
          {topOver.map(({ c, o }) => <Row key={c.id}><span>{c.name}</span><span className="num chip chip-bad">{short(o)} · {c.oldestDue}d</span></Row>)}
          {topOver.length === 0 && <div className="text-ink3">None</div>}
        </Card>
        <Card title="Stock that needs a decision">
          {expiring.map(({ p, b }) => <Row key={b.id}><span>{p.name}<span className="num ml-1.5 text-[11px] text-ink3">{b.no}</span></span><span className="chip chip-warn num">{b.expiry} · {Math.floor(b.qty / p.packSize)} ctn</span></Row>)}
          {products.filter((p) => available(p) < p.reorder).slice(0, 2).map((p) => <Row key={p.id}><span>{p.name}</span><span className="chip chip-bad num">Low · {Math.floor(available(p) / p.packSize)} ctn</span></Row>)}
        </Card>
      </div>
      <Card title="Live activity across departments">
        {activity.length === 0 && <div className="text-ink3">Everything the departments do shows up here as it happens.</div>}
        <div className="grid grid-cols-2 gap-x-6">
          {activity.slice(0, 8).map((a) => <div key={a.id} className="slidein border-t border-line py-1.5 text-xs"><span className="text-ink3">{ago(a.at)}</span> · {a.text}</div>)}
        </div>
      </Card>
      <div className="hidden">{fmt(0)}</div>
    </div>
  );
}
