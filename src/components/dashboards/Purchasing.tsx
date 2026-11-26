"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { ago, available, coverDays, fmt, monthsLeft, short } from "@/lib/calc";
import { claimsOf } from "@/lib/grn";
import { Card, Row, Tile } from "../dash";

export default function Purchasing() {
  const products = useStore((s) => s.products);
  const purchases = useStore((s) => s.purchases);
  const grns = useStore((s) => s.grns);
  const supplierReturns = useStore((s) => s.supplierReturns);

  const needs = products.filter((p) => coverDays(p) < p.leadDays + 3);
  const open = purchases.filter((p) => p.status === "ordered" || p.status === "partial");
  const grn = grns.filter((g) => g.status === "counted");
  const claims = claimsOf(grns, purchases, products);
  const claimValue = claims.reduce((s, c) => s + (c.short + c.line.rejected + c.line.damaged + c.line.held) * c.product.costPrice, 0);
  const damaged = products.filter((p) => p.damaged > 0);
  const near = products.flatMap((p) => p.batches.filter((b) => monthsLeft(b.expiry) <= 2).map((b) => ({ p, b })));
  const suppliers = Array.from(new Set(products.map((p) => p.supplier)));

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div><h1 className="text-[22px] font-bold">Purchasing</h1><p className="text-ink2">Order from factories before stock runs out, approve what arrives, return what is damaged.</p></div>
      <div className="grid grid-cols-4 gap-3">
        <Tile label="Order now" value={needs.length} sub="Stock will run out before the truck arrives" href="/planner" tone={needs.length ? "bad" : undefined} />
        <Tile label="Open factory orders" value={open.length} sub={`${open.filter((p) => p.expectedAt < Date.now() - 12 * 3600000).length} late`} href="/receiving" tone={open.some((p) => p.expectedAt < Date.now() - 12 * 3600000) ? "warn" : undefined} />
        <Tile label="GRN to approve" value={grn.length} sub="Counted by warehouse" href="/receiving" tone={grn.length ? "warn" : undefined} />
        <Tile label="Damaged to return" value={damaged.length} sub={`${supplierReturns.length} returns sent`} href="/supplier-returns" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card title="Days of stock left vs lead time" action={<Link href="/planner" className="text-xs font-semibold text-accent">Planner</Link>}>
          {[...products].sort((a, b) => coverDays(a) - coverDays(b)).slice(0, 6).map((p) => { const d = coverDays(p); return <Row key={p.id}><span>{p.name}</span><span className={`chip num ${d < p.leadDays ? "chip-bad" : d < p.leadDays + 3 ? "chip-warn" : "chip-ok"}`}>{d.toFixed(0)}d / lead {p.leadDays}d</span></Row>; })}
        </Card>
        <Card title="Claims against suppliers" action={<span className="num text-xs font-semibold">Rs. {fmt(claimValue)}</span>}>
          {claims.length === 0 && <div className="py-3 text-ink3">No short or damaged deliveries.</div>}
          {claims.slice(0, 5).map(({ grn: g, line: l, product: p, short: sh }, i) => <Row key={i}><div><div className="font-medium">{p.name}</div><div className="text-[11px] text-ink3">{g.supplier} · {g.folio}</div></div><span className="chip chip-bad num">{[sh && `short ${sh}`, l.rejected && `rejected ${l.rejected}`, l.damaged && `damaged ${l.damaged}`, l.held && `held ${l.held}`].filter(Boolean).join(" · ")}</span></Row>)}
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
