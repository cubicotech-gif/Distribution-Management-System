"use client";
import { useEffect, useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { ago, available, fmt, pcsOf } from "@/lib/calc";
import { Avatar, Empty, Kbd, StatusChip, Thumb, toast } from "@/components/ui";

export default function Pick() {
  const orders = useStore((s) => s.orders);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const pick = useStore((s) => s.pickOrder);
  const user = useUser();
  const by = user?.initials ?? "—";
  const queue = orders.filter((o) => o.status === "approved");
  const done = orders.filter((o) => o.status === "picked");
  const [sel, setSel] = useState<string | null>(null);
  const [vals, setVals] = useState<Record<string, Record<number, number>>>({});
  const cur = queue.find((o) => o.id === sel) ?? queue[0];
  const c = cur && customers.find((x) => x.id === cur.customerId);

  const run = () => {
    if (!cur) return;
    pick(cur.id, vals[cur.id] ?? {}, by);
    toast(`Challan created for ${cur.folio}. Billing can invoice it now`);
  };
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  });

  return (
    <div className="grid h-full grid-cols-[minmax(320px,34%)_1fr] gap-3">
      <div className="panel flex min-h-0 flex-col">
        <div className="border-b border-line px-4 py-3">
          <div className="text-[14px] font-semibold">Pick queue</div>
          <div className="text-xs text-ink2">Approved orders waiting for the physical check</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {queue.length === 0 && <Empty title="Queue is clear" hint="New approved orders appear here instantly" />}
          {queue.map((o) => {
            const cc = customers.find((x) => x.id === o.customerId)!;
            return (
              <button key={o.id} onClick={() => setSel(o.id)} className={`row-hover flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left ${cur?.id === o.id ? "row-sel" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{cc.name}</div>
                  <div className="num text-[11px] text-ink3">{o.folio} · {o.lines.length} lines · {ago(o.createdAt)}</div>
                </div>
                <StatusChip status={o.status} />
              </button>
            );
          })}
          {done.length > 0 && <div className="th px-4 pb-1 pt-4">Challans created</div>}
          {done.map((o) => (
            <div key={o.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-ink2">
              <span className="num flex-1">{o.challanNo} · {customers.find((x) => x.id === o.customerId)?.name}</span>
              <span className="chip chip-ok">Challan</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel flex min-h-0 flex-col">
        {!cur || !c ? <Empty title="Nothing to pick" /> : (
          <>
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center gap-2.5"><h2 className="text-[20px] font-bold">{c.name}</h2><StatusChip status={cur.status} /></div>
              <div className="mt-1 text-xs text-ink2"><span className="num">{cur.folio}</span> · {c.area} · booked by <Avatar initials={useStore.getState().users.find((u) => u.id === cur.bookerId)?.initials ?? ""} size={16} /></div>
              <div className="mt-2 text-xs text-ink2">Count what is physically on the shelf. If you pick less than ordered, the shortfall is dropped from the challan and the invoice automatically.</div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
              <table className="w-full text-[12.5px]">
                <thead><tr className="th text-left"><th className="py-2">Product</th><th>Batch / expiry</th><th>Unit</th><th className="text-right">Ordered</th><th className="text-right">On shelf</th><th className="text-right">Picked</th></tr></thead>
                <tbody>
                  {cur.lines.map((l, i) => {
                    const p = products.find((x) => x.id === l.productId)!;
                    const shelf = Math.floor((p.stock) / (l.unit === "ctn" ? p.packSize : 1));
                    const v = vals[cur.id]?.[i] ?? l.qty;
                    void available; void pcsOf;
                    return (
                      <tr key={i} className="border-t border-line">
                        <td className="py-2"><div className="flex items-center gap-2"><Thumb p={p} size={26} /><div><div className="font-medium">{p.name}</div><div className="num text-[11px] text-ink3">{p.code}</div></div></div></td>
                        <td className="num text-ink2">{p.expiry ?? "—"} <span className="text-[10.5px] text-ink3">FEFO</span></td>
                        <td className="uppercase text-ink2">{l.unit}</td>
                        <td className="num text-right font-semibold">{l.qty}</td>
                        <td className="num text-right"><span className={`chip ${shelf < l.qty ? "chip-bad" : "chip-ok"}`}>{fmt(shelf)}</span></td>
                        <td className="w-24 text-right">
                          <input className="cell num font-semibold" style={{ borderColor: v < l.qty ? "var(--bad-fg)" : undefined }} type="number" min={0} max={l.qty} value={v}
                            onChange={(e) => setVals({ ...vals, [cur.id]: { ...(vals[cur.id] ?? {}), [i]: Math.max(0, Math.min(l.qty, +e.target.value)) } })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-line px-5 py-3">
              <div className="text-xs text-ink2">Creates delivery challan and notifies billing</div>
              <button className="btn btn-primary h-9 px-4 text-[13px]" onClick={run}>Confirm and create challan <Kbd>Ctrl</Kbd><Kbd>↵</Kbd></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
