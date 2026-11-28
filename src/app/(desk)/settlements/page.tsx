"use client";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { fmt, orderDue, orderTotal } from "@/lib/calc";
import { Avatar, Empty, Modal, toast } from "@/components/ui";
import { Printer } from "lucide-react";
import { rupeesInWords } from "@/lib/words";
import type { Trip } from "@/lib/types";

export default function Settlements() {
  const trips = useStore((s) => s.trips);
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const payments = useStore((s) => s.payments);
  const returns = useStore((s) => s.returns);
  const users = useStore((s) => s.users);
  const settle = useStore((s) => s.settleTrip);
  const user = useUser();
  const [counted, setCounted] = useState<Record<string, number>>({});
  const [why, setWhy] = useState<Record<string, { reason: string; who: string }>>({});
  const [slip, setSlip] = useState<Trip | null>(null);
  const [errId, setErrId] = useState("");
  const list = trips.filter((t) => t.status !== "loading");
  return (
    <div className="mx-auto flex h-full max-w-[1000px] flex-col gap-3 overflow-auto">
      <div><h1 className="text-[18px] font-bold">Trip settlement</h1><p className="text-ink2">When the truck is back: check every invoice has a signature or a return, count the cash the KE hands over, and close the trip.</p></div>
      {list.length === 0 && <Empty title="No trips yet" />}
      {list.map((t) => {
        const os = t.orderIds.map((id) => orders.find((o) => o.id === id)!).filter(Boolean);
        const pend = os.filter((o) => o.status === "invoiced").length;
        const unsigned = os.filter((o) => (o.status === "delivered" || o.status === "paid") && !o.signature && o.paid === 0 && !o.filed).length;
        const expected = t.status === "closed" ? t.expectedCash ?? 0 : payments.filter((p) => p.tripId === t.id && p.mode === "cash").reduce((a, p) => a + p.amount, 0);
        const cnt = counted[t.id] ?? expected;
        const diff = cnt - expected;
        const rets = returns.filter((r) => os.some((o) => o.id === r.orderId) && r.status !== "graded").length;
        return (
          <div key={t.id} className="panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-3"><span className="num font-bold">{t.folio}</span><span className="num text-ink3">{t.vehicle}</span>
                <span className="flex items-center gap-1 text-xs text-ink2"><Avatar initials={users.find((u) => u.id === t.driverId)?.initials ?? ""} size={18} />{users.find((u) => u.id === t.driverId)?.name}</span>
                <span className="flex items-center gap-1 text-xs text-ink2"><Avatar initials={users.find((u) => u.id === t.keId)?.initials ?? ""} size={18} tone={1} />{users.find((u) => u.id === t.keId)?.name}</span></div>
              <span className={`chip ${t.status === "closed" ? "chip-ok" : "chip-info"}`}>{t.status === "closed" ? "Settled" : "On the road"}</span>
            </div>
            <table className="w-full text-[12.5px]">
              <thead><tr className="th text-left"><th className="px-4 py-2">Invoice</th><th>Customer</th><th className="text-right">Amount</th><th className="text-right">Collected</th><th className="text-right">Credit</th><th className="pl-6">Proof</th></tr></thead>
              <tbody>{os.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <td className="num px-4 py-2 font-semibold">{o.invoiceNo}</td>
                  <td>{customers.find((c) => c.id === o.customerId)?.name}</td>
                  <td className="num text-right">{fmt(orderTotal(o))}</td>
                  <td className="num text-right">{fmt(o.paid)}</td>
                  <td className="num text-right text-ink2">{fmt(orderDue(o))}</td>
                  <td className="pl-6">{o.status === "invoiced" ? <span className="chip chip-warn">Not delivered yet</span> : o.signature ? <span className="chip chip-ok">Signed</span> : <span className="chip chip-mute">Awaiting KE</span>}</td>
                </tr>))}</tbody>
            </table>
            <div className="flex flex-wrap items-center gap-4 border-t border-line px-4 py-3">
              <div className="text-xs text-ink2">Expected cash <span className="num ml-1 text-[15px] font-bold text-ink">Rs. {fmt(expected)}</span></div>
              {t.status === "closed" ? (
                <div className="text-xs text-ink2">Counted <span className="num font-bold text-ink">Rs. {fmt(t.countedCash ?? 0)}</span> {(t.countedCash ?? 0) === expected ? <span className="chip chip-ok ml-1">Matched</span> : <span className="chip chip-bad ml-1">{(t.countedCash ?? 0) < expected ? "Short" : "Excess"} {fmt(Math.abs((t.countedCash ?? 0) - expected))}</span>}{t.diffReason && <span className="ml-2 text-ink2">{t.diffReason} · {t.diffBy}</span>}<button className="btn ml-3 h-7" onClick={() => setSlip(t)}><Printer size={13} /> Handover slip</button></div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-xs text-ink2">Counted <input className="field num w-36 font-bold" type="number" value={cnt} onChange={(e) => setCounted({ ...counted, [t.id]: +e.target.value })} /></label>
                  {diff !== 0 && <span className="chip chip-bad num">{diff < 0 ? "Short" : "Excess"} {fmt(Math.abs(diff))}</span>}
                  {diff !== 0 && (
                    <div className="flex items-center gap-2">
                      <select className={`field w-48 ${errId === t.id && !why[t.id]?.reason ? "field-err" : ""}`} aria-label="Reason for difference" value={why[t.id]?.reason ?? ""} onChange={(e) => setWhy({ ...why, [t.id]: { reason: e.target.value, who: why[t.id]?.who ?? "KE" } })}>
                        <option value="">Why the difference?</option>
                        {(diff < 0 ? ["Counting mistake", "Cash spent on the road", "Customer paid less than receipt", "Cash missing, under investigation"] : ["Customer overpaid", "Counting mistake", "Advance from customer", "Receipt not entered"]).map((r) => <option key={r}>{r}</option>)}
                      </select>
                      <select className="field w-36" aria-label="Responsible" value={why[t.id]?.who ?? "KE"} onChange={(e) => setWhy({ ...why, [t.id]: { reason: why[t.id]?.reason ?? "", who: e.target.value } })}>
                        {["KE", "Driver", "Back office", "Customer", "Not decided"].map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    {(pend > 0 || unsigned > 0 || rets > 0) && <span className="text-xs text-[var(--warn-fg)]">{pend ? `${pend} not delivered · ` : ""}{unsigned ? `${unsigned} unsigned · ` : ""}{rets ? `${rets} returns at warehouse` : ""}</span>}
                    <button className="btn btn-primary" disabled={pend > 0} onClick={() => { if (diff !== 0 && !why[t.id]?.reason) { setErrId(t.id); toast("Choose the reason for the cash difference first"); return; } settle(t.id, cnt, user?.initials ?? "—", diff !== 0 ? why[t.id] : undefined); toast(diff === 0 ? "Trip settled" : "Trip settled. The difference is recorded against " + (why[t.id]?.who ?? "KE")); }}>Close trip</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
      {slip && <HandoverSlip t={slip} onClose={() => setSlip(null)} />}
    </div>
  );
}

function HandoverSlip({ t, onClose }: { t: Trip; onClose: () => void }) {
  const users = useStore((s) => s.users);
  const payments = useStore((s) => s.payments);
  const customers = useStore((s) => s.customers);
  const rows = payments.filter((p) => p.tripId === t.id);
  const sum = (m: string) => rows.filter((p) => p.mode === m).reduce((a, p) => a + p.amount, 0);
  const counted = t.countedCash ?? 0, expected = t.expectedCash ?? 0;
  return (
    <Modal open onClose={onClose} title={`Cash handover · ${t.folio}`} width={560}>
      <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
        <div className="flex justify-between"><div><div className="text-lg font-bold">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">CASH HANDOVER SLIP</div></div><div className="text-right text-xs"><div className="num font-bold">{t.folio}</div><div>{new Date(t.closedAt ?? Date.now()).toLocaleDateString("en-GB")}</div></div></div>
        <div className="mt-3 text-xs text-[#4b5a52]">Vehicle {t.vehicle} · Driver {users.find((u) => u.id === t.driverId)?.name} · KE {users.find((u) => u.id === t.keId)?.name}</div>
        <table className="mt-3 w-full text-xs"><thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1">Customer</th><th>Mode</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{rows.length === 0 && <tr><td colSpan={3} className="py-2 text-[#8a968f]">No collections on this trip.</td></tr>}{rows.map((p) => <tr key={p.id} className="border-b border-[#e4e8e2]"><td className="py-1">{customers.find((c) => c.id === p.customerId)?.name}</td><td className="capitalize">{p.mode}{p.cheque?.no ? ` ${p.cheque.no}` : ""}</td><td className="num text-right">{fmt(p.amount)}</td></tr>)}</tbody></table>
        <table className="mt-3 w-full text-sm"><tbody>
          <tr><td className="py-0.5">Cash expected</td><td className="num text-right">{fmt(sum("cash"))}</td></tr>
          <tr><td className="py-0.5">Cheques handed over</td><td className="num text-right">{fmt(sum("cheque"))}</td></tr>
          <tr><td className="py-0.5">Online transfers</td><td className="num text-right">{fmt(sum("online"))}</td></tr>
          <tr className="border-t border-[#16201b] font-bold"><td className="py-1">Cash counted</td><td className="num text-right">Rs. {fmt(counted)}</td></tr>
          {counted !== expected && <tr className="text-[#a3261b]"><td>{counted < expected ? "Shortage" : "Excess"} ({t.diffReason ?? "no reason"}, {t.diffBy ?? "—"})</td><td className="num text-right">{fmt(Math.abs(counted - expected))}</td></tr>}
        </tbody></table>
        <div className="mt-1 text-xs italic text-[#4b5a52]">{rupeesInWords(counted)}</div>
        <div className="mt-8 flex justify-between text-xs text-[#4b5a52]"><span>KE signature ____________</span><span>Received by {t.settledBy ?? "—"} ____________</span></div>
      </div>
      <div className="no-print mt-3 flex justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}
