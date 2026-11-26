"use client";
import { useState } from "react";
import { Printer, Truck } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, pcsOf } from "@/lib/calc";
import { Avatar, Empty, Modal, Spinner, toast, useBusy } from "@/components/ui";
import type { Trip } from "@/lib/types";

export default function Dispatch() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const users = useStore((s) => s.users);
  const trips = useStore((s) => s.trips);
  const createTrip = useStore((s) => s.createTrip);
  const dispatchTrip = useStore((s) => s.dispatchTrip);
  const user = useUser();
  const by = user?.initials ?? "—";
  const ready = orders.filter((o) => o.status === "invoiced" && !o.tripId);
  const [pick, setPick] = useState<string[]>([]);
  const [vehicle, setVehicle] = useState("LEA-4821");
  const [driver, setDriver] = useState("u-d1");
  const [ke, setKe] = useState("u-r1");
  const [sheet, setSheet] = useState<Trip | null>(null);
  const [busy, run] = useBusy();
  const drivers = users.filter((u) => u.role === "delivery");
  const kes = users.filter((u) => u.role === "recovery");
  const cartons = (ids: string[]) => Math.round(orders.filter((o) => ids.includes(o.id)).reduce((s, o) => s + o.lines.reduce((a, l) => { const p = products.find((x) => x.id === l.productId)!; return a + pcsOf(l, p) / p.packSize; }, 0), 0));

  return (
    <div className="grid h-full grid-cols-[1fr_minmax(360px,40%)] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="border-b border-line px-4 py-3">
          <div className="text-[14px] font-semibold">Invoices ready to load</div>
          <div className="text-xs text-ink2">Tick the invoices for one truck, assign the delivery boy and KE, then create the load sheet.</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {ready.length === 0 && <Empty title="Nothing to load" hint="Once back office issues an invoice for a picked order, it appears here ready for a truck." />}
          {ready.map((o) => {
            const c = customers.find((x) => x.id === o.customerId)!;
            const on = pick.includes(o.id);
            return (
              <label key={o.id} className={`row-hover flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3 ${on ? "row-sel" : ""}`}>
                <input type="checkbox" checked={on} onChange={() => setPick(on ? pick.filter((x) => x !== o.id) : [...pick, o.id])} className="h-4 w-4 accent-[var(--accent)]" />
                <div className="min-w-0 flex-1"><div className="font-semibold">{c.name}</div><div className="num text-[11px] text-ink3">{o.invoiceNo} · {c.area} · {c.route} · {ago(o.createdAt)}</div></div>
                <span className="num text-xs text-ink2">{Math.round(o.lines.reduce((a, l) => { const p = products.find((x) => x.id === l.productId)!; return a + pcsOf(l, p) / p.packSize; }, 0))} ctn</span>
              </label>
            );
          })}
        </div>
        <div className="space-y-2 border-t border-line p-3">
          <div className="grid grid-cols-3 gap-2">
            <input className="field" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Vehicle" />
            <select className="field" value={driver} onChange={(e) => setDriver(e.target.value)}>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name} (driver)</option>)}</select>
            <select className="field" value={ke} onChange={(e) => setKe(e.target.value)}>{kes.map((d) => <option key={d.id} value={d.id}>{d.name} (KE)</option>)}</select>
          </div>
          <button className="btn btn-primary h-9 w-full justify-center" disabled={!pick.length || busy} onClick={() => run(() => { createTrip(pick, vehicle, driver, ke, by); setPick([]); toast("Load sheet created"); })}>{busy ? <Spinner /> : null}
            Create load sheet · {pick.length} invoices · {cartons(pick)} cartons
          </button>
        </div>
      </div>

      <div className="panel flex min-h-0 flex-col">
        <div className="border-b border-line px-4 py-3"><div className="text-[14px] font-semibold">Trips</div><div className="text-xs text-ink2">Load, check and release the truck</div></div>
        <div className="min-h-0 flex-1 overflow-auto">
          {trips.length === 0 && <Empty title="No trips yet" />}
          {trips.map((t) => (
            <div key={t.id} className="border-b border-line p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Truck size={16} className="text-accent" /><span className="num font-semibold">{t.folio}</span><span className="num text-ink3">{t.vehicle}</span></div>
                <span className={`chip ${t.status === "loading" ? "chip-warn" : t.status === "out" ? "chip-info" : "chip-ok"}`}>{t.status === "loading" ? "Loading" : t.status === "out" ? "On the road" : "Settled"}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-ink2">
                <span className="flex items-center gap-1"><Avatar initials={users.find((u) => u.id === t.driverId)?.initials ?? ""} size={18} /> {users.find((u) => u.id === t.driverId)?.name}</span>
                <span className="flex items-center gap-1"><Avatar initials={users.find((u) => u.id === t.keId)?.initials ?? ""} size={18} tone={1} /> {users.find((u) => u.id === t.keId)?.name}</span>
                <span className="num">{t.orderIds.length} invoices · {cartons(t.orderIds)} ctn · {ago(t.createdAt)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn h-8" onClick={() => setSheet(t)}><Printer size={13} /> Load sheet</button>
                {t.status === "loading" && <button className="btn btn-primary h-8" disabled={busy} onClick={() => run(() => { dispatchTrip(t.id, by); toast(`${t.folio} released`); })}>{busy ? <Spinner /> : null}Truck loaded, dispatch</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {sheet && (
        <Modal open onClose={() => setSheet(null)} title={`Load sheet ${sheet.folio}`} width={680}>
          <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
            <div className="flex justify-between"><div><div className="text-lg font-bold">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">Load sheet · {sheet.vehicle}</div></div><div className="num text-right font-bold">{sheet.folio}</div></div>
            <div className="my-3 text-xs">Driver: <b>{users.find((u) => u.id === sheet.driverId)?.name}</b> · KE: <b>{users.find((u) => u.id === sheet.keId)?.name}</b></div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#8a968f]">Total to load</div>
            <table className="mb-4 w-full text-xs"><tbody>
              {Object.entries(sheet.orderIds.flatMap((id) => orders.find((o) => o.id === id)?.lines ?? []).reduce<Record<string, number>>((m, l) => { const p = products.find((x) => x.id === l.productId)!; m[p.name] = (m[p.name] ?? 0) + pcsOf(l, p) / p.packSize; return m; }, {})).map(([n, q]) => (
                <tr key={n} className="border-b border-[#e4e8e2]"><td className="py-1">{n}</td><td className="num text-right">{Math.round(q * 10) / 10} ctn</td></tr>))}
            </tbody></table>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#8a968f]">Drop-off order</div>
            {sheet.orderIds.map((id, i) => { const o = orders.find((x) => x.id === id)!; const c = customers.find((x) => x.id === o.customerId)!; return <div key={id} className="flex justify-between border-b border-[#e4e8e2] py-1 text-xs"><span>{i + 1}. {c.name} · {c.area}</span><span className="num">{o.invoiceNo}</span></div>; })}
            <div className="mt-8 text-[11px] text-[#8a968f]">Loaded by ____________ · Driver ____________ · Gate ____________</div>
          </div>
          <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setSheet(null)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
        </Modal>
      )}
    </div>
  );
}
