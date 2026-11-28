"use client";
import { useMemo, useState } from "react";
import { can } from "@/lib/perm";
import { ArrowDown, ArrowUp, Printer, ShieldCheck, Truck, X } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, pcsOf } from "@/lib/calc";
import { VEHICLES } from "@/lib/seed";
import type { Order, Trip } from "@/lib/types";
import Barcode from "@/components/Barcode";
import { Avatar, Empty, Meter, Modal, Spinner, ask, toast, useBusy } from "@/components/ui";

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
  const canAct = can(user, "dispatch");
  const [busy, run] = useBusy();
  const ready = orders.filter((o) => o.status === "invoiced" && !o.tripId);
  const [pick, setPick] = useState<string[]>([]); // order = drop sequence
  const [vehicle, setVehicle] = useState(VEHICLES[0].no);
  const [driver, setDriver] = useState("u-d1");
  const [ke, setKe] = useState("u-r1");
  const [sheet, setSheet] = useState<Trip | null>(null);
  const [gate, setGate] = useState<Trip | null>(null);
  const drivers = users.filter((u) => u.role === "delivery");
  const kes = users.filter((u) => u.role === "recovery");
  const veh = VEHICLES.find((v) => v.no === vehicle)!;

  const cust = (o: Order) => customers.find((x) => x.id === o.customerId)!;
  const ctnOf = (o: Order) => o.cartons ?? Math.max(1, Math.round(o.lines.reduce((s, l) => { const p = products.find((x) => x.id === l.productId)!; return s + pcsOf(l, p) / p.packSize; }, 0)));
  const load = (ids: string[]) => ids.reduce((s, id) => s + (orders.find((o) => o.id === id) ? ctnOf(orders.find((o) => o.id === id)!) : 0), 0);
  const total = load(pick);
  const over = total > veh.capacity;
  const usedVehicles = useMemo(() => new Set(trips.filter((t) => t.status !== "closed").map((t) => t.vehicle)), [trips]);

  const move = (i: number, d: number) => { const a = [...pick]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setPick(a); };
  const autoSort = () => setPick([...pick].sort((a, b) => { const x = cust(orders.find((o) => o.id === a)!), y = cust(orders.find((o) => o.id === b)!); return x.route.localeCompare(y.route) || x.area.localeCompare(y.area); }));
  const toggle = (id: string) => setPick(pick.includes(id) ? pick.filter((x) => x !== id) : [...pick, id]);

  return (
    <div className="grid h-full grid-cols-[1fr_minmax(380px,40%)] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="border-b border-line px-4 py-3">
          <div className="text-[14px] font-semibold">Invoices ready to load</div>
          <div className="text-xs text-ink2">Tick the invoices for one truck, set the drop order, pick the vehicle and crew, then create the load sheet.</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {ready.length === 0 && <Empty title="Nothing to load" hint="Once back office invoices a packed order, it appears here ready for a truck." />}
          {ready.map((o) => {
            const on = pick.includes(o.id);
            return (
              <label key={o.id} className={`row-hover flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3 ${on ? "row-sel" : ""}`}>
                <input type="checkbox" disabled={!canAct} checked={on} onChange={() => toggle(o.id)} className="h-4 w-4 accent-[var(--accent)]" />
                <div className="min-w-0 flex-1"><div className="font-semibold">{cust(o).name}</div><div className="num text-[11px] text-ink3">{o.invoiceNo} · {cust(o).area} · {cust(o).route} · {ago(o.createdAt)}</div></div>
                <span className="num text-xs text-ink2">{ctnOf(o)} ctn</span>
              </label>
            );
          })}
        </div>
        {canAct && (
          <div className="space-y-3 border-t border-line p-3">
            {pick.length > 0 && (
              <div className="rounded-xl border border-line bg-panel2 p-2.5">
                <div className="mb-1.5 flex items-center justify-between"><span className="th">Drop order (first stop at the top)</span><button className="text-xs font-semibold text-accent" onClick={autoSort}>Sort by route and area</button></div>
                {pick.map((id, i) => { const o = orders.find((x) => x.id === id)!; return (
                  <div key={id} className="flex items-center gap-2 py-0.5 text-[12.5px]"><span className="num grid h-5 w-5 place-items-center rounded-full bg-accentsoft text-[11px] font-bold text-accent">{i + 1}</span><span className="flex-1 truncate">{cust(o).name} <span className="text-ink3">· {cust(o).area}</span></span><span className="num text-ink3">{ctnOf(o)} ctn</span>
                    <button className="rounded p-0.5 text-ink3 hover:bg-panel disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp size={14} /></button>
                    <button className="rounded p-0.5 text-ink3 hover:bg-panel disabled:opacity-30" disabled={i === pick.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown size={14} /></button>
                    <button className="rounded p-0.5 text-ink3 hover:bg-panel" onClick={() => toggle(id)} aria-label="Remove"><X size={14} /></button></div>); })}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <select className="field" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>{VEHICLES.map((v) => <option key={v.no} value={v.no}>{v.no} · {v.label} · {v.capacity} ctn{usedVehicles.has(v.no) ? " (on a trip)" : ""}</option>)}</select>
              <select className="field" value={driver} onChange={(e) => setDriver(e.target.value)}>{drivers.map((d) => <option key={d.id} value={d.id}>{d.name} (driver)</option>)}</select>
              <select className="field" value={ke} onChange={(e) => setKe(e.target.value)}>{kes.map((d) => <option key={d.id} value={d.id}>{d.name} (KE)</option>)}</select>
            </div>
            <div><div className="mb-1 flex justify-between text-xs"><span className="text-ink2">Load</span><span className={`num font-semibold ${over ? "text-[var(--bad-fg)]" : ""}`}>{total} of {veh.capacity} cartons</span></div><Meter pct={(total / veh.capacity) * 100} tone={over ? "bad" : total / veh.capacity > 0.85 ? "warn" : "ok"} />
              {over && <div className="mt-1 text-[11.5px] font-semibold text-[var(--bad-fg)]">This is {total - veh.capacity} cartons too much for {veh.label}. Remove an invoice or pick a bigger vehicle.</div>}
              {usedVehicles.has(vehicle) && !over && <div className="mt-1 text-[11.5px] font-semibold text-[var(--warn-fg)]">{vehicle} is already on another trip.</div>}</div>
            <button className="btn btn-primary h-9 w-full justify-center" disabled={!pick.length || over || busy} onClick={() => run(() => { createTrip(pick, vehicle, driver, ke, by); setPick([]); toast("Load sheet created. Load the last stop first"); })}>{busy ? <Spinner /> : null}Create load sheet · {pick.length} invoices · {total} cartons</button>
          </div>
        )}
      </div>

      <div className="panel flex min-h-0 flex-col">
        <div className="border-b border-line px-4 py-3"><div className="text-[14px] font-semibold">Trips</div><div className="text-xs text-ink2">Load, check, seal and release the truck</div></div>
        <div className="min-h-0 flex-1 overflow-auto">
          {trips.length === 0 && <Empty title="No trips yet" hint="Create a load sheet from the invoices on the left." />}
          {trips.map((t) => (
            <div key={t.id} className="border-b border-line p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Truck size={16} className="text-accent" /><span className="num font-semibold">{t.folio}</span><span className="num text-ink3">{t.vehicle}</span></div>
                <span className={`chip ${t.status === "loading" ? "chip-warn" : t.status === "out" ? "chip-info" : "chip-ok"}`}>{t.status === "loading" ? "Loading" : t.status === "out" ? "On the road" : "Settled"}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink2">
                <span className="flex items-center gap-1"><Avatar initials={users.find((u) => u.id === t.driverId)?.initials ?? ""} size={18} /> {users.find((u) => u.id === t.driverId)?.name}</span>
                <span className="flex items-center gap-1"><Avatar initials={users.find((u) => u.id === t.keId)?.initials ?? ""} size={18} tone={1} /> {users.find((u) => u.id === t.keId)?.name}</span>
                <span className="num">{t.orderIds.length} invoices · {load(t.orderIds)} ctn · {ago(t.createdAt)}</span>
                {t.seal && <span className="chip chip-mute num">Seal {t.seal}</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn h-8" onClick={() => setSheet(t)}><Printer size={13} /> Load sheet</button>
                {t.gatePass && <button className="btn h-8" onClick={() => setGate(t)}><ShieldCheck size={13} /> Gate pass</button>}
                {canAct && t.status === "loading" && <button className="btn btn-primary h-8" disabled={busy} onClick={async () => { if (await ask({ title: `Seal and release ${t.folio}?`, body: `${t.vehicle} leaves with ${load(t.orderIds)} cartons for ${t.orderIds.length} customers. A seal number and gate pass are created.`, confirm: "Seal and dispatch" })) run(() => { dispatchTrip(t.id, by); toast(`${t.folio} released. Gate pass is ready to print`); }); }}>{busy ? <Spinner /> : null}Truck loaded, dispatch</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {sheet && (
        <Modal open onClose={() => setSheet(null)} title={`Load sheet ${sheet.folio}`} width={700}>
          <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
            <div className="flex justify-between"><div><div className="text-lg font-bold tracking-wide">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">Load sheet · {sheet.vehicle}</div></div><div className="text-right"><div className="num font-bold">{sheet.folio}</div><div className="mt-1 flex justify-end"><Barcode value={sheet.folio} height={26} unit={1.1} /></div></div></div>
            <div className="my-3 text-xs">Driver: <b>{users.find((u) => u.id === sheet.driverId)?.name}</b> · KE: <b>{users.find((u) => u.id === sheet.keId)?.name}</b> · Total <b className="num">{load(sheet.orderIds)} cartons</b></div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#8a968f]">Load in this order: last stop first, first stop nearest the door</div>
            <table className="mb-4 w-full text-xs">
              <thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1.5">Load #</th><th>Drop stop</th><th>Customer</th><th>Invoice</th><th className="text-right">Cartons</th><th>Loaded ✓</th></tr></thead>
              <tbody>{[...sheet.orderIds].map((id, i) => ({ id, stop: i + 1 })).reverse().map(({ id, stop }, k) => { const o = orders.find((x) => x.id === id)!; return (
                <tr key={id} className="border-b border-[#e4e8e2]"><td className="num py-1.5 font-bold">{k + 1}</td><td className="num">Stop {stop}</td><td>{cust(o).name} · {cust(o).area}{o.packNote && <div className="text-[10px] italic text-[#8a968f]">{o.packNote}</div>}</td><td className="num">{o.invoiceNo}</td><td className="num text-right">{ctnOf(o)}</td><td>☐</td></tr>); })}</tbody>
            </table>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#8a968f]">Total to load</div>
            <table className="w-full text-xs"><tbody>
              {Object.entries(sheet.orderIds.flatMap((id) => orders.find((o) => o.id === id)?.lines ?? []).reduce<Record<string, number>>((m, l) => { const p = products.find((x) => x.id === l.productId)!; m[p.name] = (m[p.name] ?? 0) + pcsOf(l, p) / p.packSize; return m; }, {})).map(([n, q]) => (
                <tr key={n} className="border-b border-[#e4e8e2]"><td className="py-1">{n}</td><td className="num text-right">{Math.round(q * 10) / 10} ctn</td></tr>))}
            </tbody></table>
            <div className="mt-8 text-[11px] text-[#8a968f]">Loaded by ____________ · Checked by ____________ · Driver ____________</div>
          </div>
          <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setSheet(null)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
        </Modal>
      )}
      {gate && (
        <Modal open onClose={() => setGate(null)} title={`Gate pass ${gate.gatePass}`} width={640}>
          <div className="printable rounded-xl border-2 border-[#16201b] bg-white p-6 text-[#16201b]">
            <div className="flex items-start justify-between"><div><div className="text-lg font-bold tracking-wide">ZARIE DISTRIBUTORS</div><div className="text-xs font-bold uppercase tracking-widest text-[#4b5a52]">Gate pass · goods out</div></div><div className="text-right"><div className="num text-[20px] font-bold">{gate.gatePass}</div><div className="num text-xs text-[#4b5a52]">{gate.dispatchedAt ? new Date(gate.dispatchedAt).toLocaleString("en-GB") : ""}</div></div></div>
            <div className="my-4 grid grid-cols-4 gap-3 rounded-lg bg-[#f4f6f3] p-3 text-xs">
              {[["Vehicle", gate.vehicle], ["Driver", users.find((u) => u.id === gate.driverId)?.name ?? ""], ["KE", users.find((u) => u.id === gate.keId)?.name ?? ""], ["Seal no.", gate.seal ?? ""]].map(([l, v]) => <div key={l}><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">{l}</div><b className="num">{v}</b></div>)}
            </div>
            <table className="w-full text-xs"><thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1.5">Stop</th><th>Customer</th><th>Invoice</th><th className="text-right">Cartons</th></tr></thead>
              <tbody>{gate.orderIds.map((id, i) => { const o = orders.find((x) => x.id === id)!; return <tr key={id} className="border-b border-[#e4e8e2]"><td className="num py-1.5">{i + 1}</td><td>{cust(o).name}</td><td className="num">{o.invoiceNo}</td><td className="num text-right">{ctnOf(o)}</td></tr>; })}</tbody>
              <tfoot><tr><td colSpan={3} className="pt-2 text-right font-bold">Total cartons</td><td className="num pt-2 text-right font-bold">{load(gate.orderIds)}</td></tr></tfoot></table>
            <div className="mt-3 flex justify-center"><Barcode value={gate.gatePass ?? ""} height={30} unit={1.4} /></div>
            <div className="mt-8 grid grid-cols-3 gap-6 text-[11px] text-[#8a968f]"><span>Warehouse in-charge ____________</span><span>Security guard ____________</span><span>Driver ____________</span></div>
          </div>
          <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setGate(null)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
        </Modal>
      )}
    </div>
  );
}
