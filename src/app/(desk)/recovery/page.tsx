"use client";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { fmt, overdueAmount, creditUsedPct, unpaidOrders, invoiceDate } from "@/lib/calc";
import { AgingBar, Meter, Modal, toast } from "@/components/ui";
import Statement from "@/components/Statement";
import type { Customer, Payment } from "@/lib/types";

export default function Recovery() {
  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const payments = useStore((s) => s.payments);
  const collect = useStore((s) => s.collect);
  const user = useUser();
  const [pay, setPay] = useState<string | null>(null);
  const [stmt, setStmt] = useState<Customer | null>(null);
  const [amt, setAmt] = useState(0);
  const [mode, setMode] = useState<Payment["mode"]>("cash");
  const [route, setRoute] = useState("all");
  const routes = Array.from(new Set(customers.map((c) => c.route)));
  const rows = customers.filter((c) => c.balance > 0 && (route === "all" || c.route === route)).map((c) => ({ c, over: overdueAmount(orders, c) })).sort((a, b) => b.over - a.over || b.c.balance - a.c.balance);
  const total = rows.reduce((s, r) => s + r.c.balance, 0);
  const overdue = rows.reduce((s, r) => s + r.over, 0);
  const mid = new Date(); mid.setHours(0, 0, 0, 0);
  const today = payments.filter((p) => p.at >= mid.getTime()).reduce((s, p) => s + p.amount, 0);
  const c = customers.find((x) => x.id === pay);
  const post = () => { if (!c) return; collect(c.id, Math.min(amt, c.balance), user?.initials ?? "—", undefined, mode); toast("Payment posted. Oldest invoices cleared first"); setPay(null); };
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-4 gap-3">
        {[["Total outstanding", total], ["Overdue (past terms)", overdue], ["Collected today", today]].map(([l, v]) => (
          <div key={l as string} className="panel p-4"><div className="th">{l}</div><div className="num mt-1 text-[24px] font-bold">Rs. {fmt(v as number)}</div></div>
        ))}
        <div className="panel p-4"><div className="th">Route</div><select className="field mt-2" value={route} onChange={(e) => setRoute(e.target.value)}><option value="all">All routes</option>{routes.map((r) => <option key={r}>{r}</option>)}</select></div>
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Customer</th><th>Terms</th><th className="w-40">Credit used</th><th className="w-52">Aging (invoice dates)</th><th className="text-right">Overdue</th><th className="text-right">Balance</th><th /></tr></thead>
          <tbody>
            {rows.map(({ c, over }) => {
              const open = unpaidOrders(orders, c.id);
              return (
                <tr key={c.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2.5"><div className="font-semibold">{c.name}</div><div className="text-[11px] text-ink3">{c.route}{open.length > 0 && <> · {open.length} open invoice{open.length > 1 ? "s" : ""}, oldest {Math.floor((Date.now() - invoiceDate(open[0])) / 86400000)}d</>}</div></td>
                  <td className="text-ink2">{c.type === "cash" ? "Cash" : `${c.creditDays}d`}</td>
                  <td className="pr-6"><Meter pct={creditUsedPct(c)} /></td>
                  <td className="pr-6"><AgingBar c={c} /></td>
                  <td className="text-right">{over > 0 ? <span className="chip chip-bad num">{fmt(over)}</span> : <span className="text-ink3">—</span>}</td>
                  <td className="num text-right font-semibold">{fmt(c.balance)}</td>
                  <td className="space-x-1 pr-4 text-right"><button className="btn h-7" onClick={() => setStmt(c)}>Statement</button><button className="btn btn-primary h-7" onClick={() => { setPay(c.id); setAmt(c.balance); }}>Receive</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {stmt && <Statement c={customers.find((x) => x.id === stmt.id) ?? stmt} onClose={() => setStmt(null)} />}
      {c && (
        <Modal open onClose={() => setPay(null)} title={`Receive payment · ${c.name}`} width={420}>
          <div className="space-y-3">
            <div className="text-xs text-ink2">Outstanding <span className="num font-semibold text-ink">Rs. {fmt(c.balance)}</span>. The amount clears the oldest invoices first.</div>
            <input className="field num text-[16px] font-semibold" type="number" autoFocus value={amt} onChange={(e) => setAmt(Math.max(0, +e.target.value))} onKeyDown={(e) => e.key === "Enter" && post()} />
            <div className="flex gap-2">{(["cash", "cheque", "online"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`btn flex-1 justify-center capitalize ${mode === m ? "btn-primary" : ""}`}>{m}</button>)}</div>
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setPay(null)}>Cancel</button><button className="btn btn-primary" onClick={post}>Post payment</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
