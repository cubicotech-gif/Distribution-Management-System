"use client";
import { useStore, useUser } from "@/lib/store";
import { ago, fmt } from "@/lib/calc";
import { Empty, Thumb, toast } from "@/components/ui";

export default function Returns() {
  const returns = useStore((s) => s.returns);
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const inspect = useStore((s) => s.inspectReturn);
  const user = useUser();
  const pending = returns.filter((r) => r.status === "pending");
  const done = returns.filter((r) => r.status === "inspected");
  const hideMoney = user?.role === "warehouse";
  return (
    <div className="mx-auto flex h-full max-w-[1000px] flex-col gap-3">
      <div><h1 className="text-[18px] font-bold">Returns inspection</h1><p className="text-ink2">Goods coming back from customers. Check the physical condition and decide. Good items go back on the shelf; damaged items go to the damaged pile for the factory.</p></div>
      <div className="panel">
        <div className="th border-b border-line px-4 py-2.5">Waiting for inspection · {pending.length}</div>
        {pending.length === 0 && <Empty title="Nothing to inspect" />}
        {pending.map((r) => {
          const p = products.find((x) => x.id === r.productId)!;
          const c = customers.find((x) => x.id === r.customerId)!;
          return (
            <div key={r.id} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
              <Thumb p={p} size={34} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{p.name} <span className="num text-ink3">× {r.qtyPcs} pcs ({Math.round((r.qtyPcs / p.packSize) * 10) / 10} ctn)</span></div>
                <div className="text-xs text-ink2">{c.name} · <span className="num">{r.folio}</span> · reason: <b>{r.reason}</b> · reported by {r.by} · {ago(r.at)}</div>
              </div>
              <button className="btn" onClick={() => { inspect(r.id, "damaged", user?.initials ?? "—"); toast("Moved to damaged stock. Credit note issued"); }}>Damaged</button>
              <button className="btn btn-primary" onClick={() => { inspect(r.id, "good", user?.initials ?? "—"); toast("Back on the shelf. Credit note issued"); }}>Good, restock</button>
            </div>
          );
        })}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <div className="th border-b border-line px-4 py-2.5">Inspected</div>
        {done.length === 0 && <div className="p-4 text-ink3">None yet</div>}
        {done.map((r) => {
          const p = products.find((x) => x.id === r.productId)!;
          return <div key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"><span className="num w-20 text-ink3">{r.folio}</span><span className="flex-1">{p.name} × {r.qtyPcs} pcs</span><span className={`chip ${r.condition === "good" ? "chip-ok" : "chip-bad"}`}>{r.condition === "good" ? "Restocked" : "Damaged"}</span>{!hideMoney && <span className="num w-24 text-right">CN {fmt(r.value ?? 0)}</span>}</div>;
        })}
      </div>
    </div>
  );
}
