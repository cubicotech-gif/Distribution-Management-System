"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt } from "@/lib/calc";
import { Avatar, toast } from "@/components/ui";
import type { Route } from "@/lib/types";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Routes() {
  const routes = useStore((s) => s.routes);
  const customers = useStore((s) => s.customers);
  const users = useStore((s) => s.users);
  const upsert = useStore((s) => s.upsertRoute);
  const del = useStore((s) => s.deleteRoute);
  const canEdit = useUser()?.role === "sales";
  const bookers = users.filter((u) => u.role === "booker");
  const [name, setName] = useState("");
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      <div className="flex items-end justify-between">
        <div><h1 className="text-[18px] font-bold">Routes & visit days</h1><p className="text-ink2">A route belongs to one booker and has fixed visit days. Customers on the route follow it automatically: change the booker here and all the route&apos;s customers move with it.</p></div>
        {canEdit && (
          <div className="flex gap-2"><input className="field w-44" placeholder="New route name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary" disabled={!name.trim()} onClick={() => { upsert({ id: `rt${Date.now()}`, name: name.trim(), bookerId: bookers[0].id, days: ["Mon", "Thu"] }); setName(""); toast("Route added"); }}><Plus size={14} /> Add route</button></div>
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3">
        {routes.map((r) => {
          const cs = customers.filter((c) => c.route === r.name);
          const bal = cs.reduce((s, c) => s + c.balance, 0);
          const b = users.find((u) => u.id === r.bookerId);
          const patch = (p: Partial<Route>) => upsert({ ...r, ...p });
          return (
            <div key={r.id} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-start justify-between">
                <div><div className="text-[15px] font-bold">{r.name}</div><div className="text-xs text-ink3">{cs.length} customers · Rs. {fmt(bal)} outstanding</div></div>
                {r.days.includes(today) && <span className="chip chip-ok">Visiting today</span>}
              </div>
              <div className="flex items-center gap-2"><Avatar initials={b?.initials ?? "—"} size={26} />
                {canEdit ? <select className="field" value={r.bookerId} onChange={(e) => { patch({ bookerId: e.target.value }); toast(`${r.name} now belongs to ${bookers.find((x) => x.id === e.target.value)?.name}`); }}>{bookers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : <span>{b?.name}</span>}</div>
              <div className="flex gap-1.5">
                {DAYS.map((d) => { const on = r.days.includes(d); return <button key={d} disabled={!canEdit} onClick={() => patch({ days: on ? r.days.filter((x) => x !== d) : [...r.days, d] })} className={`h-8 flex-1 rounded-lg border text-[12px] font-semibold ${on ? "border-accent bg-accent text-accentink" : "border-line text-ink3"}`}>{d}</button>; })}
              </div>
              <div className="rounded-xl border border-line">
                {cs.slice(0, 5).map((c) => <div key={c.id} className="flex justify-between border-b border-line px-3 py-1.5 text-xs last:border-0"><span className={c.status === "blocked" ? "text-[var(--bad-fg)]" : ""}>{c.name}{c.status === "blocked" && " (blocked)"}</span><span className="num text-ink2">{fmt(c.balance)}</span></div>)}
                {cs.length > 5 && <div className="px-3 py-1.5 text-[11px] text-ink3">+ {cs.length - 5} more. Move customers from the Customers page.</div>}
                {cs.length === 0 && <div className="px-3 py-3 text-xs text-ink3">No customers on this route yet.</div>}
              </div>
              {canEdit && cs.length === 0 && <button className="btn btn-danger self-start" onClick={() => { del(r.id); toast("Route deleted"); }}><Trash2 size={13} /> Delete route</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
