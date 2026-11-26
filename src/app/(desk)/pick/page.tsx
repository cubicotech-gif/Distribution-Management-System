"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Lock, Printer, ScanLine } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt, isExpired, pcsOf, sellable } from "@/lib/calc";
import type { Order, Product } from "@/lib/types";
import Challan from "@/components/Challan";
import { Avatar, Empty, Kbd, Spinner, StatusChip, Thumb, ask, toast, useBusy } from "@/components/ui";

interface Take { no: string; expiry: string; pcs: number; bin: string }
// which batches FEFO would take for this many pcs (preview only; expired is never picked)
function preview(p: Product, pcs: number): Take[] {
  const out: Take[] = [];
  let need = pcs;
  for (const b of [...p.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))) {
    if (need <= 0) break;
    if (isExpired(b.expiry)) continue;
    const t = Math.min(b.qty, need);
    out.push({ no: b.no, expiry: b.expiry, pcs: t, bin: b.bin }); need -= t;
  }
  return out;
}
interface Stop { key: string; p: Product; t: Take; line?: number; note?: string }
const stopKey = (p: Product, t: Take) => `${p.id}|${t.no}|${t.bin}`;
const isBin = (c: string) => /^[A-E]-(\d{2}-\d|OV)$/.test(c) || c === "RCV";

export default function Pick() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const users = useStore((s) => s.users);
  const pick = useStore((s) => s.pickOrder);
  const pickWave = useStore((s) => s.pickWave);
  const user = useUser();
  const by = user?.initials ?? "—";
  const canAct = user?.role === "warehouse";
  const [busy, run] = useBusy();
  const queue = orders.filter((o) => o.status === "approved");
  const toPack = orders.filter((o) => o.status === "picked" && !o.packed);
  const [sel, setSel] = useState<string | null>(null);
  const [wave, setWave] = useState<string[]>([]);
  const [mode, setMode] = useState<"single" | "wave">("single");
  const [vals, setVals] = useState<Record<string, Record<number, number>>>({});
  const [why, setWhy] = useState<Record<string, Record<number, string>>>({});
  const [done, setDone] = useState<Record<string, Record<string, "scan" | "manual">>>({});
  const [curBin, setCurBin] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const [view, setView] = useState<Order | null>(null);
  const inp = useRef<HTMLInputElement>(null);

  const cust = (o: Order) => customers.find((x) => x.id === o.customerId);
  const heldReason = (o: Order) => o.pickHold ?? (cust(o)?.status === "blocked" ? `Customer is blocked: ${cust(o)?.blockedReason ?? ""}` : "");
  const cur = queue.find((o) => o.id === sel) ?? queue.find((o) => !heldReason(o)) ?? queue[0];
  const wavers = queue.filter((o) => wave.includes(o.id) && !heldReason(o));
  const waveMode = mode === "wave" && wavers.length >= 2;
  const scope = waveMode ? "wave" : cur?.id ?? "";

  // ---- what has to be picked, as a list of stops (one per bin + batch)
  const stops: Stop[] = useMemo(() => {
    const out: Stop[] = [];
    if (waveMode) {
      const need = new Map<string, number>();
      for (const o of wavers) for (const l of o.lines) need.set(l.productId, (need.get(l.productId) ?? 0) + pcsOf(l, products.find((x) => x.id === l.productId)!));
      for (const [pid, pcs] of Array.from(need.entries())) { const p = products.find((x) => x.id === pid)!; for (const t of preview(p, Math.min(pcs, sellable(p)))) out.push({ key: stopKey(p, t), p, t }); }
    } else if (cur) {
      cur.lines.forEach((l, i) => {
        const p = products.find((x) => x.id === l.productId)!;
        const per = l.unit === "ctn" ? p.packSize : 1;
        const v = vals[cur.id]?.[i] ?? Math.min(l.qty, Math.floor(sellable(p) / per));
        for (const t of preview(p, pcsOf({ ...l, qty: v }, p))) out.push({ key: stopKey(p, t), p, t, line: i });
      });
    }
    return out.sort((a, b) => a.t.bin.localeCompare(b.t.bin));
  }, [waveMode, wavers, cur, products, vals]);
  const mine = done[scope] ?? {};
  const confirmed = stops.filter((s) => mine[s.key]).length;
  const next = stops.find((s) => !mine[s.key]);
  const allDone = stops.length > 0 && confirmed === stops.length;
  const held = cur ? heldReason(cur) : "";
  const bin = curBin[scope] ?? "";

  const mark = (k: string, how: "scan" | "manual") => setDone((d) => ({ ...d, [scope]: { ...(d[scope] ?? {}), [k]: how } }));
  const handleScan = () => {
    const c = code.trim().toUpperCase();
    setCode("");
    if (!c || !stops.length) return;
    if (isBin(c)) {
      if (!stops.some((s) => s.t.bin === c && !mine[s.key])) { toast(stops.some((s) => s.t.bin === c) ? `Everything in ${c} is already picked` : `${c} is not on this pick list. Next stop is ${next?.t.bin}`); return; }
      setCurBin((m) => ({ ...m, [scope]: c })); toast(`Bin ${c} confirmed. Now scan the carton label`); return;
    }
    const prod = products.find((p) => c === p.code.toUpperCase() || c.startsWith(p.code.toUpperCase() + "-"));
    if (!prod) { toast(`Unknown label ${c}`); return; }
    const batch = c === prod.code.toUpperCase() ? "" : c.slice(prod.code.length + 1);
    const cands = stops.filter((s) => s.p.id === prod.id && !mine[s.key]);
    if (!cands.length) { toast(stops.some((s) => s.p.id === prod.id) ? `${prod.name} is already picked` : `Wrong product: ${prod.name} is not on this pick list`); return; }
    if (!bin) { toast("Scan the bin label first"); return; }
    const stop = cands.find((s) => s.t.bin === bin);
    if (!stop) { toast(`${prod.name} is not in ${bin}. Go to ${cands[0].t.bin}`); return; }
    if (batch && batch !== stop.t.no.toUpperCase()) { toast(`Wrong batch ${batch}. Take ${stop.t.no} first (earlier expiry)`); return; }
    mark(stop.key, "scan");
    toast(batch ? `${prod.name} · batch ${stop.t.no} verified` : `${prod.name} confirmed (batch not verified: scan the full carton label)`);
  };

  const confirm = async () => {
    if (!canAct) return;
    if (waveMode) {
      if (!(await ask({ title: `Pick ${wavers.length} orders together?`, body: "Stock is deducted by batch for all of them and each order gets its own challan. Sort the cartons by customer at the packing table.", confirm: "Confirm wave pick" }))) return;
      run(() => { const r = pickWave(wavers.map((o) => o.id), by); toast(`${r.done} orders picked together${r.short ? `. ${r.short} line(s) were short` : ""}`); setWave([]); setMode("single"); setSel(null); });
    } else if (cur) {
      run(() => { pick(cur.id, vals[cur.id] ?? {}, why[cur.id] ?? {}, by); toast(`Challan created for ${cur.folio}. Send it to the packing table`); });
    }
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && allDone && !held && !busy) { e.preventDefault(); confirm(); } };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  const byRoute = queue.reduce<Record<string, Order[]>>((m, o) => { const r = cust(o)?.route ?? "—"; (m[r] ??= []).push(o); return m; }, {});
  const toggleWave = (id: string) => setWave((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));

  return (
    <div className="grid h-full grid-cols-[minmax(310px,32%)_1fr] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="border-b border-line px-4 py-3">
          <div className="flex items-center justify-between"><div><div className="text-[14px] font-semibold">Pick queue</div><div className="text-xs text-ink2">Approved orders, grouped by route</div></div>
            {toPack.length > 0 && <Link href="/pack" className="chip chip-warn">{toPack.length} to pack →</Link>}</div>
          {canAct && wave.length >= 2 && <button className={`btn mt-2 w-full justify-center ${waveMode ? "btn-primary" : ""}`} onClick={() => { setMode("wave"); }}>Pick {wave.length} orders together (wave)</button>}
          {canAct && queue.length > 1 && wave.length < 2 && <div className="mt-1.5 text-[11px] text-ink3">Tick two or more orders to pick them in one trip.</div>}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {queue.length === 0 && <Empty title="Queue is clear" hint="Approved orders appear here the moment back office approves them." />}
          {Object.entries(byRoute).map(([route, os]) => (
            <div key={route}>
              <div className="th flex items-center justify-between bg-panel2 px-4 py-1.5"><span>{route} · {os.length}</span>{canAct && os.filter((o) => !heldReason(o)).length > 1 && <button className="font-semibold normal-case tracking-normal text-accent" onClick={() => { setWave(os.filter((o) => !heldReason(o)).map((o) => o.id)); setMode("wave"); }}>Pick whole route</button>}</div>
              {os.map((o) => { const h = heldReason(o); return (
                <div key={o.id} className={`row-hover flex items-center gap-2 border-b border-line px-4 py-3 ${!waveMode && cur?.id === o.id ? "row-sel" : ""}`}>
                  {canAct && <input type="checkbox" disabled={!!h} className="h-4 w-4 accent-[var(--accent)]" checked={wave.includes(o.id)} onChange={() => toggleWave(o.id)} />}
                  <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => { setSel(o.id); setMode("single"); }}>
                    <div className="min-w-0 flex-1"><div className="truncate font-semibold">{cust(o)?.name}</div><div className="num text-[11px] text-ink3">{o.folio} · {o.lines.length} lines · {ago(o.createdAt)}</div></div>
                    {h ? <span className="chip chip-bad"><Lock size={11} /> On hold</span> : <StatusChip status={o.status} />}
                  </button>
                </div>); })}
            </div>
          ))}
          {toPack.length > 0 && <div className="th px-4 pb-1 pt-4">Picked, waiting at the packing table</div>}
          {toPack.map((o) => (
            <button key={o.id} onClick={() => setView(o)} className="row-hover flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left text-ink2"><span className="num flex-1">{o.challanNo} · {cust(o)?.name}{o.wave && <span className="chip chip-info ml-1.5 !py-0 text-[10px]">{o.wave}</span>}</span><Printer size={14} /></button>
          ))}
        </div>
      </div>

      <div className="panel flex min-h-0 flex-col">
        {!cur ? <Empty title="Nothing to pick" /> : (
          <>
            <div className="border-b border-line px-5 py-4">
              {waveMode ? (
                <><div className="flex items-center gap-2.5"><h2 className="text-[20px] font-bold">Wave pick · {wavers.length} orders</h2><span className="chip chip-info">Sort at packing</span></div>
                  <div className="mt-1 flex flex-wrap gap-1.5">{wavers.map((o) => <span key={o.id} className="chip chip-mute">{cust(o)?.name}</span>)}</div>
                  <div className="mt-2 text-xs text-ink2">One trip through the warehouse for all these orders. Items are totalled below. After picking, each order gets its own challan and the cartons are sorted by customer at the packing table.</div></>
              ) : (
                <><div className="flex items-center gap-2.5"><h2 className="text-[20px] font-bold">{cust(cur)?.name}</h2><StatusChip status={cur.status} held={!!held} /></div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-ink2"><span className="num">{cur.folio}</span> · {cust(cur)?.area} · {cust(cur)?.route} · booked by <Avatar initials={users.find((u) => u.id === cur.bookerId)?.initials ?? ""} size={16} /></div>
                  <div className="mt-2 text-xs text-ink2">Walk the stops in order. At each stop scan the <b>bin label</b>, then the <b>carton label</b>. A wrong bin, product or batch is rejected.</div></>
              )}
              {held && !waveMode && <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--bad-fg)] bg-[var(--bad-bg)] px-3 py-2 text-[12.5px] text-[var(--bad-fg)]"><Lock size={14} className="mt-0.5" /><div><b>This pick is on hold.</b> {held}. Ask back office to release it before you pick.</div></div>}
              {canAct && !held && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="relative"><ScanLine size={14} className="absolute left-2.5 top-2.5 text-ink3" /><input ref={inp} className="field w-[330px]" style={{ paddingLeft: 32 }} placeholder={bin ? `In ${bin}: scan carton label (e.g. SE-01-SE2603)` : "Scan bin label (e.g. A-01-1), then carton label"} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleScan()} autoFocus /></div>
                  <span className="chip chip-mute">{bin ? `Current bin ${bin}` : "No bin scanned"}</span>
                  <span className="num text-xs text-ink2">{confirmed} of {stops.length} stops confirmed</span>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              {waveMode ? (
                <WaveTable stops={stops} mine={mine} next={next?.key} onManual={(k) => mark(k, "manual")} canAct={canAct} orders={wavers} products={products} />
              ) : (
                <table className="w-full text-[12.5px]">
                  <thead><tr className="th text-left"><th className="whitespace-nowrap py-2">Stop (bin)</th><th>Product</th><th>Batch</th><th className="text-right">Ordered</th><th className="whitespace-nowrap text-right">On shelf</th><th className="text-right">Picked</th><th className="pl-4">Status</th></tr></thead>
                  <tbody>
                    {cur.lines.map((l, i) => ({ l, i, p: products.find((x) => x.id === l.productId)! })).sort((a, b) => a.p.bin.localeCompare(b.p.bin)).map(({ l, i, p }) => {
                      const per = l.unit === "ctn" ? p.packSize : 1;
                      const shelf = Math.floor(sellable(p) / per);
                      const v = vals[cur.id]?.[i] ?? Math.min(l.qty, shelf);
                      const lineStops = stops.filter((s) => s.line === i);
                      return (
                        <tr key={i} className="border-t border-line align-top">
                          <td className="py-2">{lineStops.length ? lineStops.map((s) => <div key={s.key} className="num mb-0.5 font-bold">{s.t.bin}</div>) : <span className="num text-ink3">—</span>}</td>
                          <td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><div><div className="font-medium">{p.name}</div><div className="num text-[11px] text-ink3">{p.code} · {l.unit.toUpperCase()}</div></div></div></td>
                          <td className="whitespace-nowrap py-2">{lineStops.map((s) => <div key={s.key} className="num mb-0.5 text-[11.5px]"><b>{s.t.no}</b> <span className="text-ink3">exp {s.t.expiry}</span> · {fmt(s.t.pcs / per)}{s.t.bin === "RCV" && <span className="chip chip-warn ml-1 !py-0 text-[9.5px]">dock</span>}</div>)}</td>
                          <td className="num py-2 text-right font-semibold">{l.qty}</td>
                          <td className="py-2 text-right"><span className={`chip num ${shelf < l.qty ? "chip-bad" : "chip-ok"}`}>{fmt(shelf)}</span></td>
                          <td className="w-40 py-2 text-right">
                            <input className="cell num font-semibold" style={{ borderColor: v < l.qty ? "var(--bad-fg)" : undefined }} type="number" min={0} max={l.qty} value={v} disabled={!canAct}
                              onChange={(e) => setVals({ ...vals, [cur.id]: { ...(vals[cur.id] ?? {}), [i]: Math.max(0, Math.min(l.qty, +e.target.value)) } })} />
                            {v < l.qty && <select className="field mt-1 h-7 text-[11px]" value={why[cur.id]?.[i] ?? "Not enough on shelf"} onChange={(e) => setWhy({ ...why, [cur.id]: { ...(why[cur.id] ?? {}), [i]: e.target.value } })}>{["Not enough on shelf", "Damaged units", "Near expiry, held back", "Counted wrong earlier"].map((r) => <option key={r}>{r}</option>)}</select>}
                          </td>
                          <td className="py-2 pl-4">{lineStops.map((s) => <div key={s.key} className="mb-1 whitespace-nowrap">{mine[s.key] ? <span className={`chip ${mine[s.key] === "scan" ? "chip-ok" : "chip-warn"}`}>{mine[s.key] === "scan" ? "✓ scanned" : "✓ manual"}</span> : <>
                            <span className="chip chip-mute">{next?.key === s.key ? "next" : "to pick"}</span>{canAct && <button className="ml-1.5 text-[11px] font-semibold text-ink3 underline hover:text-ink" onClick={() => mark(s.key, "manual")}>confirm without scan</button>}</>}</div>)}
                            {lineStops.length === 0 && <span className="text-[11px] text-ink3">Nothing to pick</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <div className="text-xs text-ink2">{canAct ? (allDone ? "All stops confirmed. Stock is deducted by batch and the challan is created." : `${stops.length - confirmed} stop${stops.length - confirmed === 1 ? "" : "s"} still to confirm`) : "View only"}</div>
              <div className="flex gap-2">
                {canAct && <button className="btn btn-primary h-9 px-4 text-[13px]" disabled={busy || !allDone || !!held} onClick={confirm}>{busy ? <Spinner /> : null}{waveMode ? `Confirm wave pick` : "Confirm and create challan"} <Kbd>Ctrl</Kbd><Kbd>↵</Kbd></button>}
              </div>
            </div>
          </>
        )}
      </div>
      {view && view.challanNo && <Challan o={view} onClose={() => setView(null)} />}
    </div>
  );
}

function WaveTable({ stops, mine, next, onManual, canAct, orders, products }: { stops: Stop[]; mine: Record<string, "scan" | "manual">; next?: string; onManual: (k: string) => void; canAct: boolean; orders: Order[]; products: Product[] }) {
  return (
    <table className="w-full text-[12.5px]">
      <thead><tr className="th text-left"><th className="py-2">Stop (bin)</th><th>Product</th><th>Batch</th><th className="text-right">Total</th><th>For these customers</th><th className="pl-4">Status</th></tr></thead>
      <tbody>{stops.map((s) => {
        const per = s.p.packSize;
        const split = orders.map((o) => { const l = o.lines.filter((x) => x.productId === s.p.id).reduce((a, x) => a + pcsOf(x, s.p), 0); return l ? { o, pcs: l } : null; }).filter(Boolean) as { o: Order; pcs: number }[];
        return (
          <tr key={s.key} className="border-t border-line align-top">
            <td className="num py-2 font-bold">{s.t.bin}</td>
            <td className="py-2"><div className="flex items-center gap-2"><Thumb p={s.p} size={26} /><div className="font-medium">{s.p.name}</div></div></td>
            <td className="num py-2 text-[11.5px]"><b>{s.t.no}</b> <span className="text-ink3">exp {s.t.expiry}</span></td>
            <td className="num py-2 text-right font-semibold">{fmt(s.t.pcs / per)} ctn</td>
            <td className="py-2"><div className="flex flex-wrap gap-1">{split.map(({ o, pcs }) => <span key={o.id} className="chip chip-mute !py-0 text-[10px]">{o.folio.slice(3)} · {fmt(pcs / per)}</span>)}</div></td>
            <td className="py-2 pl-4 whitespace-nowrap">{mine[s.key] ? <span className={`chip ${mine[s.key] === "scan" ? "chip-ok" : "chip-warn"}`}>{mine[s.key] === "scan" ? "✓ scanned" : "✓ manual"}</span> : <><span className="chip chip-mute">{next === s.key ? "next" : "to pick"}</span>{canAct && <button className="ml-1.5 text-[11px] font-semibold text-ink3 underline hover:text-ink" onClick={() => onManual(s.key)}>confirm without scan</button>}</>}</td>
          </tr>);
      })}</tbody>
    </table>
  );
}
