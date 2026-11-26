"use client";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt, orderDue, orderTotal } from "@/lib/calc";
import { Empty, Spinner, StatusChip, toast, useBusy } from "@/components/ui";
import { InvoiceDoc } from "@/components/OrderDetail";
import type { Order } from "@/lib/types";

export default function Invoices() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const invoice = useStore((s) => s.invoiceOrder);
  const invoiceAll = useStore((s) => s.invoiceAll);
  const user = useUser();
  const by = user?.initials ?? "—";
  const [view, setView] = useState<Order | null>(null);
  const [busy, run] = useBusy();
  const [f, setF] = useState<"draft" | "open" | "all">("draft");
  const base = orders.filter((o) => ["picked", "invoiced", "delivered", "paid"].includes(o.status));
  const rows = base.filter((o) => (f === "all" ? true : f === "draft" ? o.status === "picked" && !!o.packed : o.status !== "picked" && orderDue(o) > 1));
  const drafts = base.filter((o) => o.status === "picked" && o.packed).length;
  const packing = base.filter((o) => o.status === "picked" && !o.packed).length;
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2">
        <button className={`btn ${f === "draft" ? "btn-primary" : ""}`} onClick={() => setF("draft")}>Ready to invoice <span className="num">{drafts}</span></button>
        {packing > 0 && <span className="chip chip-info">{packing} still at the packing table</span>}
        <button className={`btn ${f === "open" ? "btn-primary" : ""}`} onClick={() => setF("open")}>Unpaid</button>
        <button className={`btn ${f === "all" ? "btn-primary" : ""}`} onClick={() => setF("all")}>All</button>
        <button className="btn btn-primary ml-auto" disabled={!drafts || busy} onClick={() => run(() => { toast(`${invoiceAll(by)} invoices issued`); })}>{busy ? <Spinner /> : null}Invoice all ready ({drafts})</button>
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? <Empty title="Nothing here" hint="When the warehouse finishes picking an order, its challan shows up under Ready to invoice." /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Invoice</th><th>Customer</th><th>Challan</th><th>Terms</th><th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-right">Due</th><th>Status</th><th>Age</th><th /></tr></thead>
            <tbody>
              {rows.map((o) => {
                const c = customers.find((x) => x.id === o.customerId)!;
                return (
                  <tr key={o.id} className="row-hover border-t border-line">
                    <td className="num px-4 py-2.5 font-semibold">{o.invoiceNo ?? <span className="text-ink3">Draft · {o.folio}</span>}</td>
                    <td className="font-medium">{c.name}</td>
                    <td className="num text-ink2">{o.challanNo}</td>
                    <td className="text-ink2">{c.type === "credit" ? `Credit ${c.creditDays}d` : "Cash"}</td>
                    <td className="num text-right font-semibold">{fmt(orderTotal(o))}</td>
                    <td className="num text-right text-ink2">{fmt(o.paid)}</td>
                    <td className="num text-right">{o.status === "picked" ? "—" : fmt(orderDue(o))}</td>
                    <td><StatusChip status={o.status} packed={o.packed} /></td>
                    <td className="text-ink3">{ago(o.createdAt)}</td>
                    <td className="space-x-1.5 pr-4 text-right">
                      <button className="btn h-7" onClick={() => setView(o)}>View</button>
                      {o.status === "picked" && o.packed && <button className="btn btn-primary h-7" onClick={() => { invoice(o.id, by); toast(`Invoice issued for ${o.folio}`); }}>Create invoice</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {view && <InvoiceDoc o={orders.find((x) => x.id === view.id) ?? view} onClose={() => setView(null)} />}
    </div>
  );
}
