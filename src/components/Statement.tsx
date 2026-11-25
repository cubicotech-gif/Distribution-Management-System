"use client";
import { Printer } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmt, ledger, aging, BUCKETS } from "@/lib/calc";
import { Modal } from "./ui";
import type { Customer } from "@/lib/types";

export default function Statement({ c, onClose }: { c: Customer; onClose: () => void }) {
  const orders = useStore((s) => s.orders);
  const payments = useStore((s) => s.payments);
  const returns = useStore((s) => s.returns);
  const rows = ledger(c, orders, payments, returns);
  const ag = aging(orders, c);
  return (
    <Modal open onClose={onClose} title={`Statement · ${c.name}`} width={720}>
      <div className="printable rounded-xl border border-line bg-white p-5 text-[#16201b]">
        <div className="flex justify-between"><div><div className="text-lg font-bold">ZARIE DISTRIBUTORS</div><div className="text-xs text-[#4b5a52]">Account statement</div></div><div className="text-right text-xs"><b>{c.name}</b><div className="text-[#4b5a52]">{c.area} · {c.phone}</div><div className="text-[#4b5a52]">{c.type === "credit" ? `Limit Rs. ${fmt(c.creditLimit)} · ${c.creditDays} days` : "Cash customer"}</div></div></div>
        <table className="mt-4 w-full text-xs">
          <thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]"><th className="py-1.5">Date</th><th>Ref</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i} className="border-b border-[#e4e8e2]"><td className="py-1.5">{new Date(r.at).toLocaleDateString("en-GB")}</td><td className="num">{r.ref}</td><td>{r.text}</td><td className="num text-right">{r.debit ? fmt(r.debit) : ""}</td><td className="num text-right">{r.credit ? fmt(r.credit) : ""}</td><td className="num text-right font-semibold">{fmt(r.bal)}</td></tr>))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-[#f4f6f3] p-3 text-xs">
          <div className="flex gap-4">{ag.map((x, i) => <span key={i}>{BUCKETS[i]}d: <b className="num">{fmt(x)}</b></span>)}</div>
          <div className="text-sm">Balance due <b className="num">Rs. {fmt(c.balance)}</b></div>
        </div>
      </div>
      <div className="no-print mt-4 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button></div>
    </Modal>
  );
}
