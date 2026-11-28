"use client";
import { useMemo, useState } from "react";
import { can } from "@/lib/perm";
import { useStore, useUser } from "@/lib/store";
import { fmt } from "@/lib/calc";
import { TIER, batchGroups, type Tier } from "@/lib/stockctl";
import { Chips, Empty, Thumb, ask, toast } from "../ui";

export default function ExpiryTab({ onTrace }: { onTrace: (productId: string, batch: string) => void }) {
  const products = useStore((s) => s.products);
  const clearance = useStore((s) => s.markClearance);
  const toDamaged = useStore((s) => s.batchToDamaged);
  const user = useUser();
  const role = user?.role;
  const by = user?.initials ?? "—";
  const canAct = can(user, "stock") || role === "purchasing";
  const showCost = role === "purchasing" || role === "admin";
  const [tier, setTier] = useState<"risk" | Tier | "all">("risk");
  const groups = useMemo(() => batchGroups(products).sort((a, b) => a.days - b.days), [products]);
  const risk = (t: Tier) => t !== "ok";
  const shown = groups.filter((g) => (tier === "all" ? true : tier === "risk" ? risk(g.tier) : g.tier === tier));
  const tiers: Tier[] = ["expired", "d30", "d60", "d90"];
  const sum = (t: Tier) => groups.filter((g) => g.tier === t).reduce((s, g) => ({ n: s.n + 1, ctn: s.ctn + g.ctn, v: s.v + g.value }), { n: 0, ctn: 0, v: 0 });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid grid-cols-4 gap-3">
        {tiers.map((t) => { const x = sum(t); return (
          <button key={t} onClick={() => setTier(t)} className={`panel p-3.5 text-left transition hover:border-accent ${tier === t ? "border-accent" : ""}`}>
            <div className="flex items-center justify-between"><span className="th">{TIER[t].label}</span><span className={`chip ${TIER[t].chip} num`}>{x.n} batch{x.n === 1 ? "" : "es"}</span></div>
            <div className="num mt-1.5 text-[22px] font-bold">{fmt(x.ctn)} <span className="text-[12px] font-medium text-ink3">ctn</span></div>
            {showCost && <div className="num text-[11.5px] text-ink2">Rs. {fmt(x.v)} at cost</div>}
            <div className="mt-1 text-[11px] text-ink3">{TIER[t].action}</div>
          </button>); })}
      </div>
      <Chips value={tier} onChange={setTier} items={[{ k: "risk", label: "Needs attention", count: groups.filter((g) => risk(g.tier)).length }, { k: "all", label: "All batches", count: groups.length }, ...tiers.map((t) => ({ k: t, label: TIER[t].label }))]} />
      <div className="panel min-h-0 flex-1 overflow-auto">
        {shown.length === 0 ? <Empty title="No batches in this group" hint="Nothing is close to expiry here. Check All batches to see everything." action={{ label: "Show all batches", onClick: () => setTier("all") }} /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 z-10 bg-panel text-left"><th className="px-4 py-2.5">Product · batch</th><th>Bins</th><th className="text-right">Cartons</th><th className="pl-5">Expiry</th><th>What to do</th><th /></tr></thead>
            <tbody>
              {shown.map((g) => (
                <tr key={g.key} className="row-hover border-t border-line">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Thumb p={g.p} size={28} /><div><div className="font-semibold">{g.p.name}{g.clearance && <span className="chip chip-info ml-2">Deal on</span>}</div><div className="num text-[11px] text-ink3">{g.no} · received {Math.round((Date.now() - g.receivedAt) / 86400000)}d ago</div></div></div></td>
                  <td className="num text-ink2">{g.bins.join(", ")}</td>
                  <td className="num text-right font-semibold">{fmt(g.ctn)}{showCost && <div className="text-[10.5px] font-normal text-ink3">Rs. {fmt(g.value)}</div>}</td>
                  <td className="pl-5"><span className={`chip ${TIER[g.tier].chip} num`}>{g.expiry}</span><div className="num mt-0.5 text-[10.5px] text-ink3">{g.days < 0 ? `${-g.days} days ago` : `in ${g.days} days`}</div></td>
                  <td className="max-w-[240px] text-ink2">{TIER[g.tier].action}</td>
                  <td className="space-x-1.5 pr-4 text-right">
                    <button className="btn h-7" onClick={() => onTrace(g.p.id, g.no)}>Trace</button>
                    {canAct && g.tier !== "expired" && g.tier !== "ok" && <button className="btn h-7" onClick={() => { clearance(g.p.id, g.no, !g.clearance); toast(g.clearance ? "Deal removed" : "Bookers will see a short-expiry deal tag", { undo: () => clearance(g.p.id, g.no, g.clearance) }); }}>{g.clearance ? "End deal" : "Run deal"}</button>}
                    {canAct && g.tier !== "ok" && g.tier !== "d90" && <button className="btn btn-danger h-7" onClick={async () => {
                      const w = g.tier === "expired";
                      if (await ask({ title: w ? `Write off ${g.p.name} batch ${g.no}?` : `Send ${g.p.name} batch ${g.no} back to the supplier?`, body: `All ${fmt(g.ctn)} cartons leave sellable stock and go to the damaged pile${w ? "" : ", ready for a return to the factory"}.`, confirm: w ? "Write off" : "Send to supplier return", danger: true })) { toDamaged(g.p.id, g.no, w ? "Expired" : "Near expiry", w ? "write-off" : "supplier-return", by); toast(`${g.no} moved to the damaged pile`); }
                    }}>{g.tier === "expired" ? "Write off" : "Return"}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
