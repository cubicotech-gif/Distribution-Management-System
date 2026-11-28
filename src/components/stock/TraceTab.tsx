"use client";
import { useMemo, useState } from "react";
import { can } from "@/lib/perm";
import { Printer, Siren } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt } from "@/lib/calc";
import { daysLeft, traceBatch } from "@/lib/stockctl";
import { Empty, Modal, Thumb, ask, toast } from "../ui";

export default function TraceTab({ start }: { start?: { productId: string; batch: string } }) {
  const products = useStore((s) => s.products);
  const ledger = useStore((s) => s.ledger);
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const recall = useStore((s) => s.quarantineBatch);
  const user = useUser();
  const canAct = can(user, "stock") || user?.role === "purchasing";
  const all = useMemo(() => {
    const m = new Map<string, { productId: string; batch: string }>();
    for (const e of ledger) if (e.kind === "receipt" || e.kind === "pick") m.set(`${e.productId}|${e.batch}`, { productId: e.productId, batch: e.batch });
    for (const p of products) for (const b of p.batches) m.set(`${p.id}|${b.no}`, { productId: p.id, batch: b.no });
    return Array.from(m.values()).filter((x) => products.find((p) => p.id === x.productId)).sort((a, b) => a.batch.localeCompare(b.batch));
  }, [ledger, products]);
  const [key, setKey] = useState(start ? `${start.productId}|${start.batch}` : "");
  const [sheet, setSheet] = useState(false);
  const sel = all.find((x) => `${x.productId}|${x.batch}` === key);
  const p = sel ? products.find((x) => x.id === sel.productId)! : undefined;

  const customersHit = sel ? traceBatch(ledger, orders, customers, sel.productId, sel.batch) : [];
  const rcv = sel ? ledger.find((e) => e.kind === "receipt" && e.productId === sel.productId && e.batch === sel.batch) : undefined;
  const rows = p && sel ? p.batches.filter((b) => b.no === sel.batch && b.qty > 0) : [];
  const held = p && sel ? p.quarantine.filter((b) => b.no === sel.batch) : [];
  const inWh = rows.reduce((s, b) => s + b.qty, 0) / (p?.packSize ?? 1);
  const onHold = held.reduce((s, b) => s + b.qty, 0) / (p?.packSize ?? 1);
  const sent = customersHit.reduce((s, c) => s + c.pcs, 0) / (p?.packSize ?? 1);
  const expiry = rows[0]?.expiry ?? held[0]?.expiry;
  const groups = Array.from(new Map(customersHit.map((c) => [c.name, c])).values());

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="field w-[420px]" value={key} onChange={(e) => setKey(e.target.value)}>
          <option value="">Choose a batch to trace…</option>
          {all.map((x) => { const pr = products.find((q) => q.id === x.productId)!; return <option key={`${x.productId}|${x.batch}`} value={`${x.productId}|${x.batch}`}>{x.batch} · {pr.name}</option>; })}
        </select>
        <span className="text-xs text-ink2">Answers: where did this batch come from, where is it now, and who has it?</span>
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        {!sel || !p ? <Empty title="Pick a batch" hint="If a supplier recalls a batch, choose it here to see every customer who received it and the stock still in the warehouse." /> : (
          <div className="p-5">
            <div className="flex items-start gap-3"><Thumb p={p} size={44} />
              <div className="flex-1"><h2 className="text-[20px] font-bold leading-tight">{p.name}</h2><div className="num mt-0.5 text-xs text-ink2">Batch <b>{sel.batch}</b>{expiry && <> · expires {expiry} ({daysLeft(expiry) < 0 ? "expired" : `${daysLeft(expiry)} days left`})</>}</div></div>
              {canAct && (inWh > 0) && <button className="btn btn-danger" onClick={async () => { if (await ask({ title: `Start a recall on batch ${sel.batch}?`, body: `All ${fmt(inWh)} cartons still in the warehouse move to the quality-hold cage and cannot be sold or picked. Customers who already received it are listed so you can call them.`, confirm: "Hold the stock", danger: true })) { recall(p.id, sel.batch, "Supplier recall", user?.initials ?? "—"); toast(`${fmt(inWh)} ctn of ${sel.batch} put on hold`); setSheet(true); } }}><Siren size={14} /> Start recall</button>}
              <button className="btn" onClick={() => setSheet(true)}><Printer size={14} /> Call list</button>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3">
              {[["Received", rcv ? `${fmt(rcv.pcs / p.packSize)} ctn` : "—", rcv ? `${rcv.ref} · ${new Date(rcv.at).toLocaleDateString("en-GB")}${rcv.note ? ` · ${rcv.note}` : ""}` : "No receipt record"], ["Sent to customers", `${fmt(sent)} ctn`, `${groups.length} customer${groups.length === 1 ? "" : "s"}`], ["In the warehouse", `${fmt(inWh)} ctn`, rows.map((b) => b.bin).join(", ") || "None left"], ["On quality hold", `${fmt(onHold)} ctn`, held.length ? "Cage Q-01" : "None"]].map(([l, v, sub]) => (
                <div key={l} className="rounded-xl border border-line bg-panel2 p-3"><div className="th">{l}</div><div className="num mt-1 text-[20px] font-bold">{v}</div><div className="mt-0.5 truncate text-[11px] text-ink3" title={sub}>{sub}</div></div>))}
            </div>
            <div className="th mb-1.5 mt-5">Customers who received this batch</div>
            {customersHit.length === 0 ? <div className="rounded-xl border border-dashed border-line2 p-6 text-center text-xs text-ink3">Nothing from this batch has been sent out yet.</div> : (
              <table className="w-full text-[12.5px]">
                <thead><tr className="th text-left"><th className="py-2">Customer</th><th>Route</th><th>Phone</th><th>Challan</th><th>Invoice</th><th className="text-right">Cartons</th><th className="pl-5">Status</th></tr></thead>
                <tbody>{customersHit.map((c) => (
                  <tr key={c.key} className="border-t border-line"><td className="py-2 font-medium">{c.name}<div className="text-[10.5px] text-ink3">{new Date(c.at).toLocaleDateString("en-GB")}</div></td><td className="text-ink2">{c.route || "—"}</td><td className="num text-ink2">{c.phone || "—"}</td><td className="num">{c.ref}</td><td className="num text-ink2">{c.invoice ?? "—"}</td><td className="num text-right font-semibold">{fmt(c.pcs / p.packSize)}</td><td className="pl-5"><span className={`chip ${c.status === "Delivered" ? "chip-ok" : "chip-warn"}`}>{c.status}</span></td></tr>))}</tbody>
              </table>
            )}
          </div>
        )}
      </div>
      {sheet && sel && p && (
        <Modal open onClose={() => setSheet(false)} title={`Recall call list · batch ${sel.batch}`} width={720}>
          <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
            <div className="flex justify-between"><div><div className="text-lg font-bold tracking-wide">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">Recall call list</div></div><div className="text-right text-xs"><div><b>{p.name}</b></div><div className="num">Batch {sel.batch}{expiry ? ` · exp ${expiry}` : ""}</div><div className="num text-[#4b5a52]">{new Date().toLocaleDateString("en-GB")}</div></div></div>
            <table className="mt-4 w-full text-xs"><thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1.5">Customer</th><th>Phone</th><th>Route</th><th className="text-right">Cartons</th><th>Called ✓</th></tr></thead>
              <tbody>{customersHit.map((c) => <tr key={c.key} className="border-b border-[#e4e8e2]"><td className="py-1.5">{c.name}</td><td className="num">{c.phone || "—"}</td><td>{c.route}</td><td className="num text-right">{fmt(c.pcs / p.packSize)}</td><td>☐</td></tr>)}</tbody></table>
            <div className="mt-4 rounded-lg bg-[#f4f6f3] p-3 text-xs">Still in the warehouse: <b className="num">{fmt(inWh)} ctn</b> · On quality hold: <b className="num">{fmt(onHold)} ctn</b></div>
          </div>
          <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={() => setSheet(false)}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
        </Modal>
      )}
    </div>
  );
}
