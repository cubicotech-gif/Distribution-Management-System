"use client";
import { useMemo, useState } from "react";
import { Camera, Printer } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt } from "@/lib/calc";
import { daysLeft } from "@/lib/stockctl";
import { resizeImage } from "@/lib/image";
import type { Destruction, Disposition, ReturnNote } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import { Empty, Modal, Spinner, Thumb, toast, useBusy } from "@/components/ui";

type Tab = "coming" | "grade" | "done" | "destroy";
const DISP: Record<Disposition, { label: string; sub: string }> = {
  restock: { label: "Back to stock", sub: "Good condition and plenty of shelf life. Goes to the dock for putaway." },
  deal: { label: "Back to stock as a deal", sub: "Sellable, but short shelf life or old packaging. Bookers see a short-expiry deal tag." },
  supplier: { label: "To the supplier pile", sub: "Damaged or defective. Claim it from the supplier." },
  destroy: { label: "Destroy", sub: "Expired or spoiled. The owner has to approve before it is destroyed." },
};

export default function Returns() {
  const returns = useStore((s) => s.returns);
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const destructions = useStore((s) => s.destructions);
  const receive = useStore((s) => s.receiveReturn);
  const grade = useStore((s) => s.gradeReturn);
  const requestDestroy = useStore((s) => s.requestDestruction);
  const finish = useStore((s) => s.completeDestruction);
  const user = useUser();
  const by = user?.initials ?? "—";
  const canAct = user?.role === "warehouse";
  const [tab, setTab] = useState<Tab>("coming");
  const [rec, setRec] = useState<ReturnNote | null>(null);
  const [gr, setGr] = useState<ReturnNote | null>(null);
  const [req, setReq] = useState(false);
  const [fin, setFin] = useState<Destruction | null>(null);
  const [cert, setCert] = useState<Destruction | null>(null);
  const coming = returns.filter((r) => r.status === "pending");
  const toGrade = returns.filter((r) => r.status === "received");
  const done = returns.filter((r) => r.status === "graded");
  const openD = destructions.filter((d) => d.status === "pending" || d.status === "approved").length;
  const hideMoney = user?.role === "warehouse";
  const tabs: [Tab, string, number][] = [["coming", "Coming back", coming.length], ["grade", "To grade", toGrade.length], ["done", "Done", 0], ["destroy", "Destruction", openD]];

  const row = (r: ReturnNote, action?: React.ReactNode) => {
    const p = products.find((x) => x.id === r.productId)!;
    const c = customers.find((x) => x.id === r.customerId)!;
    const o = orders.find((x) => x.id === r.orderId);
    return (
      <div key={r.id} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
        <Thumb p={p} size={34} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{p.name} <span className="num text-ink3">× {r.receivedQty ?? r.qtyPcs} pcs ({Math.round(((r.receivedQty ?? r.qtyPcs) / p.packSize) * 10) / 10} ctn)</span></div>
          <div className="text-xs text-ink2">{c.name} · <span className="num">{r.folio}</span> · invoice <span className="num">{o?.invoiceNo ?? o?.folio}</span> · reason: <b>{r.reason}</b> · {r.status === "pending" ? `reported by ${r.by} ${ago(r.at)}` : r.receivedAt ? `received by ${r.receivedBy} ${ago(r.receivedAt)}` : ""}</div>
          {r.receivedQty !== undefined && r.receivedQty < r.qtyPcs && <div className="mt-0.5 text-[11.5px] font-semibold text-[var(--warn-fg)]">Reported {r.qtyPcs} pcs, only {r.receivedQty} arrived</div>}
          {r.intakeNote && <div className="mt-0.5 text-[11.5px] text-ink3">Intake note: {r.intakeNote}</div>}
        </div>
        {r.photo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.photo} alt="Return photo" className="h-10 w-10 rounded-lg object-cover" />}
        {action}
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-full max-w-[1050px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-panel p-1">{tabs.map(([k, l, n]) => <button key={k} onClick={() => setTab(k)} className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold ${tab === k ? "bg-accent text-accentink" : "text-ink2"}`}>{l}{n ? <span className="num rounded bg-black/10 px-1 text-[10.5px]">{n}</span> : null}</button>)}</div>
        <div className="text-xs text-ink2">
          {tab === "coming" && "Delivery staff and back office report goods coming back. Receive them when they reach the dock."}
          {tab === "grade" && "Check the physical condition and decide where each item goes. The credit note follows."}
          {tab === "done" && "Graded returns and what happened to them."}
          {tab === "destroy" && "Destruction needs the owner's approval, then a witnessed record and a certificate."}
        </div>
        {tab === "destroy" && canAct && <button className="btn btn-primary ml-auto" onClick={() => setReq(true)}>Request destruction</button>}
      </div>

      <div className="panel min-h-0 flex-1 overflow-auto">
        {tab === "coming" && (coming.length === 0 ? <Empty title="Nothing on the way back" hint="When a driver or back office reports a return, it shows here until the goods reach the dock." /> : coming.map((r) => row(r, canAct && <button className="btn btn-primary" onClick={() => setRec(r)}>Receive at dock</button>)))}
        {tab === "grade" && (toGrade.length === 0 ? <Empty title="Nothing to grade" hint="Received returns wait here for a decision." action={{ label: "See what is coming back", onClick: () => setTab("coming") }} /> : toGrade.map((r) => row(r, canAct && <button className="btn btn-primary" onClick={() => setGr(r)}>Grade</button>)))}
        {tab === "done" && (done.length === 0 ? <Empty title="No graded returns yet" /> : done.map((r) => row(r, <div className="text-right"><span className={`chip ${r.disposition === "restock" || r.disposition === "deal" ? "chip-ok" : r.disposition === "supplier" ? "chip-warn" : "chip-bad"}`}>{r.disposition ? DISP[r.disposition].label : ""}</span>{!hideMoney && <div className="num mt-1 text-xs text-ink2">{r.credit ? `Credit note ${fmt(r.value ?? 0)}` : "No credit"}</div>}</div>)))}
        {tab === "destroy" && (destructions.length === 0 ? <Empty title="No destruction requests" hint="Request one for damaged stock that cannot go back to the supplier, or grade a return as Destroy." action={canAct ? { label: "Request destruction", onClick: () => setReq(true) } : undefined} /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th text-left"><th className="px-4 py-2.5">Record</th><th>Product</th><th className="text-right">Pieces</th><th>Reason</th><th className="pl-5">Status</th><th /></tr></thead>
            <tbody>{destructions.map((d) => { const p = products.find((x) => x.id === d.productId)!; return (
              <tr key={d.id} className="border-t border-line"><td className="num px-4 py-2.5 font-semibold">{d.folio}</td><td>{p.name}</td><td className="num text-right">{d.qtyPcs}</td><td className="text-ink2">{d.reason}</td>
                <td className="pl-5"><span className={`chip ${d.status === "done" ? "chip-ok" : d.status === "approved" ? "chip-info" : d.status === "rejected" ? "chip-bad" : "chip-warn"}`}>{d.status === "pending" ? "Waiting for owner" : d.status === "approved" ? "Approved, destroy it" : d.status === "done" ? "Destroyed" : "Rejected, back to damaged pile"}</span></td>
                <td className="pr-4 text-right">{d.status === "approved" && canAct && <button className="btn btn-primary h-7" onClick={() => setFin(d)}>Record destruction</button>}{d.status === "done" && <button className="btn h-7" onClick={() => setCert(d)}><Printer size={13} /> Certificate</button>}</td></tr>); })}</tbody>
          </table>
        ))}
      </div>

      {rec && <ReceiveModal r={rec} onClose={() => setRec(null)} onSave={(q, n, ph) => { receive(rec.id, q, n, ph, by); setRec(null); setTab("grade"); toast("Received. Now grade it"); }} />}
      {gr && <GradeModal r={gr} onClose={() => setGr(null)} onSave={(d, c) => { grade(gr.id, d, c, by); setGr(null); toast(d === "destroy" ? "Sent to the owner for destruction approval" : "Graded. Credit note issued"); }} />}
      {req && (
        <MasterForm<{ productId: string; qty: number; reason: string }> title="Request destruction" initial={{ productId: products.find((p) => p.damaged > 0)?.id ?? "", qty: 1, reason: "" }} onClose={() => setReq(false)}
          fields={[{ key: "productId", label: "Damaged stock", type: "select", options: products.filter((p) => p.damaged > 0).map((p) => [p.id, `${p.name} (${p.damaged} pcs)`] as [string, string]) }, { key: "qty", label: "Pieces to destroy", type: "number", required: true }, { key: "reason", label: "Why can it not go back to the supplier?", required: true, wide: true }]}
          validate={(v) => { const p = products.find((x) => x.id === v.productId); return { productId: !p ? "No damaged stock to destroy" : "", qty: p && (v.qty < 1 || v.qty > p.damaged) ? `Between 1 and ${p.damaged} pieces` : "" }; }}
          footer={() => <div className="text-xs text-ink2">The pieces leave the damaged pile now. If the owner rejects the request they go back.</div>}
          onSave={(v) => { requestDestroy(v.productId, v.qty, v.reason, by); setReq(false); setTab("destroy"); toast("Sent to the owner for approval"); }} />
      )}
      {fin && (
        <MasterForm<{ witness: string; method: string }> title={`Record destruction ${fin.folio}`} initial={{ witness: "", method: "Crushed and sent to landfill" }} onClose={() => setFin(null)}
          fields={[{ key: "witness", label: "Witness name", required: true, hint: "Someone who is not in the warehouse team" }, { key: "method", label: "Method", type: "select", options: ["Crushed and sent to landfill", "Incinerated", "Drained and recycled", "Handed to a licensed disposal company"].map((m) => [m, m] as [string, string]) }]}
          onSave={(v) => { finish(fin.id, v.witness, v.method, by); setFin(null); toast("Destruction recorded"); }} />
      )}
      {cert && <Certificate d={cert} onClose={() => setCert(null)} />}
    </div>
  );
}

function ReceiveModal({ r, onClose, onSave }: { r: ReturnNote; onClose: () => void; onSave: (q: number, n: string, photo?: string) => void }) {
  const products = useStore((s) => s.products);
  const p = products.find((x) => x.id === r.productId)!;
  const [q, setQ] = useState<number>(r.qtyPcs);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | undefined>();
  const [tried, setTried] = useState(false);
  const err = !(q >= 1) ? "Enter how many pieces arrived" : q > r.qtyPcs ? `More than the ${r.qtyPcs} reported. Ask back office to raise another return.` : "";
  return (
    <Modal open onClose={onClose} title={`Receive ${r.folio} at the dock`} width={480}>
      <div className="space-y-3">
        <div className="text-xs text-ink2">{p.name}: <b>{r.qtyPcs} pcs</b> reported ({Math.round((r.qtyPcs / p.packSize) * 10) / 10} ctn). Count what actually arrived.</div>
        <label className="block"><div className="th mb-1">Pieces that arrived</div><input className={`field num text-[16px] font-bold ${tried && err ? "field-err" : ""}`} type="number" min={1} autoFocus value={Number.isNaN(q) ? "" : q} onChange={(e) => setQ(e.target.value === "" ? NaN : Math.floor(+e.target.value))} />{tried && err && <div className="mt-1 text-[11.5px] font-semibold text-[var(--bad-fg)]">{err}</div>}{q < r.qtyPcs && q >= 1 && <div className="mt-1 text-[11.5px] font-semibold text-[var(--warn-fg)]">{r.qtyPcs - q} pcs fewer than reported. The credit note will be for {q} pcs.</div>}</label>
        <label className="block"><div className="th mb-1">Condition note (optional)</div><input className="field" placeholder="e.g. cartons wet, seal broken" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <div className="flex items-center gap-3">
          <label className="btn cursor-pointer"><Camera size={14} /> {photo ? "Change photo" : "Add a photo"}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await resizeImage(f, 240)); }} /></label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photo && <img src={photo} alt="Return" className="h-12 w-12 rounded-lg object-cover" />}
        </div>
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={() => { setTried(true); if (!err) onSave(q, note, photo); }}>Confirm received</button></div>
      </div>
    </Modal>
  );
}

function GradeModal({ r, onClose, onSave }: { r: ReturnNote; onClose: () => void; onSave: (d: Disposition, credit: boolean) => void }) {
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const p = products.find((x) => x.id === r.productId)!;
  const o = orders.find((x) => x.id === r.orderId);
  const l = o?.lines.find((x) => x.productId === r.productId);
  const al = o?.allocation?.find((a) => o.lines[a.i]?.productId === r.productId);
  const days = al ? daysLeft(al.expiry) : undefined;
  const qty = r.receivedQty ?? r.qtyPcs;
  const value = l ? Math.round((l.unit === "ctn" ? l.rate / p.packSize : l.rate) * (1 - l.discPct / 100) * 1.18 * qty) : 0;
  const suggest: Disposition = r.reason === "expired" || (days !== undefined && days < 0) ? "destroy" : r.reason === "damaged" ? "supplier" : days !== undefined && days < 120 ? "deal" : "restock";
  const [d, setD] = useState<Disposition>(suggest);
  const [credit, setCredit] = useState(true);
  const [busy, run] = useBusy();
  return (
    <Modal open onClose={onClose} title={`Grade ${r.folio}`} width={560}>
      <div className="space-y-3">
        <div className="flex items-center gap-3"><Thumb p={p} size={36} /><div><div className="font-semibold">{p.name} × {qty} pcs</div><div className="text-xs text-ink2">Reason given: <b>{r.reason}</b>{al && <> · from batch <b className="num">{al.batch}</b> (expires {al.expiry}, {days! < 0 ? "already expired" : `${days} days left`})</>}</div></div></div>
        {r.photo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={r.photo} alt="Return" className="h-24 rounded-xl object-cover" />}
        <div className="th">Where does it go?</div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(DISP) as Disposition[]).map((k) => (
            <button key={k} onClick={() => setD(k)} className={`rounded-xl border p-3 text-left transition ${d === k ? "border-accent bg-accentwash" : "border-line hover:border-line2"}`}>
              <div className="flex items-center justify-between text-[13px] font-semibold">{DISP[k].label}{k === suggest && <span className="chip chip-ok">Suggested</span>}</div>
              <div className="mt-0.5 text-[11.5px] text-ink2">{DISP[k].sub}</div>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-panel2 px-3 py-2 text-[12.5px]"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={credit} onChange={(e) => setCredit(e.target.checked)} /> Give the customer a credit note {credit && <b className="num ml-auto">Rs. {fmt(value)}</b>}</label>
        {!credit && <div className="text-[11.5px] text-ink3">Untick only when the customer is at fault, for example goods damaged in their shop.</div>}
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => run(() => onSave(d, credit))}>{busy ? <Spinner /> : null}Confirm grade</button></div>
      </div>
    </Modal>
  );
}

function Certificate({ d, onClose }: { d: Destruction; onClose: () => void }) {
  const p = useStore((s) => s.products.find((x) => x.id === d.productId));
  return (
    <Modal open onClose={onClose} title={`Destruction certificate ${d.folio}`} width={600}>
      <div className="printable rounded-xl border-2 border-[#16201b] bg-white p-6 text-[#16201b]">
        <div className="text-center"><div className="text-lg font-bold tracking-wide">ZARIE DISTRIBUTORS</div><div className="text-xs font-bold uppercase tracking-widest text-[#4b5a52]">Certificate of destruction</div></div>
        <div className="my-4 grid grid-cols-2 gap-3 rounded-lg bg-[#f4f6f3] p-3 text-xs">
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Record</div><b className="num">{d.folio}</b></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Date</div><b>{d.doneAt ? new Date(d.doneAt).toLocaleDateString("en-GB") : ""}</b></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Product</div><b>{p?.name}</b></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Quantity</div><b className="num">{d.qtyPcs} pcs ({p ? Math.round((d.qtyPcs / p.packSize) * 10) / 10 : ""} ctn)</b></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Reason</div><b>{d.reason}</b></div>
          <div><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Method</div><b>{d.method}</b></div>
        </div>
        <div className="text-xs">The goods described above were destroyed in the presence of the witness named below and can no longer enter the supply chain.</div>
        <div className="mt-8 grid grid-cols-3 gap-6 text-[11px] text-[#8a968f]"><span>Witness: <b className="text-[#16201b]">{d.witness}</b><br />Signature ____________</span><span>Warehouse in-charge ({d.by})<br />Signature ____________</span><span>Approved by owner<br />Signature ____________</span></div>
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}
