"use client";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { fmt } from "@/lib/calc";
import { AgingBar, Meter, Modal, toast } from "@/components/ui";
import { creditUsedPct } from "@/lib/calc";

export default function Recovery() {
  const customers = useStore((s) => s.customers);
  const payments = useStore((s) => s.payments);
  const collect = useStore((s) => s.collect);
  const user = useUser();
  const [pay, setPay] = useState<string | null>(null);
  const [amt, setAmt] = useState(0);
  const rows = customers.filter((c) => c.balance > 0).sort((a, b) => b.oldestDue - a.oldestDue);
  const total = rows.reduce((s, c) => s + c.balance, 0);
  const overdue = rows.filter((c) => c.oldestDue > c.creditDays).reduce((s, c) => s + c.balance, 0);
  const today = payments.filter((p) => Date.now() - p.at < 86400000).reduce((s, p) => s + p.amount, 0);
  const c = customers.find((x) => x.id === pay);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {[["Total outstanding", total], ["Overdue", overdue], ["Collected today", today]].map(([l, v]) => (
          <div key={l as string} className="panel p-4"><div className="th">{l}</div><div className="num mt-1 text-[24px] font-bold">Rs. {fmt(v as number)}</div></div>
        ))}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Customer</th><th>Terms</th><th className="w-44">Credit used</th><th className="w-52">Aging</th><th className="text-right">Oldest</th><th className="text-right">Balance</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => {
              const late = c.oldestDue > c.creditDays;
              return (
                <tr key={c.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2.5"><div className="font-semibold">{c.name}</div><div className="text-[11px] text-ink3">{c.area}</div></td>
                  <td className="text-ink2">{c.creditDays}d</td>
                  <td className="pr-6"><Meter pct={creditUsedPct(c)} /></td>
                  <td className="pr-6"><AgingBar c={c} /></td>
                  <td className="text-right"><span className={`chip ${late ? "chip-bad" : "chip-mute"} num`}>{c.oldestDue}d</span></td>
                  <td className="num text-right font-semibold">{fmt(c.balance)}</td>
                  <td className="pr-4 text-right"><button className="btn h-7" onClick={() => { setPay(c.id); setAmt(c.balance); }}>Receive payment</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {c && (
        <Modal open onClose={() => setPay(null)} title={`Receive payment · ${c.name}`} width={420}>
          <div className="space-y-3">
            <div className="text-xs text-ink2">Outstanding <span className="num font-semibold text-ink">Rs. {fmt(c.balance)}</span></div>
            <input className="field num text-[16px] font-semibold" type="number" autoFocus value={amt} onChange={(e) => setAmt(Math.max(0, +e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") { collect(c.id, Math.min(amt, c.balance), user?.initials ?? "—"); toast("Payment posted to ledger"); setPay(null); } }} />
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setPay(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { collect(c.id, Math.min(amt, c.balance), user?.initials ?? "—"); toast("Payment posted to ledger"); setPay(null); }}>Post payment</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
