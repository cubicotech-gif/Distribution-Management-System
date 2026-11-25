"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { fmt, orderTotal } from "@/lib/calc";
import { Avatar, Meter } from "@/components/ui";

export default function Team() {
  const users = useStore((s) => s.users);
  const orders = useStore((s) => s.orders).filter((o) => o.status !== "cancelled");
  const customers = useStore((s) => s.customers);
  const trips = useStore((s) => s.trips);
  const setTarget = useStore((s) => s.setBookerTarget);
  const [edit, setEdit] = useState<string | null>(null);
  const bookers = users.filter((u) => u.role === "booker");
  const staff = users.filter((u) => u.role !== "booker");
  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-4 overflow-auto">
      <div><h1 className="text-[18px] font-bold">Team & targets</h1><p className="text-ink2">Set monthly targets for bookers and see how each person is doing.</p></div>
      <div className="panel">
        <div className="th border-b border-line px-4 py-2.5">Bookers</div>
        {bookers.map((b) => {
          const mine = orders.filter((o) => o.bookerId === b.id);
          const ach = mine.reduce((s, o) => s + orderTotal(o), 0) + (b.baseline ?? 0);
          const pct = Math.round((ach / (b.target ?? 1)) * 100);
          const cs = customers.filter((c) => c.bookerId === b.id);
          return (
            <div key={b.id} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
              <Avatar initials={b.initials} size={34} />
              <div className="w-48"><div className="font-semibold">{b.name}</div><div className="text-xs text-ink3">{cs[0]?.route ?? "—"} · {cs.length} customers</div></div>
              <div className="flex-1"><div className="mb-1 flex justify-between text-xs"><span className="num text-ink2">Rs. {fmt(ach)}</span><span className="num font-semibold">{pct}%</span></div><Meter pct={Math.min(100, pct)} tone={pct >= 80 ? "ok" : pct >= 50 ? "warn" : "bad"} /></div>
              <div className="w-36 text-right">
                {edit === b.id ? <input className="field num text-right" autoFocus type="number" defaultValue={b.target} onBlur={(e) => { setTarget(b.id, +e.target.value); setEdit(null); }} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
                  : <button className="btn" onClick={() => setEdit(b.id)}>Target {fmt((b.target ?? 0) / 1000)}k</button>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel">
        <div className="th border-b border-line px-4 py-2.5">Staff</div>
        {staff.map((u) => <div key={u.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"><Avatar initials={u.initials} size={26} /><span className="flex-1 font-medium">{u.name}</span><span className="text-xs text-ink2">{u.title}</span>{u.role === "delivery" && <span className="chip chip-mute">{trips.filter((t) => t.driverId === u.id).length} trips</span>}</div>)}
      </div>
    </div>
  );
}
