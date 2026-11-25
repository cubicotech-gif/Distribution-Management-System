"use client";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { fmt, orderDue, orderTotal } from "@/lib/calc";
import { Avatar, Empty, toast } from "@/components/ui";

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
        const rets = returns.filter((r) => os.some((o) => o.id === r.orderId) && r.status === "pending").length;
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
                <div className="text-xs text-ink2">Counted <span className="num font-bold text-ink">Rs. {fmt(t.countedCash ?? 0)}</span> {(t.countedCash ?? 0) === expected ? <span className="chip chip-ok ml-1">Matched</span> : <span className="chip chip-bad ml-1">Difference {fmt((t.countedCash ?? 0) - expected)}</span>}</div>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-xs text-ink2">Counted <input className="field num w-36 font-bold" type="number" value={cnt} onChange={(e) => setCounted({ ...counted, [t.id]: +e.target.value })} /></label>
                  {diff !== 0 && <span className="chip chip-bad num">Difference {fmt(diff)}</span>}
                  <div className="ml-auto flex items-center gap-3">
                    {(pend > 0 || unsigned > 0 || rets > 0) && <span className="text-xs text-[var(--warn-fg)]">{pend ? `${pend} not delivered · ` : ""}{unsigned ? `${unsigned} unsigned · ` : ""}{rets ? `${rets} returns at warehouse` : ""}</span>}
                    <button className="btn btn-primary" disabled={pend > 0} onClick={() => { settle(t.id, cnt, user?.initials ?? "—"); toast("Trip settled"); }}>Close trip</button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
