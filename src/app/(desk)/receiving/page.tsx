"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt } from "@/lib/calc";
import { Empty, Thumb, toast } from "@/components/ui";
import NewPO from "@/components/NewPO";

const LBL = { ordered: ["On the way", "chip-info"], received: ["Counted, awaiting approval", "chip-warn"], approved: ["In stock", "chip-ok"] } as const;
type Row = { received: number; damaged: number; batch: string; expiry: string };

export default function Receiving() {
  const purchases = useStore((s) => s.purchases);
  const products = useStore((s) => s.products);
  const receive = useStore((s) => s.receivePO);
  const approve = useStore((s) => s.approvePO);
  const user = useUser();
  const role = user?.role;
  const canCount = role === "warehouse";
  const canApprove = role === "purchasing";
  const canOrder = role === "purchasing";
  const [sel, setSel] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, Record<number, Row>>>({});
  const [newPO, setNewPO] = useState(false);
  const cur = purchases.find((p) => p.id === sel) ?? purchases[0];
  const rowOf = (poId: string, i: number, ordered: number, pid: string): Row => vals[poId]?.[i] ?? { received: ordered, damaged: 0, batch: "", expiry: "" , ...(pid ? {} : {}) };
  const set = (poId: string, i: number, patch: Partial<Row>, base: Row) => setVals({ ...vals, [poId]: { ...(vals[poId] ?? {}), [i]: { ...base, ...patch } } });

  return (
    <div className="grid h-full grid-cols-[minmax(300px,32%)_1fr] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div><div className="text-[14px] font-semibold">Factory orders</div><div className="text-xs text-ink2">Purchase orders and goods received</div></div>
          {canOrder && <button className="btn btn-primary" onClick={() => setNewPO(true)}><Plus size={14} /> New PO</button>}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {purchases.map((p) => (
            <button key={p.id} onClick={() => setSel(p.id)} className={`row-hover flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${cur?.id === p.id ? "row-sel" : ""}`}>
              <div className="min-w-0 flex-1"><div className="font-semibold">{p.supplier}</div><div className="num text-[11px] text-ink3">{p.folio} · {p.lines.length} items · {ago(p.createdAt)}</div></div>
              <span className={`chip ${LBL[p.status][1]}`}>{LBL[p.status][0]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="panel flex min-h-0 flex-col">
        {!cur ? <Empty title="No purchase orders" /> : (
          <>
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5"><h2 className="text-[20px] font-bold">{cur.supplier}</h2><span className={`chip ${LBL[cur.status][1]}`}>{LBL[cur.status][0]}</span></div>
              <div className="num mt-1 text-xs text-ink2">{cur.folio}</div>
              <div className="mt-2 text-xs text-ink2">
                {cur.status === "ordered" && (canCount ? "Unload the truck, count each item against the factory list. Enter damaged cartons separately, and the batch number and expiry printed on the cartons." : "Waiting for the warehouse to count the delivery.")}
                {cur.status === "received" && (canApprove ? "Review the shortages and damages. Approving adds only the good cartons to stock and queues the damaged ones for return to the factory." : "Waiting for purchasing to approve.")}
                {cur.status === "approved" && "Stock added. Bookers can see it live."}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              <table className="w-full text-[12.5px]">
                <thead><tr className="th text-left"><th className="py-2">Product</th><th className="text-right">Ordered</th><th className="text-right">Counted</th><th className="text-right">Damaged</th><th>Batch no.</th><th>Expiry</th><th className="text-right">Short</th></tr></thead>
                <tbody>
                  {cur.lines.map((l, i) => {
                    const p = products.find((x) => x.id === l.productId)!;
                    const editing = cur.status === "ordered" && canCount;
                    const base = rowOf(cur.id, i, l.ordered, p.id);
                    const r = cur.status === "ordered" ? base : { received: l.received ?? 0, damaged: l.damaged ?? 0, batch: l.batch ?? "", expiry: l.expiry ?? "" };
                    const shortBy = l.ordered - r.received;
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><div className="font-medium">{p.name}</div></div></td>
                        <td className="num text-right">{fmt(l.ordered)}</td>
                        <td className="w-24 text-right">{editing ? <input className="cell num font-semibold" type="number" min={0} value={r.received} onChange={(e) => set(cur.id, i, { received: Math.max(0, +e.target.value) }, base)} /> : <span className="num font-semibold">{cur.status === "ordered" ? "—" : fmt(r.received)}</span>}</td>
                        <td className="w-24 text-right">{editing ? <input className="cell num" style={{ color: r.damaged ? "var(--bad-fg)" : undefined }} type="number" min={0} value={r.damaged} onChange={(e) => set(cur.id, i, { damaged: Math.max(0, +e.target.value) }, base)} /> : <span className="num">{cur.status === "ordered" ? "—" : r.damaged}</span>}</td>
                        <td className="w-28">{editing ? <input className="cell num !text-left" placeholder="B2611" value={r.batch} onChange={(e) => set(cur.id, i, { batch: e.target.value }, base)} /> : <span className="num text-ink2">{r.batch || "—"}</span>}</td>
                        <td className="w-28">{editing ? <input className="cell num !text-left" placeholder="2027-06" value={r.expiry} onChange={(e) => set(cur.id, i, { expiry: e.target.value }, base)} /> : <span className="num text-ink2">{r.expiry || "—"}</span>}</td>
                        <td className="text-right">{cur.status === "ordered" && !vals[cur.id] ? "—" : <span className={`chip num ${shortBy === 0 && !r.damaged ? "chip-ok" : "chip-bad"}`}>{shortBy > 0 ? `-${shortBy}` : shortBy < 0 ? `+${-shortBy}` : "0"}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              {cur.status === "ordered" && canCount && <button className="btn btn-primary h-9" onClick={() => { receive(cur.id, Object.fromEntries(cur.lines.map((l, i) => [i, rowOf(cur.id, i, l.ordered, l.productId)])), user?.initials ?? "—"); toast("Count submitted to purchasing"); }}>Confirm count</button>}
              {cur.status === "received" && canApprove && <button className="btn btn-primary h-9" onClick={() => { approve(cur.id); toast("Approved. Good stock is live for bookers"); }}>Approve and add to stock</button>}
            </div>
          </>
        )}
      </div>
      {newPO && <NewPO onClose={() => setNewPO(false)} />}
    </div>
  );
}

