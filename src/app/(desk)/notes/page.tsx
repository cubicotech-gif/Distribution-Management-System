"use client";
import { useMemo, useState } from "react";
import { Plus, Printer } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt, ago } from "@/lib/calc";
import { rupeesInWords } from "@/lib/words";
import { Empty, Modal, toast } from "@/components/ui";
import MasterForm from "@/components/MasterForm";
import type { CreditNote } from "@/lib/types";

type Row = CreditNote & { source: "manual" | "return" };

export default function Notes() {
  const notes = useStore((s) => s.notes);
  const returns = useStore((s) => s.returns);
  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const issue = useStore((s) => s.issueNote);
  const user = useUser();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Row | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "credit" | "debit">("all");

  const rows: Row[] = useMemo(() => {
    const fromReturns: Row[] = returns.filter((r) => r.status === "graded" && r.credit && (r.value ?? 0) > 0).map((r, i) => ({
      id: `ret-${r.id}`, folio: `CN-R${i + 1}`, kind: "credit", customerId: r.customerId, orderId: r.orderId, base: r.value ?? 0, taxPct: 0, amount: r.value ?? 0,
      reason: `Goods returned (${r.reason})`, status: "issued", by: r.gradedBy ?? "—", at: r.gradedAt ?? r.at, source: "return",
    }));
    return [...notes.map((n) => ({ ...n, source: "manual" as const })), ...fromReturns].sort((a, b) => b.at - a.at);
  }, [notes, returns]);
  const cname = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";
  const list = rows.filter((n) => (kind === "all" || n.kind === kind) && (!q || (cname(n.customerId) + n.folio + n.reason).toLowerCase().includes(q.toLowerCase())));
  const total = (k: "credit" | "debit") => rows.filter((n) => n.kind === k && n.status === "issued").reduce((s, n) => s + n.amount, 0);

  return (
    <div className="mx-auto flex h-full max-w-[1100px] flex-col gap-3 overflow-auto">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-[18px] font-bold">Credit and debit notes</h1><p className="text-ink2">A credit note reduces what a customer owes (price fix, damaged goods, goodwill). A debit note adds a charge. Over Rs. 25,000 needs the owner.</p></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={14} /> New note</button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input className="field w-64" placeholder="Search customer, number or reason" aria-label="Search notes" value={q} onChange={(e) => setQ(e.target.value)} />
        {(["all", "credit", "debit"] as const).map((k) => <button key={k} className={`btn ${kind === k ? "btn-primary" : ""}`} onClick={() => setKind(k)}>{k === "all" ? "All" : k === "credit" ? "Credit notes" : "Debit notes"}</button>)}
        <span className="ml-auto text-xs text-ink2">Credits issued <b className="num text-ink">Rs. {fmt(total("credit"))}</b> · Debits <b className="num text-ink">Rs. {fmt(total("debit"))}</b></span>
      </div>
      {list.length === 0 ? <Empty title="No notes found" hint="Issue one with New note, or clear the filter." /> : (
        <div className="panel overflow-hidden">
          <table className="w-full text-[12.5px]">
            <thead><tr className="th text-left"><th className="px-4 py-2">Number</th><th>Customer</th><th>Reason</th><th>Status</th><th className="text-right">Amount</th><th className="pr-4 text-right">When</th></tr></thead>
            <tbody>{list.map((n) => (
              <tr key={n.id} className="cursor-pointer border-t border-line hover:bg-[var(--hover)]" onClick={() => setView(n)}>
                <td className="num px-4 py-2 font-semibold">{n.folio}</td>
                <td>{cname(n.customerId)}</td>
                <td className="max-w-[320px] truncate text-ink2">{n.reason}</td>
                <td><span className={`chip ${n.status === "issued" ? "chip-ok" : n.status === "pending" ? "chip-warn" : "chip-bad"}`}>{n.status === "pending" ? "Waiting for owner" : n.status === "rejected" ? "Rejected" : n.kind === "credit" ? "Credit issued" : "Debit issued"}</span></td>
                <td className={`num text-right font-semibold ${n.kind === "credit" ? "text-[var(--ok-fg)]" : ""}`}>{n.kind === "credit" ? "−" : "+"}{fmt(n.amount)}</td>
                <td className="pr-4 text-right text-ink3">{ago(n.at)}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {open && (
        <MasterForm<{ kind: string; customerId: string; orderId: string; base: number; taxPct: number; reason: string }>
          title="New credit / debit note" initial={{ kind: "credit", customerId: "", orderId: "", base: 0, taxPct: 18, reason: "" }} onClose={() => setOpen(false)}
          fields={[
            { key: "kind", label: "Type", type: "select", options: [["credit", "Credit note (customer owes less)"], ["debit", "Debit note (customer owes more)"]] },
            { key: "customerId", label: "Customer", type: "select", required: true, options: [["", "Choose customer"], ...customers.map((c) => [c.id, c.name] as [string, string])] },
            { key: "orderId", label: "Against invoice (optional)", type: "select", options: [["", "No invoice"], ...orders.filter((o) => o.invoiceNo).map((o) => [o.id, `${o.invoiceNo} · ${cname(o.customerId)}`] as [string, string])] },
            { key: "base", label: "Amount before tax (Rs.)", type: "number", required: true },
            { key: "taxPct", label: "Sales tax (%)", type: "number" },
            { key: "reason", label: "Reason", required: true, wide: true, hint: "Printed on the note, for example: rate difference on invoice, damaged cartons accepted" },
          ]}
          validate={(v) => ({ customerId: v.customerId ? "" : "Choose a customer", base: v.base > 0 ? "" : "Enter an amount above zero", taxPct: v.taxPct < 0 || v.taxPct > 30 ? "Between 0 and 30%" : "", reason: v.reason.trim().length < 5 ? "Give a reason of at least 5 letters" : "" })}
          footer={(v) => { const t = Math.round((v.base || 0) * (1 + (v.taxPct || 0) / 100)); return <div className="text-xs text-ink2">Total <b className="num text-ink">Rs. {fmt(t)}</b>{t > 25000 ? <span className="ml-2 text-[var(--warn-fg)]">Goes to the owner for approval first</span> : null}</div>; }}
          onSave={(v) => { const n = issue({ kind: v.kind as "credit" | "debit", customerId: v.customerId, orderId: v.orderId || undefined, base: v.base, taxPct: v.taxPct || 0, reason: v.reason.trim(), by: user?.initials ?? "—" }); setOpen(false); toast(n.status === "pending" ? `${n.folio} sent to the owner for approval` : `${n.folio} issued`); }} />
      )}
      {view && <NoteDoc n={view} name={cname(view.customerId)} invoice={orders.find((o) => o.id === view.orderId)?.invoiceNo} onClose={() => setView(null)} />}
    </div>
  );
}

function NoteDoc({ n, name, invoice, onClose }: { n: Row; name: string; invoice?: string; onClose: () => void }) {
  const tax = n.amount - n.base;
  return (
    <Modal open onClose={onClose} title={`${n.kind === "credit" ? "Credit" : "Debit"} note ${n.folio}`} width={620}>
      <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
        <div className="flex justify-between"><div><div className="text-lg font-bold">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">{n.kind === "credit" ? "CREDIT NOTE" : "DEBIT NOTE"}</div></div><div className="text-right text-xs"><div className="num font-bold">{n.folio}</div><div>{new Date(n.at).toLocaleDateString("en-GB")}</div></div></div>
        <div className="mt-4 text-sm"><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Customer</div><div className="font-semibold">{name}</div>{invoice && <div className="text-xs text-[#4b5a52]">Against invoice {invoice}</div>}</div>
        <div className="mt-3 rounded border border-[#d3d9d0] p-3 text-sm"><div className="text-[10px] uppercase tracking-wider text-[#8a968f]">Reason</div>{n.reason}</div>
        <table className="mt-4 w-full text-sm"><tbody>
          <tr><td className="py-1">Amount before tax</td><td className="num text-right">{fmt(n.base)}</td></tr>
          <tr><td className="py-1">Sales tax {n.taxPct}%</td><td className="num text-right">{fmt(tax)}</td></tr>
          <tr className="border-t border-[#16201b] font-bold"><td className="py-1.5">Total {n.kind === "credit" ? "credited" : "charged"}</td><td className="num text-right">Rs. {fmt(n.amount)}</td></tr>
        </tbody></table>
        <div className="mt-2 text-xs italic text-[#4b5a52]">{rupeesInWords(n.amount)}</div>
        <div className="mt-6 flex justify-between text-xs text-[#4b5a52]"><span>Prepared by {n.by}</span><span>{n.status === "pending" ? "NOT VALID until the owner approves" : n.status === "rejected" ? "REJECTED" : "Authorised signature ____________"}</span></div>
      </div>
      <div className="no-print mt-3 flex justify-end"><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}
