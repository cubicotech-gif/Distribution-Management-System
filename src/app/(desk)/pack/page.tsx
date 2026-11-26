"use client";
import { useMemo, useState } from "react";
import { Printer, ScanLine, Tag } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt, pcsOf } from "@/lib/calc";
import type { Order } from "@/lib/types";
import Challan from "@/components/Challan";
import CartonLabels from "@/components/CartonLabels";
import { Empty, Spinner, Thumb, ask, toast, useBusy } from "@/components/ui";

export default function Pack() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const pack = useStore((s) => s.packOrder);
  const user = useUser();
  const by = user?.initials ?? "—";
  const canAct = user?.role === "warehouse";
  const [busy, run] = useBusy();
  const queue = useMemo(() => orders.filter((o) => o.status === "picked" && !o.packed).sort((a, b) => (a.wave ?? "~").localeCompare(b.wave ?? "~") || a.createdAt - b.createdAt), [orders]);
  const packed = orders.filter((o) => o.status === "picked" && o.packed);
  const [sel, setSel] = useState<string | null>(null);
  const cur = queue.find((o) => o.id === sel) ?? queue[0];
  const [counted, setCounted] = useState<Record<string, Record<number, number>>>({});
  const [cartons, setCartons] = useState<Record<string, number>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [scan, setScan] = useState("");
  const [labels, setLabels] = useState<Order | null>(null);
  const [view, setView] = useState<Order | null>(null);

  const cust = (o: Order) => customers.find((x) => x.id === o.customerId);
  const est = (o: Order) => Math.max(1, Math.ceil(o.lines.reduce((s, l) => { const p = products.find((x) => x.id === l.productId)!; return s + pcsOf(l, p) / p.packSize; }, 0) / 4));
  const cnt = cur ? counted[cur.id] ?? {} : {};
  const lineOk = (i: number) => cur && (cnt[i] ?? 0) === cur.lines[i].qty;
  const allOk = !!cur && cur.lines.length > 0 && cur.lines.every((_, i) => lineOk(i));
  const n = cur ? cartons[cur.id] ?? est(cur) : 0;
  const sameUser = !!cur && cur.pickedBy === by;

  const doScan = () => {
    const c = scan.trim().toUpperCase(); setScan("");
    if (!cur || !c) return;
    const i = cur.lines.findIndex((l) => { const p = products.find((x) => x.id === l.productId)!; return c === p.code.toUpperCase() || c.startsWith(p.code.toUpperCase() + "-"); });
    if (i < 0) { toast(`Not on this challan: ${c}`); return; }
    const p = products.find((x) => x.id === cur.lines[i].productId)!;
    if ((cnt[i] ?? 0) >= cur.lines[i].qty) { toast(`${p.name}: already complete, that is an extra carton`); return; }
    setCounted({ ...counted, [cur.id]: { ...cnt, [i]: (cnt[i] ?? 0) + 1 } });
  };
  const sign = async () => {
    if (!cur) return;
    if (sameUser && !(await ask({ title: "You picked this order yourself", body: "Normally a second person checks the packing. Continue anyway?", confirm: "Sign off anyway" }))) return;
    run(() => { pack(cur.id, n, note[cur.id] ?? "", by); toast(`${cur.folio} packed and checked. Back office can invoice it`); });
  };

  return (
    <div className="grid h-full grid-cols-[minmax(300px,32%)_1fr] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="border-b border-line px-4 py-3"><div className="text-[14px] font-semibold">Packing table</div><div className="text-xs text-ink2">Picked orders waiting for the check</div></div>
        <div className="min-h-0 flex-1 overflow-auto">
          {queue.length === 0 && <Empty title="Nothing to pack" hint="Orders arrive here right after they are picked and the challan is created." action={{ label: "Go to picking", href: "/pick" }} />}
          {queue.map((o) => (
            <button key={o.id} onClick={() => setSel(o.id)} className={`row-hover flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${cur?.id === o.id ? "row-sel" : ""}`}>
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{cust(o)?.name}</div><div className="num text-[11px] text-ink3">{o.challanNo} · {cust(o)?.route} · {ago(o.createdAt)}</div></div>
              {o.wave && <span className="chip chip-info">{o.wave}</span>}
            </button>
          ))}
          {packed.length > 0 && <div className="th px-4 pb-1 pt-4">Packed, waiting for invoice</div>}
          {packed.map((o) => <button key={o.id} onClick={() => setView(o)} className="row-hover flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left text-ink2"><span className="flex-1">{cust(o)?.name}</span><span className="num text-xs">{o.cartons} ctn</span><span className="chip chip-ok">Packed</span></button>)}
        </div>
      </div>

      <div className="panel flex min-h-0 flex-col">
        {!cur ? <Empty title="Nothing to check" hint="You are all caught up." /> : (
          <>
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div><div className="flex items-center gap-2.5"><h2 className="text-[20px] font-bold">{cust(cur)?.name}</h2>{cur.wave && <span className="chip chip-info">{cur.wave}</span>}</div>
                  <div className="num mt-1 text-xs text-ink2">{cur.challanNo} · {cust(cur)?.area} · {cust(cur)?.route} · picked by {cur.pickedBy}</div></div>
                <button className="btn" onClick={() => setView(cur)}><Printer size={14} /> Challan</button>
              </div>
              {cur.wave && <div className="mt-2 rounded-xl bg-accentwash px-3 py-2 text-xs text-ink2">This order was picked in {cur.wave} with other orders. Take only this customer&apos;s items from the trolley and count them below.</div>}
              {canAct && <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="relative"><ScanLine size={14} className="absolute left-2.5 top-2.5 text-ink3" /><input className="field w-[320px]" style={{ paddingLeft: 32 }} placeholder="Scan each carton as you pack it (SE-01-SE2603)" value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} autoFocus /></div>
                <button className="btn" onClick={() => setCounted({ ...counted, [cur.id]: Object.fromEntries(cur.lines.map((l, i) => [i, l.qty])) })}>Count matches</button>
                <span className="text-[11px] text-ink3">Scan adds one carton. &quot;Count matches&quot; fills everything when you have counted by eye.</span>
              </div>}
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              <table className="w-full text-[12.5px]">
                <thead><tr className="th text-left"><th className="py-2">Product</th><th>Taken from</th><th className="text-right">On challan</th><th className="text-right">You counted</th><th className="pl-4">Check</th></tr></thead>
                <tbody>{cur.lines.map((l, i) => {
                  const p = products.find((x) => x.id === l.productId)!;
                  const al = (cur.allocation ?? []).filter((a) => a.i === i);
                  const c = cnt[i] ?? 0;
                  return (
                    <tr key={i} className="border-t border-line align-top">
                      <td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><div><div className="font-medium">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · {l.unit.toUpperCase()}</div></div></div></td>
                      <td className="num py-2 text-[11.5px] text-ink2">{al.length ? al.map((a) => `${a.bin ?? ""} · ${a.batch}`).join(", ") : "—"}</td>
                      <td className="num py-2 text-right font-semibold">{l.qty}</td>
                      <td className="w-28 py-2 text-right"><input className="cell num font-semibold" style={{ borderColor: c > l.qty ? "var(--bad-fg)" : undefined }} type="number" min={0} value={c} disabled={!canAct} onChange={(e) => setCounted({ ...counted, [cur.id]: { ...cnt, [i]: Math.max(0, Math.floor(+e.target.value || 0)) } })} /></td>
                      <td className="py-2 pl-4 whitespace-nowrap">{lineOk(i) ? <span className="chip chip-ok">✓ matches</span> : c === 0 ? <span className="chip chip-mute">not counted</span> : c < l.qty ? <span className="chip chip-warn">{l.qty - c} missing</span> : <span className="chip chip-bad">{c - l.qty} extra</span>}</td>
                    </tr>);
                })}</tbody>
              </table>
              {canAct && <div className="mt-4 grid grid-cols-[150px_1fr] gap-3 rounded-xl border border-line bg-panel2 p-3">
                <label className="block"><div className="th mb-1">Cartons / bags</div><input className="field num text-[16px] font-bold" type="number" min={1} value={n} onChange={(e) => setCartons({ ...cartons, [cur.id]: Math.max(1, Math.floor(+e.target.value || 1)) })} /><div className="mt-1 text-[10.5px] text-ink3">How many packages go to this customer</div></label>
                <label className="block"><div className="th mb-1">Note for the driver (optional)</div><input className="field" placeholder="e.g. fragile, keep upright, cold items on top" value={note[cur.id] ?? ""} onChange={(e) => setNote({ ...note, [cur.id]: e.target.value })} /></label>
              </div>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
              <div className="text-xs text-ink2">{allOk ? <span className="font-semibold text-[var(--ok-fg)]">Everything matches the challan</span> : "Count every line until it matches the challan"}{sameUser && <span className="chip chip-warn ml-2">Same person picked and checked</span>}</div>
              <div className="flex gap-2">
                <button className="btn" disabled={n < 1} onClick={() => setLabels(cur)}><Tag size={14} /> Carton labels</button>
                {canAct && <button className="btn btn-primary h-9" disabled={busy || !allOk} onClick={sign}>{busy ? <Spinner /> : null}Sign off packing</button>}
              </div>
            </div>
          </>
        )}
      </div>
      {labels && <CartonLabels o={labels} n={cartons[labels.id] ?? est(labels)} onClose={() => setLabels(null)} />}
      {view && view.challanNo && <Challan o={view} onClose={() => setView(null)} />}
      <div className="hidden">{fmt(0)}</div>
    </div>
  );
}
