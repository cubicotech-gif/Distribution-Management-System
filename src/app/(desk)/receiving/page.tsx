"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt } from "@/lib/calc";
import { Empty, Modal, Thumb, toast } from "@/components/ui";

const LBL = { ordered: ["On the way", "chip-info"], received: ["Counted, awaiting approval", "chip-warn"], approved: ["In stock", "chip-ok"] } as const;

export default function Receiving() {
  const purchases = useStore((s) => s.purchases);
  const products = useStore((s) => s.products);
  const receive = useStore((s) => s.receivePO);
  const approve = useStore((s) => s.approvePO);
  const createPO = useStore((s) => s.createPO);
  const user = useUser();
  const role = user?.role;
  const canCount = role === "warehouse" || role === "admin";
  const canApprove = role === "purchasing" || role === "admin";
  const [sel, setSel] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, Record<number, number>>>({});
  const [newPO, setNewPO] = useState(false);
  const cur = purchases.find((p) => p.id === sel) ?? purchases[0];

  return (
    <div className="grid h-full grid-cols-[minmax(300px,32%)_1fr] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div><div className="text-[14px] font-semibold">Factory orders</div><div className="text-xs text-ink2">Purchase orders and goods received</div></div>
          {canApprove && <button className="btn btn-primary" onClick={() => setNewPO(true)}><Plus size={14} /> New PO</button>}
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
                {cur.status === "ordered" && (canCount ? "Unload the truck, count each item against the factory list and enter what actually arrived." : "Waiting for the warehouse to count the delivery.")}
                {cur.status === "received" && (canApprove ? "Check the differences below, then approve to add this stock for all bookers." : "Waiting for purchasing to approve.")}
                {cur.status === "approved" && "Stock added. Bookers can see it live."}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              <table className="w-full text-[12.5px]">
                <thead><tr className="th text-left"><th className="py-2">Product</th><th className="text-right">Ordered (ctn)</th><th className="text-right">Received (ctn)</th><th className="text-right">Difference</th></tr></thead>
                <tbody>
                  {cur.lines.map((l, i) => {
                    const p = products.find((x) => x.id === l.productId)!;
                    const v = cur.status === "ordered" ? (vals[cur.id]?.[i] ?? l.ordered) : (l.received ?? 0);
                    const d = v - l.ordered;
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><div className="font-medium">{p.name}</div></div></td>
                        <td className="num text-right">{fmt(l.ordered)}</td>
                        <td className="w-28 text-right">
                          {cur.status === "ordered" && canCount ? (
                            <input className="cell num font-semibold" type="number" min={0} value={v} onChange={(e) => setVals({ ...vals, [cur.id]: { ...(vals[cur.id] ?? {}), [i]: Math.max(0, +e.target.value) } })} />
                          ) : <span className="num font-semibold">{cur.status === "ordered" ? "—" : fmt(v)}</span>}
                        </td>
                        <td className="num text-right">{cur.status === "ordered" && !vals[cur.id] ? "—" : <span className={`chip ${d === 0 ? "chip-ok" : d < 0 ? "chip-bad" : "chip-warn"}`}>{d > 0 ? "+" : ""}{d}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              {cur.status === "ordered" && canCount && <button className="btn btn-primary h-9" onClick={() => { receive(cur.id, vals[cur.id] ?? {}); toast("Count submitted to purchasing"); }}>Confirm count</button>}
              {cur.status === "received" && canApprove && <button className="btn btn-primary h-9" onClick={() => { approve(cur.id); toast("Approved. Stock is live for bookers"); }}>Approve and add to stock</button>}
            </div>
          </>
        )}
      </div>
      {newPO && <NewPO onClose={() => setNewPO(false)} onSave={(s, l) => { createPO(s, l); setNewPO(false); toast("Purchase order sent to factory"); }} />}
    </div>
  );
}

function NewPO({ onClose, onSave }: { onClose: () => void; onSave: (s: string, l: { productId: string; ordered: number }[]) => void }) {
  const products = useStore((s) => s.products);
  const low = products.filter((p) => p.stock - p.reserved < p.reorder);
  const [supplier, setSupplier] = useState("Unilever Pakistan");
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(low.map((p) => [p.id, Math.ceil((p.reorder * 2 - (p.stock - p.reserved)) / p.packSize)])));
  const lines = Object.entries(qty).filter(([, n]) => n > 0).map(([productId, ordered]) => ({ productId, ordered }));
  return (
    <Modal open onClose={onClose} title="New factory purchase order" width={560}>
      <div className="space-y-3">
        <input className="field" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        <div className="text-xs text-ink2">Pre-filled with items below reorder level. Edit as needed.</div>
        <div className="rounded-xl border border-line">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-line px-3 py-1.5 last:border-0">
              <Thumb p={p} size={22} /><span className="flex-1">{p.name}</span>
              <span className="num w-20 text-right text-xs text-ink3">{Math.floor((p.stock - p.reserved) / p.packSize)} ctn left</span>
              <input className="cell num w-20 !border-line2 font-semibold" type="number" min={0} value={qty[p.id] ?? 0} onChange={(e) => setQty({ ...qty, [p.id]: Math.max(0, +e.target.value) })} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2"><button className="btn" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!lines.length} onClick={() => onSave(supplier, lines)}>Send to factory</button></div>
      </div>
    </Modal>
  );
}
