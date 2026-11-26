"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { available, monthsLeft, pcsOf } from "@/lib/calc";
import { Card, Row, Tile } from "../dash";

export default function Warehouse() {
  const orders = useStore((s) => s.orders);
  const products = useStore((s) => s.products);
  const purchases = useStore((s) => s.purchases);
  const grns = useStore((s) => s.grns);
  const returns = useStore((s) => s.returns);
  const trips = useStore((s) => s.trips);

  const toPick = orders.filter((o) => o.status === "approved");
  const cartons = toPick.reduce((s, o) => s + o.lines.reduce((a, l) => a + pcsOf(l, products.find((p) => p.id === l.productId)!) / products.find((p) => p.id === l.productId)!.packSize, 0), 0);
  const endToday = new Date().setHours(23, 59, 59, 999);
  const startToday = new Date().setHours(0, 0, 0, 0);
  const inbound = purchases.filter((p) => (p.status === "ordered" || p.status === "partial") && p.expectedAt <= endToday);
  const late = inbound.filter((p) => p.expectedAt < startToday);
  const counting = grns.filter((g) => g.status === "counting");
  const held = products.reduce((s, p) => s + p.quarantine.reduce((a, q) => a + q.qty / p.packSize, 0), 0);
  const dispatch = orders.filter((o) => o.status === "invoiced" && !o.tripId);
  const loading = trips.filter((t) => t.status === "loading");
  const rets = returns.filter((r) => r.status === "pending");
  const damaged = products.filter((p) => p.damaged > 0);
  const near = products.flatMap((p) => p.batches.filter((b) => monthsLeft(b.expiry) <= 2).map((b) => ({ p, b })));
  const low = products.filter((p) => available(p) < p.reorder);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div><h1 className="text-[22px] font-bold">Warehouse floor</h1><p className="text-ink2">Today&apos;s physical work: receive, pick, load, inspect returns.</p></div>
      <div className="grid grid-cols-5 gap-3">
        <Tile label="Trucks due" value={inbound.length} sub={late.length ? `${late.length} late. ${counting.length} being counted` : `${counting.length} being counted`} href="/receiving" tone={late.length ? "warn" : undefined} />
        <Tile label="Orders to pick" value={toPick.length} sub={`${Math.round(cartons)} cartons`} href="/pick" tone={toPick.length ? "ok" : undefined} />
        <Tile label="Invoices to load" value={dispatch.length} sub={`${loading.length} load sheets open`} href="/dispatch" />
        <Tile label="Returns to inspect" value={rets.length} sub="Decide good or damaged" href="/returns" tone={rets.length ? "warn" : undefined} />
        <Tile label="Damaged / on hold" value={`${Math.round(damaged.reduce((s, p) => s + p.damaged / p.packSize, 0) * 10) / 10} / ${Math.round(held * 10) / 10}`} sub="Cartons: damaged · quality hold" href="/receiving" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card title="Sell these first (expiring)">
          {near.length === 0 && <div className="py-3 text-ink3">No near-expiry stock.</div>}
          {near.map(({ p, b }) => <Row key={b.id}><div><div className="font-medium">{p.name}</div><div className="num text-[11px] text-ink3">Batch {b.no} · rack {p.bin}</div></div><span className="chip chip-warn num">{b.expiry} · {Math.floor(b.qty / p.packSize)} ctn</span></Row>)}
          <div className="mt-2 text-[11px] text-ink3">Picking always takes the earliest expiry first (FEFO).</div>
        </Card>
        <Card title="Running low on the shelf" action={<Link href="/stock" className="text-xs font-semibold text-accent">Stock</Link>}>
          {low.map((p) => <Row key={p.id}><span>{p.name}</span><span className="chip chip-bad num">{Math.floor(available(p) / p.packSize)} ctn left</span></Row>)}
        </Card>
        <Card title="Suggested cycle count today">
          {[...products].sort((a, b) => b.stock * b.costPrice / b.packSize - a.stock * a.costPrice / a.packSize).slice(0, 4).map((p) => <Row key={p.id}><div><div className="font-medium">{p.name}</div><div className="num text-[11px] text-ink3">Rack {p.bin}</div></div><Link href="/stock" className="btn h-7">Count</Link></Row>)}
          <div className="mt-2 text-[11px] text-ink3">Highest value items first. Counting 4 a day covers the whole shelf every 3 days.</div>
        </Card>
      </div>
    </div>
  );
}
