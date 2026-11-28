"use client";
import Link from "next/link";
import { useStore, useUser } from "@/lib/store";
import { fmt, orderTotal, overdueAmount, short, unpaidOrders, invoiceDate } from "@/lib/calc";
import { checkOrder } from "@/lib/check";
import { Card, Row, Tile } from "../dash";
import { toast } from "../ui";

export default function BackOffice() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const trips = useStore((s) => s.trips);
  const returns = useStore((s) => s.returns);
  const payments = useStore((s) => s.payments);
  const invoiceAll = useStore((s) => s.invoiceAll);
  const user = useUser();

  const booked = orders.filter((o) => o.status === "booked" || (o.status === "hold" && !o.needsOwner));
  const exceptions = booked.filter((o) => { const c = checkOrder(o, customers.find((x) => x.id === o.customerId), products); return c.over || c.short.length; });
  const waitingOwner = orders.filter((o) => o.status === "hold" && o.needsOwner);
  const ready = orders.filter((o) => o.status === "picked" && o.packed);
  const toSettle = trips.filter((t) => t.status === "out" && t.orderIds.every((id) => orders.find((o) => o.id === id)?.status !== "invoiced"));
  const mid = new Date(); mid.setHours(0, 0, 0, 0);
  const collected = payments.filter((p) => p.at >= mid.getTime()).reduce((s, p) => s + p.amount, 0);
  const chase = customers.map((c) => ({ c, o: overdueAmount(orders, c) })).filter((x) => x.o > 0).sort((a, b) => b.o - a.o).slice(0, 5);
  const backorders = orders.filter((o) => o.backorderOf && (o.status === "booked" || o.status === "hold")).length;
  const setStatus = useStore((s) => s.setCustomerStatus);
  const holdCandidates = customers.filter((c) => c.status !== "blocked" && c.type === "credit" && unpaidOrders(orders, c.id).some((o) => (Date.now() - invoiceDate(o)) / 86400000 > c.creditDays + 30)).slice(0, 4);
  const todayIso = new Date().toISOString().slice(0, 10);
  const promisesDue = customers.filter((c) => c.promise && c.promise.date <= todayIso && c.balance > 0).length;
  const chequesInHand = payments.filter((p) => p.mode === "cheque" && (p.cheque?.status ?? "received") === "received");
  const pendingCN = returns.filter((r) => r.status !== "graded").length;
  const unlisted = products.filter((p) => p.status === "unlisted");
  const arrived = unlisted.filter((p) => p.stock > 0);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div><h1 className="text-[22px] font-bold">Back office queue</h1><p className="text-ink2">Orders to approve, invoices to issue, money to chase. Clear the top row first.</p></div>
      <div className="grid grid-cols-6 gap-3">
        <Tile label="To approve" value={booked.length} sub={`${exceptions.length} with credit or stock issues`} href="/orders" tone={exceptions.length ? "warn" : undefined} />
        <Tile label="Waiting for owner" value={waitingOwner.length} sub="Credit, overdue or discount exceptions" href="/orders" />
        <Tile label="Ready to invoice" value={ready.length} sub="Challans from warehouse" href="/invoices" tone={ready.length ? "ok" : undefined} />
        <Tile label="Backorders" value={backorders} sub="Short items waiting for stock" href="/orders" tone={backorders ? "warn" : undefined} />
        <Tile label="Trips to settle" value={toSettle.length} sub="Match cash with KE" href="/settlements" />
        <Tile label="Waiting to be listed" value={unlisted.length} sub={arrived.length ? `${arrived.length} already arrived, bookers cannot sell them` : "On order, no price yet"} href="/products?tab=unlisted" tone={arrived.length ? "bad" : unlisted.length ? "warn" : undefined} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card title="Issue invoices" action={<button className="btn btn-primary h-7" disabled={!ready.length} onClick={() => { const n = invoiceAll(user?.initials ?? "—"); toast(`${n} invoices issued`); }}>Invoice all ({ready.length})</button>}>
          {ready.length === 0 && <div className="py-3 text-ink3">No challans waiting.</div>}
          {ready.map((o) => <Row key={o.id}><span className="min-w-0 truncate">{customers.find((c) => c.id === o.customerId)?.name}</span><span className="num font-semibold">{fmt(orderTotal(o))}</span></Row>)}
        </Card>
        <Card title="Chase these customers" action={<Link href="/recovery" className="text-xs font-semibold text-accent">Recovery</Link>}>
          {chase.map(({ c, o }) => <Row key={c.id}><div><div className="font-medium">{c.name}</div><div className="text-[11px] text-ink3">{c.route}</div></div><span className="num chip chip-bad">{short(o)} overdue</span></Row>)}
        </Card>
        <Card title="Consider a credit hold">
          {holdCandidates.length === 0 && <div className="py-3 text-ink3">Nobody is 30 days past their credit terms.</div>}
          {holdCandidates.map((c) => <Row key={c.id}><div className="min-w-0"><div className="truncate font-medium">{c.name}</div><div className="text-[11px] text-ink3">{c.creditDays} day terms</div></div><button className="btn h-7" onClick={() => { setStatus([c.id], "blocked", "30+ days past credit terms"); toast(`${c.name} on credit hold`, { undo: () => setStatus([c.id], "active") }); }}>Hold</button></Row>)}
        </Card>
        <Card title="Today so far">
          <Row><span>Collected</span><span className="num font-semibold">Rs. {fmt(collected)}</span></Row>
          <Row><span>Invoices issued</span><span className="num font-semibold">{orders.filter((o) => o.trail.some((t) => t.status === "invoiced" && t.at >= mid.getTime())).length}</span></Row>
          <Row><span>Promises due or missed</span><Link href="/recovery" className="num font-semibold text-accent">{promisesDue}</Link></Row>
          <Row><span>Cheques not yet banked</span><Link href="/accounts" className="num font-semibold text-accent">{chequesInHand.length} · Rs. {fmt(chequesInHand.reduce((a, p) => a + p.amount, 0))}</Link></Row>
          <Row><span>Returns waiting for warehouse</span><span className="num font-semibold">{pendingCN}</span></Row>
          <Row><span>Active credit customers</span><span className="num font-semibold">{customers.filter((c) => c.type === "credit").length}</span></Row>
        </Card>
      </div>
    </div>
  );
}
