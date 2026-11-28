"use client";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { fmt, overdueAmount, creditUsedPct, unpaidOrders, invoiceDate } from "@/lib/calc";
import { AgingBar, Meter, Modal, toast } from "@/components/ui";
import MasterForm from "@/components/MasterForm";
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
  const [view, setView] = useState<"all" | "today">("all");
  const [promiseFor, setPromiseFor] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [chq, setChq] = useState({ no: "", bank: "", date: new Date().toISOString().slice(0, 10) });
  const [err, setErr] = useState("");
  const setPromise = useStore((s) => s.setPromise);
  const addFollowUp = useStore((s) => s.addFollowUp);
  const todayIso = new Date().toISOString().slice(0, 10);
  const routes = Array.from(new Set(customers.map((c) => c.route)));
  const needsCall = (c: Customer) => !!c.promise && c.promise.date <= todayIso; // promised for today or already broken
  const quiet = (c: Customer) => overdueAmount(orders, c) > 0 && !c.promise && (!c.followUps?.length || Date.now() - c.followUps[0].at > 7 * 86400000);
  const rows = customers.filter((c) => c.balance > 0 && (route === "all" || c.route === route) && (view === "all" || needsCall(c) || quiet(c))).map((c) => ({ c, over: overdueAmount(orders, c) })).sort((a, b) => b.over - a.over || b.c.balance - a.c.balance);
  const total = rows.reduce((s, r) => s + r.c.balance, 0);
  const overdue = rows.reduce((s, r) => s + r.over, 0);
  const mid = new Date(); mid.setHours(0, 0, 0, 0);
  const today = payments.filter((p) => p.at >= mid.getTime()).reduce((s, p) => s + p.amount, 0);
  const c = customers.find((x) => x.id === pay);
  const post = () => {
    if (!c) return;
    if (amt <= 0) { setErr("Enter an amount above zero"); return; }
    if (mode === "cheque" && (!chq.no.trim() || !chq.bank.trim())) { setErr("Cheque number and bank are needed so the cheque can be tracked"); return; }
    setErr(""); collect(c.id, Math.min(amt, c.balance), user?.initials ?? "—", undefined, mode, mode === "cheque" ? chq : undefined); setChq({ no: "", bank: "", date: todayIso }); toast(mode === "cheque" ? "Cheque recorded. Deposit it from Accounts" : "Payment posted. Oldest invoices cleared first"); setPay(null); };
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="grid grid-cols-4 gap-3">
        {[["Total outstanding", total], ["Overdue (past terms)", overdue], ["Collected today", today]].map(([l, v]) => (
          <div key={l as string} className="panel p-4"><div className="th">{l}</div><div className="num mt-1 text-[24px] font-bold">Rs. {fmt(v as number)}</div></div>
        ))}
        <div className="panel p-4"><div className="th">Route</div><select className="field mt-2" value={route} onChange={(e) => setRoute(e.target.value)}><option value="all">All routes</option>{routes.map((r) => <option key={r}>{r}</option>)}</select></div>
      </div>
      <div className="flex items-center gap-2">
        <button className={`btn ${view === "all" ? "btn-primary" : ""}`} onClick={() => setView("all")}>All customers</button>
        <button className={`btn ${view === "today" ? "btn-primary" : ""}`} onClick={() => setView("today")}>Call today ({customers.filter((x) => x.balance > 0 && (needsCall(x) || quiet(x))).length})</button>
        <span className="text-xs text-ink3">{view === "today" ? "Promises due today or already missed, and overdue customers nobody has called for a week." : ""}</span>
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Customer</th><th>Terms</th><th className="w-40">Credit used</th><th className="w-52">Aging (invoice dates)</th><th className="text-right">Overdue</th><th className="text-right">Balance</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink3">{view === "today" ? "Nobody to call today. Every promise is in the future." : "No outstanding balances on this route."}</td></tr>}
            {rows.map(({ c, over }) => {
              const open = unpaidOrders(orders, c.id);
              return (
                <tr key={c.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2.5"><div className="font-semibold">{c.name}</div><div className="text-[11px] text-ink3">{c.route}{c.promise && <span className={`chip ml-2 ${c.promise.date < todayIso ? "chip-bad" : c.promise.date === todayIso ? "chip-warn" : "chip-info"}`}>{c.promise.date < todayIso ? "Promise missed" : c.promise.date === todayIso ? "Promised today" : `Promised ${c.promise.date}`} · Rs. {fmt(c.promise.amount)}</span>}{c.followUps?.[0] && <div className="mt-0.5 max-w-[380px] truncate text-[11px] italic text-ink3">“{c.followUps[0].text}”</div>}{open.length > 0 && <> · {open.length} open invoice{open.length > 1 ? "s" : ""}, oldest {Math.floor((Date.now() - invoiceDate(open[0])) / 86400000)}d</>}</div></td>
                  <td className="text-ink2">{c.type === "cash" ? "Cash" : `${c.creditDays}d`}</td>
                  <td className="pr-6"><Meter pct={creditUsedPct(c)} /></td>
                  <td className="pr-6"><AgingBar c={c} /></td>
                  <td className="text-right">{over > 0 ? <span className="chip chip-bad num">{fmt(over)}</span> : <span className="text-ink3">—</span>}</td>
                  <td className="num text-right font-semibold">{fmt(c.balance)}</td>
                  <td className="space-x-1 pr-4 text-right"><button className="btn h-7" onClick={() => setPromiseFor(c.id)}>Promise</button><button className="btn h-7" onClick={() => setNoteFor(c.id)}>Note</button><button className="btn h-7" onClick={() => setStmt(c)}>Statement</button><button className="btn btn-primary h-7" onClick={() => { setPay(c.id); setAmt(c.balance); }}>Receive</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {promiseFor && (
        <MasterForm<{ date: string; amount: number }> title={`Promise to pay · ${customers.find((x) => x.id === promiseFor)?.name}`} initial={{ date: todayIso, amount: customers.find((x) => x.id === promiseFor)?.balance ?? 0 }} onClose={() => setPromiseFor(null)}
          fields={[{ key: "date", label: "Customer promised to pay on", type: "date", required: true }, { key: "amount", label: "Amount promised (Rs.)", type: "number", required: true }]}
          validate={(v) => ({ date: !v.date ? "Pick a date" : v.date < todayIso ? "A promise cannot be in the past" : "", amount: !(v.amount > 0) ? "Enter an amount above zero" : "" })}
          onSave={(v) => { setPromise(promiseFor, v.date, v.amount, user?.initials ?? "—"); setPromiseFor(null); toast("Promise noted. It shows in Call today on that date"); }} />
      )}
      {noteFor && (
        <MasterForm<{ text: string }> title={`Follow-up note · ${customers.find((x) => x.id === noteFor)?.name}`} initial={{ text: "" }} onClose={() => setNoteFor(null)}
          fields={[{ key: "text", label: "What happened on the call or visit?", required: true, wide: true, hint: "For example: phone off, shop closed, disputes the last invoice" }]}
          footer={() => <div className="max-h-28 overflow-auto text-[11px] text-ink3">{(customers.find((x) => x.id === noteFor)?.followUps ?? []).map((f, i) => <div key={i}>{new Date(f.at).toLocaleDateString("en-GB")} · {f.by}: {f.text}</div>)}</div>}
          onSave={(v) => { addFollowUp(noteFor, v.text.trim(), user?.initials ?? "—"); setNoteFor(null); toast("Note saved"); }} />
      )}
      {stmt && <Statement c={customers.find((x) => x.id === stmt.id) ?? stmt} onClose={() => setStmt(null)} />}
      {c && (
        <Modal open onClose={() => setPay(null)} title={`Receive payment · ${c.name}`} width={420}>
          <div className="space-y-3">
            <div className="text-xs text-ink2">Outstanding <span className="num font-semibold text-ink">Rs. {fmt(c.balance)}</span>. The amount clears the oldest invoices first.</div>
            <input className="field num text-[16px] font-semibold" type="number" autoFocus value={amt} onChange={(e) => setAmt(Math.max(0, +e.target.value))} onKeyDown={(e) => e.key === "Enter" && post()} />
            <div className="flex gap-2">{(["cash", "cheque", "online"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`btn flex-1 justify-center capitalize ${mode === m ? "btn-primary" : ""}`}>{m}</button>)}</div>
            {mode === "cheque" && <div className="grid grid-cols-2 gap-2"><input className="field" placeholder="Cheque number" aria-label="Cheque number" value={chq.no} onChange={(e) => setChq({ ...chq, no: e.target.value })} /><input className="field" placeholder="Bank and branch" aria-label="Bank" value={chq.bank} onChange={(e) => setChq({ ...chq, bank: e.target.value })} /><input className="field col-span-2" type="date" aria-label="Cheque date" value={chq.date} onChange={(e) => setChq({ ...chq, date: e.target.value })} /></div>}
            {err && <div className="text-xs font-semibold text-[var(--bad-fg)]">{err}</div>}
            <div className="flex justify-end gap-2"><button className="btn" onClick={() => setPay(null)}>Cancel</button><button className="btn btn-primary" onClick={post}>Post payment</button></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
