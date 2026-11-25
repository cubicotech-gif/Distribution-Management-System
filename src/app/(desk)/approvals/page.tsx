"use client";
import Link from "next/link";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt } from "@/lib/calc";
import { Empty, toast } from "@/components/ui";

export default function Approvals() {
  const approvals = useStore((s) => s.approvals);
  const approve = useStore((s) => s.approveRequest);
  const reject = useStore((s) => s.rejectRequest);
  const customers = useStore((s) => s.customers);
  const orders = useStore((s) => s.orders);
  const user = useUser();
  const by = user?.initials ?? "ZK";
  const pending = approvals.filter((a) => a.status === "pending");
  const done = approvals.filter((a) => a.status !== "pending");
  return (
    <div className="mx-auto flex h-full max-w-[900px] flex-col gap-3 overflow-auto">
      <div><h1 className="text-[18px] font-bold">Approvals</h1><p className="text-ink2">Only exceptions reach you: orders over the credit limit, discounts above 5%, overdue customers, and large stock-count differences. Everything else flows without you.</p></div>
      <div className="panel">
        <div className="th border-b border-line px-4 py-2.5">Waiting for you · {pending.length}</div>
        {pending.length === 0 && <Empty title="All clear" hint="Exceptions from back office and warehouse will appear here" />}
        {pending.map((a) => {
          const o = a.kind === "order" ? orders.find((x) => x.id === a.refId) : undefined;
          const c = o ? customers.find((x) => x.id === o.customerId) : undefined;
          return (
            <div key={a.id} className="flex items-center gap-4 border-b border-line px-4 py-3.5 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-semibold">{a.text}</span><span className="chip chip-mute">{a.kind === "order" ? "Order" : "Stock count"}</span></div>
                <div className="mt-0.5 text-xs text-[var(--warn-fg)]">{a.detail}</div>
                <div className="mt-0.5 text-[11px] text-ink3">Requested by {a.by} · {ago(a.at)}{c && c.type === "credit" && <> · balance Rs. {fmt(c.balance)} of {fmt(c.creditLimit)}</>}</div>
              </div>
              <div className="num text-[15px] font-bold">Rs. {fmt(a.amount)}</div>
              {o && <Link href={`/orders?id=${o.id}`} className="btn">View</Link>}
              <button className="btn btn-danger" onClick={() => { reject(a.id, by); toast("Rejected"); }}>Reject</button>
              <button className="btn btn-primary" onClick={() => { approve(a.id, by); toast("Approved"); }}>Approve</button>
            </div>
          );
        })}
      </div>
      <div className="panel">
        <div className="th border-b border-line px-4 py-2.5">Decided</div>
        {done.length === 0 && <div className="p-4 text-ink3">None yet</div>}
        {done.map((a) => <div key={a.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"><span className="flex-1">{a.text}</span><span className="num text-ink3">Rs. {fmt(a.amount)}</span><span className={`chip ${a.status === "approved" ? "chip-ok" : "chip-bad"}`}>{a.status}</span></div>)}
      </div>
    </div>
  );
}
