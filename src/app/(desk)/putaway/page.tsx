"use client";
import { useMemo, useState } from "react";
import { Printer, ScanLine } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt, monthsLeft } from "@/lib/calc";
import { DOCK, binUsed, suggestBins } from "@/lib/locations";
import { Empty, Spinner, Thumb, ask, toast, useBusy } from "@/components/ui";
import { PutawayLabel } from "@/components/BinLabels";

export default function Putaway() {
  const products = useStore((s) => s.products);
  const bins = useStore((s) => s.bins);
  const move = useStore((s) => s.moveStock);
  const user = useUser();
  const by = user?.initials ?? "—";
  const canAct = user?.role === "warehouse";
  const [busy, run] = useBusy();
  const tasks = useMemo(() => products.flatMap((p) => p.batches.filter((b) => b.bin === DOCK && b.qty > 0).map((b) => ({ p, b }))).sort((a, b) => a.b.expiry.localeCompare(b.b.expiry)), [products]);
  const [selKey, setSelKey] = useState<string | null>(null);
  const cur = tasks.find((t) => t.b.id === selKey) ?? tasks[0];
  const [choice, setChoice] = useState<string | null>(null);
  const [qtyIn, setQtyIn] = useState<number | null>(null);
  const [scan, setScan] = useState("");
  const [label, setLabel] = useState<{ bin: string; ctn: number } | null>(null);

  const sugg = cur ? suggestBins(cur.p, cur.b, products, bins) : [];
  const pick = sugg.find((x) => x.bin.code === choice) ?? sugg[0];
  const totalCtn = cur ? cur.b.qty / cur.p.packSize : 0;
  const qty = qtyIn ?? (pick ? Math.min(totalCtn, Math.floor(pick.free)) : 0);
  const overCap = pick ? qty > pick.free + 0.001 : false;
  const scanWrong = scan.trim() !== "" && pick && scan.trim().toUpperCase() !== pick.bin.code;

  const reset = () => { setChoice(null); setQtyIn(null); setScan(""); };
  const confirm = async () => {
    if (!cur || !pick) return;
    if (scanWrong) { toast(`Wrong bin scanned: ${scan.toUpperCase()}`); return; }
    if (overCap && !(await ask({ title: `${pick.bin.code} will be over capacity`, body: `It has room for ${Math.floor(pick.free)} cartons and you are putting ${qty}.`, confirm: "Put away anyway", danger: true }))) return;
    run(() => {
      const r = move({ productId: cur.p.id, batch: cur.b.no, from: DOCK, to: pick.bin.code, qtyPcs: Math.round(qty * cur.p.packSize), kind: "putaway", reason: pick.reason, by, force: overCap });
      if (r.ok) { toast(`${qty} ctn of ${cur.p.name} put away in ${pick.bin.code}`); reset(); } else toast(r.reason ?? "Could not put away");
    });
  };
  const autoAll = async () => {
    if (!(await ask({ title: `Put away ${tasks.length} batch${tasks.length > 1 ? "es" : ""} in the suggested bins?`, body: "Each batch goes to its best bin. A batch that does not fit stays here for you.", confirm: "Put away all" }))) return;
    run(() => {
      let done = 0;
      for (const t of tasks) {
        let left = t.b.qty;
        for (let guard = 0; guard < 4 && left > 0; guard++) {
          const ps = useStore.getState().products.find((x) => x.id === t.p.id)!;
          const row = ps.batches.find((b) => b.no === t.b.no && b.bin === DOCK);
          if (!row) break;
          const sg = suggestBins(ps, row, useStore.getState().products, useStore.getState().bins)[0];
          if (!sg) break;
          const take = Math.min(row.qty, Math.floor(sg.free) * ps.packSize);
          if (take <= 0) break;
          if (useStore.getState().moveStock({ productId: ps.id, batch: row.no, from: DOCK, to: sg.bin.code, qtyPcs: take, kind: "putaway", reason: sg.reason, by }).ok) { left -= take; done++; } else break;
        }
      }
      toast(done ? `${done} putaway move${done > 1 ? "s" : ""} done` : "Nothing fits right now. Check the locations map.");
    });
  };

  return (
    <div className="grid h-full grid-cols-[minmax(300px,32%)_1fr] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div><div className="text-[14px] font-semibold">At the dock</div><div className="text-xs text-ink2">Received, waiting to be put in a bin</div></div>
          {canAct && tasks.length > 1 && <button className="btn" disabled={busy} onClick={autoAll}>{busy ? <Spinner /> : null}Put all away</button>}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {tasks.length === 0 && <Empty title="Dock is clear" hint="Approved deliveries and restocked returns wait here until you put them away." action={{ label: "See the locations map", href: "/locations" }} />}
          {tasks.map(({ p, b }) => { const m = monthsLeft(b.expiry); return (
            <button key={b.id} onClick={() => { setSelKey(b.id); reset(); }} className={`row-hover flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${cur?.b.id === b.id ? "row-sel" : ""}`}>
              <Thumb p={p} size={30} />
              <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.name}</div><div className="num text-[11px] text-ink3">{b.no} · exp {b.expiry}</div></div>
              <div className="text-right"><div className="num font-semibold">{fmt(b.qty / p.packSize)} ctn</div>{m <= 2 && <span className="chip chip-warn !py-0 text-[10px]">expiry soon</span>}</div>
            </button>); })}
        </div>
      </div>

      <div className="panel flex min-h-0 flex-col">
        {!cur ? <Empty title="Nothing to put away" hint="You are all caught up." /> : (
          <>
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center gap-3"><Thumb p={cur.p} size={44} /><div><h2 className="text-[20px] font-bold leading-tight">{cur.p.name}</h2><div className="num mt-0.5 text-xs text-ink2">Batch <b>{cur.b.no}</b> · exp {cur.b.expiry} · {cur.p.code} · home rack {cur.p.bin || "not set"}</div></div>
                <div className="ml-auto text-right"><div className="th">To put away</div><div className="num text-[22px] font-bold">{fmt(totalCtn)} ctn</div></div></div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              <div className="th mb-1.5">Suggested bins</div>
              {sugg.length === 0 && <div className="rounded-xl border border-[var(--bad-fg)] bg-[var(--bad-bg)] p-3 text-[12.5px] text-[var(--bad-fg)]">No bin has room. Free some space on the Locations map or add a bin.</div>}
              <div className="space-y-1.5">
                {sugg.map((s, i) => { const on = pick?.bin.code === s.bin.code; const used = binUsed(products, s.bin.code); return (
                  <button key={s.bin.code} onClick={() => { setChoice(s.bin.code); setQtyIn(null); }} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${on ? "border-accent bg-accentwash" : "border-line hover:border-line2"}`}>
                    <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${on ? "border-accent" : "border-line2"}`}>{on && <span className="h-2 w-2 rounded-full bg-accent" />}</span>
                    <span className="num w-20 text-[14px] font-bold">{s.bin.code}</span>
                    <span className="flex-1 text-xs text-ink2">{s.reason}{i === 0 && <span className="chip chip-ok ml-2">Best</span>}</span>
                    <span className="w-40"><span className="mb-1 block text-right text-[10.5px] text-ink3"><span className="num">{fmt(used)}</span> of {s.bin.capacity} ctn used</span><span className="block h-1.5 overflow-hidden rounded-full" style={{ background: "var(--mute-bg)" }}><span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (used / s.bin.capacity) * 100)}%` }} /></span></span>
                    <span className="num w-20 text-right text-xs font-semibold">{Math.floor(s.free)} free</span>
                  </button>); })}
              </div>
              {pick && canAct && (
                <div className="mt-4 grid grid-cols-[150px_1fr] items-end gap-3 rounded-xl border border-line bg-panel2 p-3">
                  <label className="block"><div className="th mb-1">Cartons into {pick.bin.code}</div>
                    <input className={`field num text-[16px] font-bold ${qty <= 0 || qty > totalCtn || overCap ? "field-err" : ""}`} type="number" min={1} max={totalCtn} step={1} value={qty} onChange={(e) => setQtyIn(Math.max(0, +e.target.value))} />
                    {qty > totalCtn && <div className="mt-1 text-[11px] font-semibold text-[var(--bad-fg)]">Only {fmt(totalCtn)} here</div>}
                    {overCap && qty <= totalCtn && <div className="mt-1 text-[11px] font-semibold text-[var(--warn-fg)]">Over by {Math.ceil(qty - pick.free)} ctn</div>}
                  </label>
                  <label className="block"><div className="th mb-1">Scan the bin label to confirm (optional in the demo)</div>
                    <div className="relative"><ScanLine size={14} className="absolute left-2.5 top-2.5 text-ink3" /><input className={`field ${scanWrong ? "field-err" : ""}`} style={{ paddingLeft: 32 }} placeholder={`Type ${pick.bin.code} and press Enter`} value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !scanWrong && qty > 0 && confirm()} /></div>
                    {scanWrong && <div className="mt-1 text-[11px] font-semibold text-[var(--bad-fg)]">That is {scan.toUpperCase()}, not {pick.bin.code}. Wrong bin.</div>}
                    {scan.trim() !== "" && !scanWrong && <div className="mt-1 text-[11px] font-semibold text-[var(--ok-fg)]">Bin confirmed</div>}
                  </label>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <button className="btn" disabled={!pick} onClick={() => pick && setLabel({ bin: pick.bin.code, ctn: qty || totalCtn })}><Printer size={14} /> Putaway label</button>
              {canAct ? <button className="btn btn-primary h-9" disabled={busy || !pick || qty <= 0 || qty > totalCtn || !!scanWrong} onClick={confirm}>{busy ? <Spinner /> : null}Put away {qty > 0 ? `${fmt(qty)} ctn` : ""}{pick ? ` in ${pick.bin.code}` : ""}</button> : <span className="chip chip-mute">View only</span>}
            </div>
          </>
        )}
      </div>
      {label && cur && <PutawayLabel p={cur.p} batch={cur.b.no} expiry={cur.b.expiry} ctn={label.ctn} bin={label.bin} onClose={() => setLabel(null)} />}
    </div>
  );
}
