"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { ago, available, coverDays, monthsLeft, short } from "@/lib/calc";
import { Card, Row, Tile } from "../dash";

export default function Purchasing() {
  const products = useStore((s) => s.products);
  const purchases = useStore((s) => s.purchases);
  const supplierReturns = useStore((s) => s.supplierReturns);

  const needs = products.filter((p) => coverDays(p) < p.leadDays + 3);
  const open = purchases.filter((p) => p.status === "ordered");
  const grn = purchases.filter((p) => p.status === "received");
  const claims = purchases.flatMap((po) => po.lines.filter((l) => (l.received ?? l.ordered) < l.ordered || (l.damaged ?? 0) > 0).map((l) => ({ po, l })));
  const damaged = products.filter((p) => p.damaged > 0);
  const near = products.flatMap((p) => p.batches.filter((b) => monthsLeft(b.expiry) <= 2).map((b) => ({ p, b })));
  const suppliers = Array.from(new Set(products.map((p) => p.supplier)));

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div><h1 className="text-[22px] font-bold">Purchasing</h1><p className="text-ink2">Order from factories before stock runs out, approve what arrives, return what is damaged.</p></div>
      <div className="grid grid-cols-4 gap-3">
        <Tile label="Order now" value={needs.length} sub="Stock will run out before the truck arrives" href="/planner" tone={needs.length ? "bad" : undefined} />
        <Tile label="Open factory orders" value={open.length} sub="On the way" href="/receiving" />
        <Tile label="GRN to approve" value={grn.length} sub="Counted by warehouse" href="/receiving" tone={grn.length ? "warn" : undefined} />
        <Tile label="Damaged to return" value={damaged.length} sub={`${supplierReturns.length} returns sent`} href="/supplier-returns" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card title="Days of stock left vs lead time" action={<Link href="/planner" className="text-xs font-semibold text-accent">Planner</Link>}>
          {[...products].sort((a, b) => coverDays(a) - coverDays(b)).slice(0, 6).map((p) => { const d = coverDays(p); return <Row key={p.id}><span>{p.name}</span><span className={`chip num ${d < p.leadDays ? "chip-bad" : d < p.leadDays + 3 ? "chip-warn" : "chip-ok"}`}>{d.toFixed(0)}d / lead {p.leadDays}d</span></Row>; })}
        </Card>
        <Card title="Claims against suppliers">
          {claims.length === 0 && <div className="py-3 text-ink3">No short or damaged deliveries.</div>}
          {claims.map(({ po, l }, i) => { const p = products.find((x) => x.id === l.productId)!; return <Row key={i}><div><div className="font-medium">{p.name}</div><div className="text-[11px] text-ink3">{po.supplier} · {po.folio}</div></div><span className="chip chip-bad num">{(l.received ?? l.ordered) < l.ordered ? `Short ${l.ordered - (l.received ?? 0)}` : ""} {(l.damaged ?? 0) > 0 ? `Damaged ${l.damaged}` : ""}</span></Row>; })}
        </Card>
        <Card title="Suppliers">
          {suppliers.map((s) => <Row key={s}><span>{s}</span><span className="num text-xs text-ink2">{purchases.filter((p) => p.supplier === s).length} orders</span></Row>)}
          <div className="mt-2 text-[11px] text-ink3">{near.length} batches expire within 2 months. Ask the supplier for replacement or credit.</div>
        </Card>
      </div>
      <div className="hidden">{short(0)}{ago(0)}{available(products[0])}</div>
    </div>
  );
}
