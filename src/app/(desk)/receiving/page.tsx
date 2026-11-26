"use client";
import { useMemo, useRef, useState } from "react";
import { Camera, Plus, Printer, ScanLine, Tag } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt, short as shortMoney } from "@/lib/calc";
import { REASONS, accepted, checkLine, claimsOf, good, receivedSoFar, remaining } from "@/lib/grn";
import { resizeImage } from "@/lib/image";
import type { Grn, GrnLine, PurchaseOrder } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import NewPO from "@/components/NewPO";
import { GrnDoc, LabelSheet } from "@/components/GrnDocs";
import { Empty, Spinner, Thumb, ask, toast, useBusy } from "@/components/ui";

type Tab = "expected" | "counting" | "done" | "hold" | "claims";
type Sel = { kind: "po" | "grn"; id: string } | null;

const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const DAY = 86400000;
const when = (ts: number) => {
  const d = Math.floor((ts - dayStart()) / DAY);
  const t = new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return d < 0 ? { label: `${-d} day${d === -1 ? "" : "s"} late`, tone: "chip-bad", group: "Overdue" } : d === 0 ? { label: `Today ${t}`, tone: "chip-warn", group: "Today" } : d === 1 ? { label: `Tomorrow ${t}`, tone: "chip-mute", group: "Coming" } : { label: new Date(ts).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), tone: "chip-mute", group: "Coming" };
};

export default function Receiving() {
  const user = useUser();
  const role = user?.role;
  const by = user?.initials ?? "—";
  const isWh = role === "warehouse";
  const isPur = role === "purchasing";
  const purchases = useStore((s) => s.purchases);
  const grns = useStore((s) => s.grns);
  const products = useStore((s) => s.products);
  const register = useStore((s) => s.registerArrival);
  const closeShort = useStore((s) => s.closePoShort);
  const release = useStore((s) => s.releaseQuarantine);

  const tabs: [Tab, string][] = [["expected", "Expected"], ["counting", "Counting"], ["done", "Done"], ...(isPur ? [] : [["hold", "On hold"] as [Tab, string]]), ...(isWh ? [] : [["claims", "Claims"] as [Tab, string]])];
  const [tab, setTab] = useState<Tab>("expected");
  const [sel, setSel] = useState<Sel>(null);
  const [newPO, setNewPO] = useState(false);
  const [gate, setGate] = useState<PurchaseOrder | null>(null);
  const [doc, setDoc] = useState<Grn | null>(null);
  const [labels, setLabels] = useState<Grn | null>(null);
  const [shorting, setShorting] = useState<PurchaseOrder | null>(null);

  const expected = useMemo(() => purchases.filter((p) => p.status === "ordered" || p.status === "partial").sort((a, b) => a.expectedAt - b.expectedAt), [purchases]);
  const counting = grns.filter((g) => g.status !== "approved").sort((a, b) => b.arrivedAt - a.arrivedAt);
  const done = grns.filter((g) => g.status === "approved").sort((a, b) => (b.approvedAt ?? 0) - (a.approvedAt ?? 0));
  const held = products.flatMap((p) => p.quarantine.map((q) => ({ p, q })));
  const claims = claimsOf(grns, purchases, products);
  const counts: Record<Tab, number> = { expected: expected.length, counting: counting.length, done: done.length, hold: held.length, claims: claims.length };

  const list: { kind: "po" | "grn"; id: string }[] = tab === "expected" ? expected.map((p) => ({ kind: "po", id: p.id })) : tab === "counting" ? counting.map((g) => ({ kind: "grn", id: g.id })) : tab === "done" ? done.map((g) => ({ kind: "grn", id: g.id })) : [];
  const cur = sel && list.some((x) => x.kind === sel.kind && x.id === sel.id) ? sel : list[0] ?? null;
  const po = cur?.kind === "po" ? purchases.find((p) => p.id === cur.id) : undefined;
  const grn = cur?.kind === "grn" ? grns.find((g) => g.id === cur.id) : undefined;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-panel p-1">
          {tabs.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setSel(null); }} className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${tab === k ? "bg-accent text-accentink" : "text-ink2"}`}>{l}{counts[k] ? <span className="num rounded bg-black/10 px-1 text-[10.5px]">{counts[k]}</span> : null}</button>)}
        </div>
        <div className="text-xs text-ink2">
          {tab === "expected" && (isWh ? "Trucks that should arrive. Tap one when the truck is at the gate." : "Factory orders that have not fully arrived.")}
          {tab === "counting" && (isWh ? "Deliveries you are counting. Submit when done; purchasing approves." : "Counted deliveries. Approve to add the good cartons to stock.")}
          {tab === "done" && "Approved deliveries. Print the GRN and carton labels from here."}
          {tab === "hold" && "Cartons held for a quality check. Release them to sell, or reject."}
          {tab === "claims" && "Short, damaged, rejected and held cartons to claim from suppliers."}
        </div>
        {isPur && <button className="btn btn-primary ml-auto" onClick={() => setNewPO(true)}><Plus size={14} /> New PO</button>}
      </div>

      {tab === "hold" || tab === "claims" ? (
        <div className="panel min-h-0 flex-1 overflow-auto">
          {tab === "hold" && (held.length === 0 ? <Empty title="Nothing on quality hold" hint="When you mark cartons as Held while counting a delivery, they wait here until someone decides." /> : (
            <table className="w-full text-[12.5px]">
              <thead><tr className="th text-left"><th className="px-4 py-2.5">Product</th><th>Batch</th><th>Expiry</th><th className="text-right">Cartons</th><th /></tr></thead>
              <tbody>{held.map(({ p, q }) => (
                <tr key={q.id} className="border-t border-line">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><span className="font-medium">{p.name}</span></div></td>
                  <td className="num">{q.no}</td><td className="num">{q.expiry}</td><td className="num text-right font-semibold">{Math.round((q.qty / p.packSize) * 10) / 10}</td>
                  <td className="space-x-1.5 pr-4 text-right">{isWh && <>
                    <button className="btn h-7" onClick={async () => { if (await ask({ title: "Reject this held stock?", body: "It moves to the damaged pile and goes back to the supplier.", confirm: "Reject", danger: true })) { release(p.id, q.id, "reject", by); toast("Moved to damaged stock"); } }}>Reject</button>
                    <button className="btn btn-primary h-7" onClick={() => { release(p.id, q.id, "release", by); toast("Released. Stock is sellable now", { undo: undefined }); }}>Release to stock</button></>}</td>
                </tr>))}</tbody>
            </table>
          ))}
          {tab === "claims" && (claims.length === 0 ? <Empty title="No claims" hint="Shortages, damage, rejections and held cartons from deliveries will be listed here with their cost." /> : (
            <table className="w-full text-[12.5px]">
              <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Supplier · GRN</th><th>Product</th><th className="text-right">Short</th><th className="text-right">Rejected</th><th className="text-right">Damaged</th><th className="text-right">Held</th><th className="text-right">Value at cost</th></tr></thead>
              <tbody>{claims.map(({ grn: g, line: l, product: p, short: sh }, i) => {
                const v = (sh + l.rejected + l.damaged + l.held) * p.costPrice;
                return <tr key={i} className="border-t border-line"><td className="px-4 py-2"><div className="font-medium">{g.supplier}</div><div className="num text-[11px] text-ink3">{g.folio} · {g.deliveryNote}</div></td><td>{p.name}</td>
                  {[sh, l.rejected, l.damaged, l.held].map((n, k) => <td key={k} className="num text-right">{n ? <span className="chip chip-bad">{n}</span> : <span className="text-ink3">—</span>}</td>)}<td className="num text-right font-semibold">{fmt(v)}</td></tr>;
              })}</tbody>
              <tfoot><tr className="border-t border-line"><td colSpan={6} className="px-4 py-2.5 text-right text-xs text-ink2">Total to claim</td><td className="num py-2.5 text-right font-bold">Rs. {fmt(claims.reduce((s, c) => s + (c.short + c.line.rejected + c.line.damaged + c.line.held) * c.product.costPrice, 0))}</td></tr></tfoot>
            </table>
          ))}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(290px,30%)_1fr] gap-3">
          <div className="panel flex min-h-0 flex-col overflow-auto">
            {list.length === 0 && <Empty title={tab === "expected" ? "No deliveries expected" : tab === "counting" ? "No count in progress" : "Nothing approved yet"} hint={tab === "expected" ? "Purchasing creates factory orders; they appear here." : tab === "counting" ? "Start a count from the Expected tab when a truck arrives." : "Approved deliveries are listed here."} action={tab === "counting" ? { label: "Go to expected trucks", onClick: () => setTab("expected") } : undefined} />}
            {tab === "expected" && (["Overdue", "Today", "Coming"] as const).map((grp) => { const items = expected.filter((p) => when(p.expectedAt).group === grp); return items.length ? (
              <div key={grp}><div className="th bg-panel2 px-4 py-1.5">{grp} · {items.length}</div>{items.map((p) => { const w = when(p.expectedAt); return (
                <button key={p.id} onClick={() => setSel({ kind: "po", id: p.id })} className={`row-hover flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${cur?.id === p.id ? "row-sel" : ""}`}>
                  <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.supplier}</div><div className="num text-[11px] text-ink3">{p.folio} · {p.lines.length} item{p.lines.length > 1 ? "s" : ""}{p.status === "partial" && " · partly received"}</div></div>
                  <span className={`chip ${w.tone}`}>{w.label}</span></button>); })}</div>) : null; })}
            {tab !== "expected" && list.map((x) => { const g = grns.find((y) => y.id === x.id)!; return (
              <button key={g.id} onClick={() => setSel({ kind: "grn", id: g.id })} className={`row-hover flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${cur?.id === g.id ? "row-sel" : ""}`}>
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{g.supplier}</div><div className="num text-[11px] text-ink3">{g.folio} · {g.deliveryNote || "no note"} · {ago(g.arrivedAt)}</div></div>
                <span className={`chip ${g.status === "counting" ? "chip-info" : g.status === "counted" ? "chip-warn" : "chip-ok"}`}>{g.status === "counting" ? (g.sentBack ? "Recount" : "Counting") : g.status === "counted" ? "To approve" : "In stock"}</span></button>); })}
          </div>

          <div className="panel flex min-h-0 flex-col">
            {po && <PoView po={po} isWh={isWh} isPur={isPur} onArrive={() => setGate(po)} onShort={() => setShorting(po)} />}
            {grn && <GrnView g={grn} isWh={isWh} isPur={isPur} by={by} onDoc={() => setDoc(grn)} onLabels={() => setLabels(grn)} />}
            {!po && !grn && <Empty title="Select a delivery" hint="Pick one on the left to see its lines." />}
          </div>
        </div>
      )}

      {gate && (
        <MasterForm<{ deliveryNote: string; vehicle: string; driver: string }>
          title={`Truck at the gate · ${gate.supplier}`} initial={{ deliveryNote: "", vehicle: "", driver: "" }} onClose={() => setGate(null)}
          fields={[{ key: "deliveryNote", label: "Supplier delivery note no.", required: true, wide: true, hint: "Printed on the paper the driver hands over" }, { key: "vehicle", label: "Vehicle number", required: true }, { key: "driver", label: "Driver name", required: true }]}
          validate={(v) => ({ vehicle: v.vehicle && !/^[A-Za-z]{2,4}[- ]?\d{2,4}$/.test(v.vehicle.trim()) ? "Looks wrong. Example: LEA-4821" : "" })}
          onSave={(v) => { const id = register(gate.id, v, by); setGate(null); setTab("counting"); setSel({ kind: "grn", id }); toast("Count started. Enter what is on the truck"); }} />
      )}
      {shorting && (
        <MasterForm<{ note: string }> title={`Close ${shorting.folio} short`} initial={{ note: "" }} onClose={() => setShorting(null)}
          fields={[{ key: "note", label: "Why is the rest not coming?", required: true, wide: true }]}
          footer={() => <div className="text-xs text-ink2">The cartons that never arrived are listed as a claim against the supplier.</div>}
          onSave={(v) => { closeShort(shorting.id, v.note); setShorting(null); toast("Order closed short"); }} />
      )}
      {newPO && <NewPO onClose={() => setNewPO(false)} />}
      {doc && <GrnDoc g={grns.find((x) => x.id === doc.id) ?? doc} onClose={() => setDoc(null)} />}
      {labels && <LabelSheet g={grns.find((x) => x.id === labels.id) ?? labels} onClose={() => setLabels(null)} />}
    </div>
  );
}

/* ---------------- a purchase order that has not (fully) arrived ---------------- */
function PoView({ po, isWh, isPur, onArrive, onShort }: { po: PurchaseOrder; isWh: boolean; isPur: boolean; onArrive: () => void; onShort: () => void }) {
  const products = useStore((s) => s.products);
  const grns = useStore((s) => s.grns);
  const w = when(po.expectedAt);
  return (
    <>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center gap-2.5"><h2 className="text-[20px] font-bold">{po.supplier}</h2><span className={`chip ${w.tone}`}>{w.label}</span>{po.status === "partial" && <span className="chip chip-info">Partly received</span>}</div>
        <div className="num mt-1 text-xs text-ink2">{po.folio} · ordered {ago(po.createdAt)}</div>
        <div className="mt-2 text-xs text-ink2">{isWh ? "When the truck reaches the gate, press Truck arrived and enter the delivery note. You then count what is on it." : "Waiting for the truck. The warehouse starts the count when it arrives."}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th text-left"><th className="py-2">Product</th><th className="text-right">Ordered</th><th className="text-right">Received</th><th className="text-right">In count</th><th className="text-right">Still to come</th></tr></thead>
          <tbody>{po.lines.map((l) => { const p = products.find((x) => x.id === l.productId)!; const rec = receivedSoFar(po, grns, l.productId); const inc = receivedSoFar(po, grns, l.productId, true) - rec; return (
            <tr key={l.productId} className="border-t border-line"><td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><div><div className="font-medium">{p.name}</div><div className="num text-[11px] text-ink3">{p.status === "unlisted" ? "New item, not listed yet" : p.code}</div></div></div></td>
              <td className="num text-right">{l.ordered}</td><td className="num text-right">{rec || "—"}</td><td className="num text-right">{inc || "—"}</td><td className="num text-right font-semibold">{remaining(po, grns, l.productId)}</td></tr>); })}</tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
        {isPur && po.status === "partial" && <button className="btn" onClick={onShort}>Close short</button>}
        {isWh && <button className="btn btn-primary h-9" onClick={onArrive}>Truck arrived</button>}
      </div>
    </>
  );
}

/* ---------------- a delivery being counted / reviewed / done ---------------- */
function GrnView({ g, isWh, isPur, by, onDoc, onLabels }: { g: Grn; isWh: boolean; isPur: boolean; by: string; onDoc: () => void; onLabels: () => void }) {
  const products = useStore((s) => s.products);
  const grns = useStore((s) => s.grns);
  const po = useStore((s) => s.purchases.find((p) => p.id === g.poId))!;
  const update = useStore((s) => s.updateGrnLine);
  const fill = useStore((s) => s.fillGrnExpected);
  const scan = useStore((s) => s.scanGrn);
  const submit = useStore((s) => s.submitGrn);
  const approve = useStore((s) => s.approveGrn);
  const sendBack = useStore((s) => s.sendBackGrn);
  const [busy, run] = useBusy();
  const [back, setBack] = useState(false);
  const [code, setCode] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoFor, setPhotoFor] = useState<number>(-1);
  const editing = g.status === "counting" && isWh;
  const checks = g.lines.map((l) => checkLine(l, po, grns, g.id));
  const errors = checks.reduce((s, c) => s + c.errors.length, 0);
  const warns = checks.flatMap((c, i) => c.warnings.map((w) => `${products.find((p) => p.id === g.lines[i].productId)?.name}: ${w}`));
  const total = g.lines.reduce((s, l) => s + l.arrived, 0);
  const sum = (f: (l: GrnLine) => number) => g.lines.reduce((s, l) => s + f(l), 0);
  const shortAll = g.lines.reduce((s, l) => s + Math.max(0, remaining(po, grns.filter((x) => x.id !== g.id), l.productId, true) - accepted(l)), 0);

  const doScan = () => {
    if (!code.trim()) return;
    const r = scan(g.id, code);
    toast(r.ok ? `+1 carton · ${r.name}` : r.name ? `${r.name} is not on this delivery` : `Code ${code} not found`);
    setCode("");
  };
  const doSubmit = async () => {
    if (warns.length && !(await ask({ title: "Submit with warnings?", body: warns.join("\n"), confirm: "Submit anyway" }))) return;
    run(() => { submit(g.id, by); toast("Count submitted. Purchasing will approve it"); });
  };
  const doApprove = async () => {
    if (warns.length && !(await ask({ title: "Approve with warnings?", body: warns.join("\n"), confirm: "Approve anyway" }))) return;
    run(() => { approve(g.id, by); toast("Approved. Good cartons are now sellable"); });
  };

  return (
    <>
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5"><h2 className="text-[20px] font-bold">{g.supplier}</h2><span className={`chip ${g.status === "counting" ? "chip-info" : g.status === "counted" ? "chip-warn" : "chip-ok"}`}>{g.status === "counting" ? "Counting" : g.status === "counted" ? "Waiting for approval" : "Approved"}</span></div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink2"><span className="num font-semibold">{g.folio}</span><span>{po.folio}</span><span>Delivery note <b className="num">{g.deliveryNote}</b></span><span>Vehicle <b className="num">{g.vehicle}</b></span><span>Driver <b>{g.driver}</b></span><span>{ago(g.arrivedAt)}</span></div>
          </div>
          <div className="flex gap-2"><button className="btn" onClick={onDoc}><Printer size={14} /> GRN</button>{g.status === "approved" && <button className="btn" onClick={onLabels}><Tag size={14} /> Labels</button>}</div>
        </div>
        {g.sentBack && <div className="mt-3 rounded-xl border border-[var(--warn-fg)] bg-[var(--warn-bg)] px-3 py-2 text-xs text-[var(--warn-fg)]"><b>Sent back for recount:</b> {g.sentBack}</div>}
        {editing && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative"><ScanLine size={14} className="absolute left-2.5 top-2.5 text-ink3" /><input className="field w-[280px]" style={{ paddingLeft: 32 }} placeholder="Scan or type a product code, Enter = +1 carton" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} autoFocus /></div>
            <button className="btn" onClick={() => { fill(g.id); toast("Filled with the expected quantities. Check them against the truck"); }}>Fill expected</button>
            <span className="text-[11px] text-ink3">Try codes like SE-01, VM-02, LP-05</span>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th text-left"><th className="py-2">Product</th><th className="text-right">Expected</th><th className="text-right">Arrived</th><th className="text-right">Rejected</th><th className="text-right">Damaged</th><th className="text-right">Held</th><th className="pl-6 text-right">Good</th><th className="pl-5">Batch</th><th className="pl-3">Expiry</th></tr></thead>
          <tbody>
            {g.lines.map((l, i) => {
              const p = products.find((x) => x.id === l.productId)!;
              const exp = remaining(po, grns.filter((x) => x.id !== g.id), l.productId, true);
              const c = checks[i];
              const defect = l.rejected + l.damaged + l.held > 0;
              const num = (k: "arrived" | "rejected" | "damaged" | "held", danger = false) => editing
                ? <input className="cell num font-semibold" style={{ color: danger && l[k] ? "var(--bad-fg)" : undefined }} type="number" min={0} value={l[k]} onChange={(e) => update(g.id, i, { [k]: Math.max(0, Math.floor(+e.target.value || 0)) })} />
                : <span className="num">{l[k] || "—"}</span>;
              return (
                <tr key={i} className="border-t border-line align-top">
                  <td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><div><div className="font-medium">{p.name}</div><div className="num text-[11px] text-ink3">{p.code}</div></div></div>
                    {(defect || l.photo) && <div className="mt-1.5 flex items-center gap-2">
                      {editing ? <select className="field h-7 w-44 text-[11.5px]" value={l.reason} onChange={(e) => update(g.id, i, { reason: e.target.value })}><option value="">Reason…</option>{REASONS.map((r) => <option key={r}>{r}</option>)}</select> : l.reason && <span className="chip chip-bad">{l.reason}</span>}
                      {l.photo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={l.photo} alt="Damage photo" className="h-7 w-7 rounded object-cover" />}
                      {editing && <button className="btn h-7 px-2" title="Add a photo" onClick={() => { setPhotoFor(i); photoRef.current?.click(); }}><Camera size={13} /></button>}
                    </div>}
                    {editing && c.errors.map((e) => <div key={e} className="mt-1 text-[11px] font-semibold text-[var(--bad-fg)]">{e}</div>)}
                    {c.warnings.map((w) => <div key={w} className="mt-1 text-[11px] font-semibold text-[var(--warn-fg)]">{w}</div>)}
                  </td>
                  <td className="num py-2 pt-[13px] text-right text-ink2">{exp}</td>
                  <td className="w-20 py-2 text-right">{num("arrived")}</td><td className="w-20 py-2 text-right">{num("rejected", true)}</td><td className="w-20 py-2 text-right">{num("damaged", true)}</td><td className="w-20 py-2 text-right">{num("held", true)}</td>
                  <td className="num py-2 pl-6 pt-[13px] text-right font-bold">{good(l)}</td>
                  <td className="w-32 py-2 pl-5">{editing ? <input className="cell num !text-left" placeholder="TD2608" value={l.batch} onChange={(e) => update(g.id, i, { batch: e.target.value.toUpperCase() })} /> : <span className="num text-ink2">{l.batch || "—"}</span>}</td>
                  <td className="w-28 py-2 pl-3">{editing ? <input className="cell num !text-left" placeholder="2027-08" value={l.expiry} onChange={(e) => update(g.id, i, { expiry: e.target.value })} /> : <span className="num text-ink2">{l.expiry || "—"}</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f && photoFor >= 0) { update(g.id, photoFor, { photo: await resizeImage(f, 200) }); toast("Photo attached"); } e.target.value = ""; }} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-ink2">
          <span>Arrived <b className="num text-ink">{total}</b></span><span>Good <b className="num text-ink">{sum(good)}</b></span>
          {sum((l) => l.rejected) > 0 && <span className="chip chip-bad num">{sum((l) => l.rejected)} rejected</span>}
          {sum((l) => l.damaged) > 0 && <span className="chip chip-bad num">{sum((l) => l.damaged)} damaged</span>}
          {sum((l) => l.held) > 0 && <span className="chip chip-warn num">{sum((l) => l.held)} held</span>}
          {shortAll > 0 && <span className="chip chip-warn num">{shortAll} still to come</span>}
          {editing && errors > 0 && <span className="font-semibold text-[var(--bad-fg)]">{errors} problem{errors > 1 ? "s" : ""} to fix before you can submit</span>}
        </div>
        <div className="flex gap-2">
          {editing && <button className="btn btn-primary h-9" disabled={busy || errors > 0 || total === 0} onClick={doSubmit}>{busy ? <Spinner /> : null}Submit count</button>}
          {g.status === "counted" && isPur && <>
            <button className="btn h-9" onClick={() => setBack(true)}>Send back for recount</button>
            <button className="btn btn-primary h-9" disabled={busy} onClick={doApprove}>{busy ? <Spinner /> : null}Approve and add to stock</button></>}
          {g.status === "counted" && !isPur && <span className="chip chip-warn">Waiting for purchasing</span>}
        </div>
      </div>
      {back && (
        <MasterForm<{ note: string }> title="Send back for recount" initial={{ note: "" }} onClose={() => setBack(false)}
          fields={[{ key: "note", label: "What should be checked again?", required: true, wide: true }]}
          onSave={(v) => { sendBack(g.id, v.note); setBack(false); toast("Sent back to the warehouse"); }} />
      )}
      <div className="hidden">{shortMoney(0)}</div>
    </>
  );
}
