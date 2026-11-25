"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt, pcsOf } from "@/lib/calc";
import { Avatar, Empty, Kbd, StatusChip, Thumb, toast } from "@/components/ui";
import Challan from "@/components/Challan";
import type { Order, Product } from "@/lib/types";

// which batches FEFO would take for this many pcs (preview only)
function preview(p: Product, pcs: number) {
  const out: { no: string; expiry: string; pcs: number }[] = [];
  let need = pcs;
  for (const b of [...p.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))) {
    if (need <= 0) break;
    const t = Math.min(b.qty, need);
    out.push({ no: b.no, expiry: b.expiry, pcs: t }); need -= t;
  }
  return out;
}

export default function Pick() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const users = useStore((s) => s.users);
  const pick = useStore((s) => s.pickOrder);
  const user = useUser();
  const by = user?.initials ?? "—";
  const queue = orders.filter((o) => o.status === "approved");
  const done = orders.filter((o) => o.status === "picked");
  const [sel, setSel] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, Record<number, number>>>({});
  const [why, setWhy] = useState<Record<string, Record<number, string>>>({});
  const [view, setView] = useState<Order | null>(null);
  const cur = queue.find((o) => o.id === sel) ?? queue[0];
  const c = cur && customers.find((x) => x.id === cur.customerId);

  const run = () => {
    if (!cur) return;
    pick(cur.id, vals[cur.id] ?? {}, why[cur.id] ?? {}, by);
    toast(`Challan created for ${cur.folio}. Back office can invoice it now`);
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  // group the queue by route so one picker can batch a route
  const byRoute = queue.reduce<Record<string, Order[]>>((m, o) => { const r = customers.find((x) => x.id === o.customerId)?.route ?? "—"; (m[r] ??= []).push(o); return m; }, {});

  return (
    <div className="grid h-full grid-cols-[minmax(300px,32%)_1fr] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="border-b border-line px-4 py-3">
          <div className="text-[14px] font-semibold">Pick queue</div>
          <div className="text-xs text-ink2">Approved orders, grouped by route</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {queue.length === 0 && <Empty title="Queue is clear" hint="Approved orders appear here instantly" />}
          {Object.entries(byRoute).map(([route, os]) => (
            <div key={route}>
              <div className="th bg-panel2 px-4 py-1.5">{route} · {os.length}</div>
              {os.map((o) => {
                const cc = customers.find((x) => x.id === o.customerId)!;
                return (
                  <button key={o.id} onClick={() => setSel(o.id)} className={`row-hover flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${cur?.id === o.id ? "row-sel" : ""}`}>
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{cc.name}</div><div className="num text-[11px] text-ink3">{o.folio} · {o.lines.length} lines · {ago(o.createdAt)}</div></div>
                    <StatusChip status={o.status} />
                  </button>
                );
              })}
            </div>
          ))}
          {done.length > 0 && <div className="th px-4 pb-1 pt-4">Challans created</div>}
          {done.map((o) => (
            <button key={o.id} onClick={() => setView(o)} className="row-hover flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left text-ink2">
              <span className="num flex-1">{o.challanNo} · {customers.find((x) => x.id === o.customerId)?.name}</span><Printer size={14} />
            </button>
          ))}
        </div>
      </div>

      <div className="panel flex min-h-0 flex-col">
        {!cur || !c ? <Empty title="Nothing to pick" /> : (
          <>
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5"><h2 className="text-[20px] font-bold">{c.name}</h2><StatusChip status={cur.status} /></div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-ink2"><span className="num">{cur.folio}</span> · {c.area} · {c.route} · booked by <Avatar initials={users.find((u) => u.id === cur.bookerId)?.initials ?? ""} size={16} /></div>
              <div className="mt-2 text-xs text-ink2">Lines are sorted by rack so you walk the warehouse once. Take the batch shown (earliest expiry first). If the shelf has less, enter what you found and why.</div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              <table className="w-full text-[12.5px]">
                <thead><tr className="th text-left"><th className="py-2">Rack</th><th>Product</th><th>Take from batch</th><th className="text-right">Ordered</th><th className="text-right">On shelf</th><th className="text-right">Picked</th></tr></thead>
                <tbody>
                  {cur.lines.map((l, i) => ({ l, i, p: products.find((x) => x.id === l.productId)! })).sort((a, b) => a.p.bin.localeCompare(b.p.bin)).map(({ l, i, p }) => {
                    const shelfPcs = p.stock;
                    const shelf = Math.floor(shelfPcs / (l.unit === "ctn" ? p.packSize : 1));
                    const v = vals[cur.id]?.[i] ?? Math.min(l.qty, shelf);
                    const take = preview(p, pcsOf({ ...l, qty: v }, p));
                    return (
                      <tr key={i} className="border-t border-line align-top">
                        <td className="num py-2 font-semibold">{p.bin}</td>
                        <td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><div><div className="font-medium">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · {l.unit.toUpperCase()}</div></div></div></td>
                        <td className="py-2">{take.map((t) => <div key={t.no} className="num text-[11.5px]"><span className="font-semibold">{t.no}</span> <span className="text-ink3">exp {t.expiry}</span> · {fmt(t.pcs / (l.unit === "ctn" ? p.packSize : 1))}</div>)}</td>
                        <td className="num py-2 text-right font-semibold">{l.qty}</td>
                        <td className="py-2 text-right"><span className={`chip num ${shelf < l.qty ? "chip-bad" : "chip-ok"}`}>{fmt(shelf)}</span></td>
                        <td className="w-44 py-2 text-right">
                          <input className="cell num font-semibold" style={{ borderColor: v < l.qty ? "var(--bad-fg)" : undefined }} type="number" min={0} max={l.qty} value={v}
                            onChange={(e) => setVals({ ...vals, [cur.id]: { ...(vals[cur.id] ?? {}), [i]: Math.max(0, Math.min(l.qty, +e.target.value)) } })} />
                          {v < l.qty && (
                            <select className="field mt-1 h-7 text-[11px]" value={why[cur.id]?.[i] ?? "Not enough on shelf"} onChange={(e) => setWhy({ ...why, [cur.id]: { ...(why[cur.id] ?? {}), [i]: e.target.value } })}>
                              {["Not enough on shelf", "Damaged units", "Near expiry, held back", "Counted wrong earlier"].map((r) => <option key={r}>{r}</option>)}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <div className="text-xs text-ink2">Stock is deducted by batch, the challan is created and back office is notified</div>
              <button className="btn btn-primary h-9 px-4 text-[13px]" onClick={run}>Confirm and create challan <Kbd>Ctrl</Kbd><Kbd>↵</Kbd></button>
            </div>
          </>
        )}
      </div>
      {view && <Challan o={view} onClose={() => setView(null)} />}
    </div>
  );
}

