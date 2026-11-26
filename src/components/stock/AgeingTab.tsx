"use client";
import { useMemo, useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { ago, coverDays, fmt } from "@/lib/calc";
import { ageBuckets, lastPick, oldestAge } from "@/lib/stockctl";
import { Chips, Empty, Thumb } from "../ui";

const COLS = ["0-30", "31-60", "61-90", "90+"];
const TONE = ["var(--accent)", "#d9a319", "#e07a2b", "#d9483b"];

export default function AgeingTab() {
  const products = useStore((s) => s.products);
  const ledger = useStore((s) => s.ledger);
  const role = useUser()?.role;
  const showCost = role === "purchasing" || role === "admin";
  const [f, setF] = useState<"all" | "slow" | "old">("all");
  const rows = useMemo(() => products.filter((p) => p.stock > 0).map((p) => {
    const b = ageBuckets(p);
    const lp = lastPick(ledger, p.id);
    const sinceLast = lp ? Math.floor((Date.now() - lp) / 86400000) : 999;
    const cover = coverDays(p);
    const slow = sinceLast > 21 || cover > 60;
    const old = b[2] + b[3] > 0;
    return { p, b, lp, sinceLast, cover, slow, old, oldest: oldestAge(p), value: (p.stock / p.packSize) * p.costPrice };
  }).filter((r) => f === "all" || (f === "slow" ? r.slow : r.old)).sort((a, b) => Number(b.slow) - Number(a.slow) || b.oldest - a.oldest), [products, ledger, f]);
  const tot = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Chips value={f} onChange={setF} items={[{ k: "all", label: "All stock" }, { k: "slow", label: "Slow movers" }, { k: "old", label: "Older than 60 days" }]} />
        <span className="text-xs text-ink2">Slow mover = nothing picked for 3 weeks, or more than 60 days of stock on hand. {showCost && <>Shown value: <b className="num">Rs. {fmt(tot)}</b></>}</span>
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? <Empty title="Nothing in this group" hint="No slow or old stock right now." action={{ label: "Show all stock", onClick: () => setF("all") }} /> : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 z-10 bg-panel text-left"><th className="px-4 py-2.5">Product</th><th className="text-right">Cartons</th><th className="w-60 pl-6">Age of stock (days since received)</th><th className="text-right">Oldest</th><th className="pl-5">Last picked</th><th className="text-right">Cover</th>{showCost && <th className="text-right">Value</th>}<th className="pl-5">Flag</th></tr></thead>
            <tbody>
              {rows.map((r) => { const tot2 = r.b.reduce((a, c) => a + c, 0) || 1; return (
                <tr key={r.p.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><Thumb p={r.p} size={26} /><div><div className="font-semibold">{r.p.name}</div><div className="num text-[11px] text-ink3">{r.p.code}</div></div></div></td>
                  <td className="num text-right font-semibold">{fmt(r.p.stock / r.p.packSize)}</td>
                  <td className="pl-6 pr-4"><div className="flex h-2 gap-px overflow-hidden rounded-full" style={{ background: "var(--mute-bg)" }}>{r.b.map((x, i) => x > 0 && <div key={i} style={{ width: `${(x / tot2) * 100}%`, background: TONE[i] }} title={`${COLS[i]} days: ${fmt(x / r.p.packSize)} ctn`} />)}</div>
                    <div className="mt-1 flex gap-2 text-[10px] text-ink3">{r.b.map((x, i) => x > 0 && <span key={i} className="num">{COLS[i]}: {fmt(x / r.p.packSize)}</span>)}</div></td>
                  <td className="num text-right">{r.oldest}d</td>
                  <td className="pl-5 text-ink2">{r.lp ? ago(r.lp) : "Never"}</td>
                  <td className="num text-right">{Math.round(r.cover)}d</td>
                  {showCost && <td className="num text-right">{fmt(r.value)}</td>}
                  <td className="pl-5">{r.slow && <span className="chip chip-warn mr-1">Slow mover</span>}{r.old && <span className="chip chip-bad">Old stock</span>}{!r.slow && !r.old && <span className="chip chip-ok">Healthy</span>}</td>
                </tr>); })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
