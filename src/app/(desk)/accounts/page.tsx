"use client";
import { useMemo, useState } from "react";
import { Printer, Download } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt, invoiceDate, orderTotal } from "@/lib/calc";
import { rupeesInWords } from "@/lib/words";
import { Empty, Modal, toast } from "@/components/ui";
import MasterForm from "@/components/MasterForm";
import type { Payment } from "@/lib/types";

type Tab = "cheques" | "day" | "cash";
type CStatus = "received" | "deposited" | "cleared" | "bounced";
const st = (p: Payment): CStatus => p.cheque?.status ?? "received";
const CHIP: Record<CStatus, string> = { received: "chip-info", deposited: "chip-warn", cleared: "chip-ok", bounced: "chip-bad" };
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

function csv(name: string, rows: (string | number)[][]) {
  const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}

export default function Accounts() {
  const [tab, setTab] = useState<Tab>("cheques");
  return (
    <div className="mx-auto flex h-full max-w-[1100px] flex-col gap-3 overflow-auto">
      <div><h1 className="text-[18px] font-bold">Accounts</h1><p className="text-ink2">Track every cheque from the customer to the bank, and see the day's money in and out.</p></div>
      <div className="flex gap-2">
        {([["cheques", "Cheque register"], ["day", "Day book"], ["cash", "Cash book"]] as const).map(([k, l]) => <button key={k} className={`btn ${tab === k ? "btn-primary" : ""}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === "cheques" && <Cheques />}
      {tab === "day" && <DayBook />}
      {tab === "cash" && <CashBook />}
    </div>
  );
}

function Cheques() {
  const payments = useStore((s) => s.payments);
  const customers = useStore((s) => s.customers);
  const act = useStore((s) => s.chequeAction);
  const user = useUser();
  const [f, setF] = useState<CStatus | "all">("all");
  const [sel, setSel] = useState<string[]>([]);
  const [bounce, setBounce] = useState<string | null>(null);
  const [slip, setSlip] = useState<string | null>(null);
  const all = payments.filter((p) => p.mode === "cheque");
  const list = all.filter((p) => f === "all" || st(p) === f);
  const name = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const sum = (s: CStatus) => all.filter((p) => st(p) === s).reduce((a, p) => a + p.amount, 0);
  const selRec = sel.filter((id) => st(all.find((p) => p.id === id)!) === "received");
  const selDep = sel.filter((id) => st(all.find((p) => p.id === id)!) === "deposited");
  const by = user?.initials ?? "—";
  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        {(["received", "deposited", "cleared", "bounced"] as const).map((s) => (
          <button key={s} onClick={() => setF(f === s ? "all" : s)} className={`panel p-4 text-left ${f === s ? "border-accent" : ""}`}>
            <div className="th capitalize">{s === "received" ? "In hand (not banked)" : s}</div><div className="num mt-1 text-[22px] font-bold">Rs. {fmt(sum(s))}</div>
            <div className="text-[11px] text-ink3">{all.filter((p) => st(p) === s).length} cheque(s)</div>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" disabled={!selRec.length} onClick={() => { const n = act(selRec, "deposit", by); setSel([]); if (n) { setSlip(n); toast(`${selRec.length} cheque(s) on deposit slip ${n}`); } }}>Deposit selected ({selRec.length})</button>
        <button className="btn" disabled={!selDep.length} onClick={() => { act(selDep, "clear", by); setSel([]); toast(`${selDep.length} cheque(s) cleared`); }}>Mark cleared ({selDep.length})</button>
        <button className="btn btn-danger" disabled={sel.length !== 1 || st(all.find((p) => p.id === sel[0])!) === "bounced"} onClick={() => setBounce(sel[0])}>Bounced…</button>
        <button className="btn ml-auto" onClick={() => csv("cheque-register.csv", [["cheque", "bank", "date", "customer", "amount", "status", "slip"], ...all.map((p) => [p.cheque?.no ?? "", p.cheque?.bank ?? "", p.cheque?.date ?? "", name(p.customerId), p.amount, st(p), p.cheque?.slip ?? ""])])}><Download size={13} /> CSV</button>
      </div>
      {list.length === 0 ? <Empty title="No cheques here" hint="Cheques are recorded when a payment is received by cheque on Recovery or by the KE on the road." /> : (
        <div className="panel overflow-hidden"><table className="w-full text-[12.5px]">
          <thead><tr className="th text-left"><th className="w-10 px-4 py-2" /><th>Cheque</th><th>Customer</th><th>Bank</th><th>Cheque date</th><th>Status</th><th className="pr-4 text-right">Amount</th></tr></thead>
          <tbody>{list.map((p) => (
            <tr key={p.id} className="border-t border-line">
              <td className="px-4 py-2"><input type="checkbox" aria-label={`Select cheque ${p.cheque?.no}`} checked={sel.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} /></td>
              <td className="num font-semibold">{p.cheque?.no || "—"}</td><td>{name(p.customerId)}</td><td className="text-ink2">{p.cheque?.bank || "—"}</td><td className="num text-ink2">{p.cheque?.date}</td>
              <td><span className={`chip ${CHIP[st(p)]} capitalize`}>{st(p)}</span>{p.cheque?.slip && <button className="ml-2 text-[11px] font-semibold text-accent" onClick={() => setSlip(p.cheque!.slip!)}>{p.cheque.slip}</button>}{p.cheque?.note && <div className="text-[11px] text-ink3">{p.cheque.note}</div>}</td>
              <td className="num pr-4 text-right font-semibold">{fmt(p.amount)}</td>
            </tr>))}</tbody></table></div>
      )}
      {bounce && (
        <MasterForm<{ note: string }> title="Cheque bounced" initial={{ note: "" }} onClose={() => setBounce(null)}
          fields={[{ key: "note", label: "Reason given by the bank", required: true, wide: true, hint: "For example: insufficient funds, signature mismatch, account closed" }]}
          footer={() => <div className="text-xs text-[var(--warn-fg)]">The amount goes back on the customer's account and their invoices become unpaid again. Consider a credit hold.</div>}
          onSave={(v) => { act([bounce], "bounce", by, v.note.trim()); setBounce(null); setSel([]); toast("Cheque marked bounced. Customer balance restored"); }} />
      )}
      {slip && <DepositSlip no={slip} onClose={() => setSlip(null)} />}
    </>
  );
}

function DepositSlip({ no, onClose }: { no: string; onClose: () => void }) {
  const payments = useStore((s) => s.payments);
  const customers = useStore((s) => s.customers);
  const rows = payments.filter((p) => p.cheque?.slip === no);
  const total = rows.reduce((a, p) => a + p.amount, 0);
  return (
    <Modal open onClose={onClose} title={`Bank deposit slip ${no}`} width={600}>
      <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
        <div className="flex justify-between"><div><div className="text-lg font-bold">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">BANK DEPOSIT SLIP · CHEQUES</div></div><div className="text-right text-xs"><div className="num font-bold">{no}</div><div>{new Date(rows[0]?.cheque?.statusAt ?? Date.now()).toLocaleDateString("en-GB")}</div></div></div>
        <table className="mt-4 w-full text-xs"><thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1">#</th><th>Cheque no.</th><th>Bank</th><th>Drawer</th><th className="text-right">Amount</th></tr></thead>
          <tbody>{rows.map((p, i) => <tr key={p.id} className="border-b border-[#e4e8e2]"><td className="py-1">{i + 1}</td><td className="num">{p.cheque?.no}</td><td>{p.cheque?.bank}</td><td>{customers.find((c) => c.id === p.customerId)?.name}</td><td className="num text-right">{fmt(p.amount)}</td></tr>)}</tbody></table>
        <div className="mt-3 flex justify-between border-t border-[#16201b] pt-2 text-sm font-bold"><span>{rows.length} cheque(s)</span><span className="num">Rs. {fmt(total)}</span></div>
        <div className="mt-1 text-xs italic text-[#4b5a52]">{rupeesInWords(total)}</div>
        <div className="mt-8 flex justify-between text-xs text-[#4b5a52]"><span>Prepared by ____________</span><span>Bank stamp ____________</span></div>
      </div>
      <div className="no-print mt-3 flex justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}

function DayBook() {
  const orders = useStore((s) => s.orders);
  const payments = useStore((s) => s.payments);
  const notes = useStore((s) => s.notes);
  const customers = useStore((s) => s.customers);
  const [day, setDay] = useState(iso(Date.now()));
  const name = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const rows = useMemo(() => {
    const r: { at: number; type: string; ref: string; who: string; sale: number; receipt: number }[] = [];
    for (const o of orders) if (o.invoiceNo && iso(invoiceDate(o)) === day) r.push({ at: invoiceDate(o), type: "Invoice", ref: o.invoiceNo, who: name(o.customerId), sale: orderTotal(o), receipt: 0 });
    for (const p of payments) if (iso(p.at) === day) r.push({ at: p.at, type: `Receipt (${p.mode})`, ref: p.cheque?.no ? `Chq ${p.cheque.no}` : "RCPT", who: name(p.customerId), sale: 0, receipt: p.amount });
    for (const n of notes) if (n.status === "issued" && iso(n.at) === day) r.push({ at: n.at, type: n.kind === "credit" ? "Credit note" : "Debit note", ref: n.folio, who: name(n.customerId), sale: n.kind === "credit" ? -n.amount : n.amount, receipt: 0 });
    return r.sort((a, b) => a.at - b.at);
  }, [orders, payments, notes, day]); // eslint-disable-line react-hooks/exhaustive-deps
  const sale = rows.reduce((a, r) => a + r.sale, 0), rec = rows.reduce((a, r) => a + r.receipt, 0);
  return (
    <>
      <div className="flex items-center gap-3"><input type="date" className="field w-44" aria-label="Day" value={day} onChange={(e) => setDay(e.target.value)} />
        <span className="text-xs text-ink2">Sales and notes <b className="num text-ink">Rs. {fmt(sale)}</b> · Money received <b className="num text-ink">Rs. {fmt(rec)}</b></span>
        <button className="btn ml-auto" onClick={() => csv(`day-book-${day}.csv`, [["time", "type", "ref", "party", "sales", "received"], ...rows.map((r) => [new Date(r.at).toLocaleTimeString("en-GB"), r.type, r.ref, r.who, r.sale, r.receipt])])}><Download size={13} /> CSV</button></div>
      {rows.length === 0 ? <Empty title="Nothing posted on this day" hint="Pick another date. Invoices, receipts and notes show here." /> : (
        <div className="panel overflow-hidden"><table className="w-full text-[12.5px]">
          <thead><tr className="th text-left"><th className="px-4 py-2">Time</th><th>Type</th><th>Ref</th><th>Party</th><th className="text-right">Sales</th><th className="pr-4 text-right">Received</th></tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line"><td className="num px-4 py-2 text-ink2">{new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td><td>{r.type}</td><td className="num">{r.ref}</td><td>{r.who}</td><td className="num text-right">{r.sale ? fmt(r.sale) : ""}</td><td className="num pr-4 text-right">{r.receipt ? fmt(r.receipt) : ""}</td></tr>)}</tbody>
          <tfoot><tr className="border-t border-line font-bold"><td colSpan={4} className="px-4 py-2">Total</td><td className="num text-right">{fmt(sale)}</td><td className="num pr-4 text-right">{fmt(rec)}</td></tr></tfoot></table></div>
      )}
    </>
  );
}

function CashBook() {
  const payments = useStore((s) => s.payments);
  const days = useMemo(() => {
    const m = new Map<string, { cash: number; cheque: number; online: number }>();
    for (const p of payments) { const k = iso(p.at); const r = m.get(k) ?? { cash: 0, cheque: 0, online: 0 }; r[p.mode] += p.amount; m.set(k, r); }
    const out = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let run = 0;
    return out.map(([d, r]) => { run += r.cash; return { d, ...r, run }; }).reverse();
  }, [payments]);
  return (
    <>
      <div className="flex items-center"><p className="text-xs text-ink2">Cash received into the office day by day, with the running cash balance. Cheques and online transfers are listed separately because they never sit in the drawer.</p>
        <button className="btn ml-auto" onClick={() => csv("cash-book.csv", [["date", "cash", "cheque", "online", "cash balance"], ...days.map((r) => [r.d, r.cash, r.cheque, r.online, r.run])])}><Download size={13} /> CSV</button></div>
      {days.length === 0 ? <Empty title="No receipts yet" /> : (
        <div className="panel overflow-hidden"><table className="w-full text-[12.5px]">
          <thead><tr className="th text-left"><th className="px-4 py-2">Date</th><th className="text-right">Cash in</th><th className="text-right">Cheques</th><th className="text-right">Online</th><th className="pr-4 text-right">Cash balance</th></tr></thead>
          <tbody>{days.map((r) => <tr key={r.d} className="border-t border-line"><td className="num px-4 py-2">{new Date(r.d).toLocaleDateString("en-GB")}</td><td className="num text-right">{fmt(r.cash)}</td><td className="num text-right">{fmt(r.cheque)}</td><td className="num text-right">{fmt(r.online)}</td><td className="num pr-4 text-right font-semibold">{fmt(r.run)}</td></tr>)}</tbody></table></div>
      )}
    </>
  );
}
