"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { available, monthsLeft, pcsOf } from "@/lib/calc";
import { DOCK, binUsed, replenishments } from "@/lib/locations";
import { abcClasses, dueInfo } from "@/lib/counts";
import { Card, Row, Tile } from "../dash";
import { useState } from "react";
import { useUser } from "@/lib/store";
import { ago } from "@/lib/calc";
import { toast } from "../ui";

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
  const bins = useStore((s) => s.bins);
  const dock = products.flatMap((p) => p.batches.filter((b) => b.bin === DOCK && b.qty > 0));
  const full = bins.filter((b) => !b.blocked && binUsed(products, b.code) > b.capacity + 0.001).length;
  const repl = replenishments(products, bins).length;
  const held = products.reduce((s, p) => s + p.quarantine.reduce((a, q) => a + q.qty / p.packSize, 0), 0);
  const toPack = orders.filter((o) => o.status === "picked" && !o.packed);
  const heldPicks = orders.filter((o) => o.status === "approved" && o.pickHold);
  const cl = abcClasses(products);
  const countsDue = products.filter((p) => p.status !== "unlisted" && p.batches.some((b) => b.qty > 0) && dueInfo(p, cl[p.id]).due).length;
  const openCounts = useStore((s) => s.counts).filter((c) => c.status === "counting" || c.status === "review").length;
  const dispatch = orders.filter((o) => o.status === "invoiced" && !o.tripId);
  const loading = trips.filter((t) => t.status === "loading");
  const rets = returns.filter((r) => r.status !== "graded");
  const damaged = products.filter((p) => p.damaged > 0);
  const near = products.flatMap((p) => p.batches.filter((b) => monthsLeft(b.expiry) <= 2).map((b) => ({ p, b })));
  const low = products.filter((p) => available(p) < p.reorder);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
      <div><h1 className="text-[22px] font-bold">Warehouse floor</h1><p className="text-ink2">Today&apos;s physical work: receive, pick, load, inspect returns.</p></div>
      <div className="grid grid-cols-5 gap-3">
        <Tile label="Trucks due" value={inbound.length} sub={late.length ? `${late.length} late. ${counting.length} being counted` : `${counting.length} being counted`} href="/receiving" tone={late.length ? "warn" : undefined} />
        <Tile label="To put away" value={dock.length} sub={full || repl ? `${full ? full + " bins over capacity. " : ""}${repl ? repl + " pick faces to refill" : ""}` : "Batches at the dock"} href="/putaway" tone={dock.length ? "warn" : undefined} />
        <Tile label="Orders to pick" value={toPick.length} sub={heldPicks.length ? `${heldPicks.length} on hold` : `${Math.round(cartons)} cartons`} href="/pick" tone={toPick.length ? "ok" : undefined} />
        <Tile label="To pack and check" value={toPack.length} sub={toPack.length ? "Picked, waiting for the packing check" : "Packing table is clear"} href="/pack" tone={toPack.length ? "warn" : undefined} />
        <Tile label="Invoices to load" value={dispatch.length} sub={`${loading.length} load sheets open`} href="/dispatch" />
        <Tile label="Counts due" value={countsDue} sub={openCounts ? `${openCounts} count in progress` : "By ABC schedule"} href="/counts" tone={countsDue ? "warn" : undefined} />
        <Tile label="Returns to inspect" value={rets.length} sub="Decide good or damaged" href="/returns" tone={rets.length ? "warn" : undefined} />
        <Tile label="Damaged / on hold" value={`${Math.round(damaged.reduce((s, p) => s + p.damaged / p.packSize, 0) * 10) / 10} / ${Math.round(held * 10) / 10}`} sub="Cartons: damaged · quality hold" href="/receiving" />
      </div>
      <HandoverCard summary={`Open now: ${toPick.length} order${toPick.length === 1 ? "" : "s"} to pick, ${toPack.length} to pack, ${inbound.length} truck${inbound.length === 1 ? "" : "s"} due, ${countsDue} count${countsDue === 1 ? "" : "s"} due.`} />
      <div className="grid grid-cols-3 gap-3">
        <Card title="Sell these first (expiring)" action={<Link href="/stock?tab=expiry" className="text-xs font-semibold text-accent">Expiry actions</Link>}>
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

function HandoverCard({ summary }: { summary: string }) {
  const hs = useStore((s) => s.handovers);
  const add = useStore((s) => s.addHandover);
  const ack = useStore((s) => s.ackHandover);
  const user = useUser();
  const me = user?.initials ?? "—";
  const isWh = user?.role === "warehouse";
  const [text, setText] = useState("");
  const [imp, setImp] = useState(false);
  const unread = hs.filter((h) => !h.ackBy.includes(me)).length;
  return (
    <Card title="Shift handover" action={isWh && unread > 0 ? <span className="chip chip-warn">{unread} unread</span> : undefined}>
      {isWh && (
        <div className="mb-3 rounded-xl border border-line bg-panel2 p-3">
          <textarea className="field h-[64px] resize-none py-2" placeholder="Leave a note for the next shift: blocked racks, late trucks, things to watch…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => setText((t) => (t ? t + "\n" : "") + summary)}>Add today&apos;s numbers</button>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={imp} onChange={(e) => setImp(e.target.checked)} /> Mark as important</label>
            <button className="btn btn-primary ml-auto" disabled={text.trim().length < 5} onClick={() => { add(text.trim(), imp, me); setText(""); setImp(false); toast("Note left for the next shift"); }}>Leave note</button>
          </div>
        </div>
      )}
      {hs.length === 0 && <div className="py-3 text-ink3">No notes yet.</div>}
      {hs.slice(0, 5).map((h) => (
        <div key={h.id} className={`slidein border-t border-line py-2.5 first:border-0 ${h.important ? "" : ""}`}>
          <div className="flex items-center gap-2 text-xs"><span className="font-semibold">{h.by}</span><span className="text-ink3">{h.shift} shift · {ago(h.at)}</span>{h.important && <span className="chip chip-bad">Important</span>}{isWh && !h.ackBy.includes(me) && <span className="h-2 w-2 rounded-full bg-accent" title="You have not read this" />}
            <span className="ml-auto text-[11px] text-ink3">Read by {h.ackBy.join(", ")}</span></div>
          <div className="mt-1 whitespace-pre-line text-[13px] text-ink2">{h.text}</div>
          {isWh && !h.ackBy.includes(me) && <button className="btn mt-1.5 h-7" onClick={() => ack(h.id, me)}>Mark as read</button>}
        </div>
      ))}
    </Card>
  );
}
