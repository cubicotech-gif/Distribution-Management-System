"use client";
import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, FileText, Ban, CheckCircle2, Search } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { creditUsedPct, fmt, overdueAmount } from "@/lib/calc";
import type { Customer } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import Statement from "@/components/Statement";
import { Avatar, Chips, Empty, Meter, ViewSwitch, toast, useViewMode } from "@/components/ui";

type Seg = "all" | "credit" | "cash" | "blocked" | "overdue";
type Sort = "name" | "balance" | "credit";

export default function Customers() {
  const customers = useStore((s) => s.customers);
  const users = useStore((s) => s.users);
  const routes = useStore((s) => s.routes);
  const lists = useStore((s) => s.priceLists);
  const orders = useStore((s) => s.orders);
  const upsert = useStore((s) => s.upsertCustomer);
  const del = useStore((s) => s.deleteCustomer);
  const setStatus = useStore((s) => s.setCustomerStatus);
  const move = useStore((s) => s.moveCustomers);
  const user = useUser();
  const canEdit = user?.role === "sales";
  const [view, setView] = useViewMode("customers", "table");
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState<Seg>("all");
  const [route, setRoute] = useState("all");
  const [sort, setSort] = useState<Sort>("name");
  const [sel, setSel] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [edit, setEdit] = useState<Customer | null>(null);
  const [stmt, setStmt] = useState<Customer | null>(null);
  const bookers = users.filter((u) => u.role === "booker");

  const over = useMemo(() => Object.fromEntries(customers.map((c) => [c.id, overdueAmount(orders, c)])), [customers, orders]);
  const rows = customers
    .filter((c) => (c.name + c.area + c.phone).toLowerCase().includes(q.toLowerCase()) && (route === "all" || c.route === route))
    .filter((c) => seg === "all" || (seg === "credit" ? c.type === "credit" : seg === "cash" ? c.type === "cash" : seg === "blocked" ? c.status === "blocked" : over[c.id] > 0))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "balance" ? b.balance - a.balance : creditUsedPct(b) - creditUsedPct(a)));
  const count = (f: (c: Customer) => boolean) => customers.filter(f).length;
  const blank: Customer = { id: `c${Date.now()}`, name: "", area: "", route: routes[0]?.name ?? "", bookerId: bookers[0]?.id ?? "", type: "credit", status: "active", priceListId: "pl1", creditLimit: 100000, creditDays: 15, balance: 0, oldestDue: 0, phone: "" };
  const bookerOf = (c: Customer) => users.find((u) => u.id === c.bookerId);
  const daysOf = (c: Customer) => routes.find((r) => r.name === c.route)?.days ?? [];
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  const allOn = rows.length > 0 && rows.every((c) => sel.includes(c.id));

  const check = (c: Customer) => canEdit && <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={sel.includes(c.id)} onChange={() => toggle(c.id)} onClick={(e) => e.stopPropagation()} />;
  const actions = (c: Customer) => (
    <span className="inline-flex gap-1">
      <button className="btn h-7" onClick={() => setStmt(c)}><FileText size={13} /></button>
      {canEdit && <>
        <button className="btn h-7 px-2" title="Edit" onClick={() => setEdit(c)}><Pencil size={13} /></button>
        <button className="btn h-7 px-2" title={c.status === "blocked" ? "Unblock" : "Block new orders"} onClick={() => { if (c.status === "blocked") { setStatus([c.id], "active"); toast(`${c.name} unblocked`); } else { setStatus([c.id], "blocked", c.balance > 0 ? "Payment overdue" : "Blocked by back office"); toast(`${c.name} blocked`); } }}>{c.status === "blocked" ? <CheckCircle2 size={13} /> : <Ban size={13} />}</button>
        <button className="btn btn-danger h-7 px-2" title="Delete" onClick={() => toast(del(c.id) ? `${c.name} deleted` : "Has orders or a balance. Block it instead.")}><Trash2 size={13} /></button>
      </>}
    </span>
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-[250px]"><Search size={14} className="absolute left-2.5 top-2.5 text-ink3" /><input className="field" style={{ paddingLeft: 32 }} placeholder="Search name, area, phone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="field w-44" value={route} onChange={(e) => setRoute(e.target.value)}><option value="all">All routes</option>{routes.map((r) => <option key={r.id}>{r.name}</option>)}</select>
        <select className="field w-40" value={sort} onChange={(e) => setSort(e.target.value as Sort)}><option value="name">Sort: name</option><option value="balance">Sort: balance (high)</option><option value="credit">Sort: credit used</option></select>
        <div className="ml-auto flex items-center gap-2"><span className="text-xs text-ink3">{rows.length} shown</span><ViewSwitch mode={view} onChange={setView} />
          {canEdit && <button className="btn btn-primary" onClick={() => setEdit(blank)}><Plus size={14} /> Add customer</button>}</div>
      </div>
      <Chips value={seg} onChange={setSeg} items={[
        { k: "all", label: "All", count: customers.length }, { k: "credit", label: "Credit", count: count((c) => c.type === "credit") }, { k: "cash", label: "Cash", count: count((c) => c.type === "cash") },
        { k: "overdue", label: "Overdue", count: count((c) => over[c.id] > 0) }, { k: "blocked", label: "Blocked", count: count((c) => c.status === "blocked") },
      ]} />

      {sel.length > 0 && canEdit && (
        <div className="slidein flex flex-wrap items-center gap-2 rounded-xl border border-accent bg-accentwash px-3 py-2">
          <span className="text-[13px] font-semibold">{sel.length} selected</span>
          <select className="field w-44" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">Move to route…</option>{routes.map((r) => <option key={r.id} value={r.name}>{r.name} ({users.find((u) => u.id === r.bookerId)?.initials})</option>)}</select>
          <button className="btn" disabled={!target} onClick={() => { move(sel, target); toast(`${sel.length} customers moved to ${target}`); setSel([]); setTarget(""); }}>Move</button>
          <button className="btn" onClick={() => { setStatus(sel, "blocked", "Blocked by back office"); toast("Blocked"); setSel([]); }}><Ban size={13} /> Block</button>
          <button className="btn" onClick={() => { setStatus(sel, "active"); toast("Unblocked"); setSel([]); }}>Unblock</button>
          <button className="btn ml-auto" onClick={() => setSel([])}>Clear</button>
        </div>
      )}

      <div className={`min-h-0 flex-1 overflow-auto ${view === "tiles" ? "" : "panel"}`}>
        {rows.length === 0 && <div className="panel"><Empty title="No customers match" hint="Clear a filter or the search" /></div>}

        {view === "tiles" && rows.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {rows.map((c) => (
              <div key={c.id} className={`panel flex flex-col gap-2.5 p-3.5 transition hover:border-accent ${sel.includes(c.id) ? "border-accent" : ""} ${c.status === "blocked" ? "opacity-75" : ""}`}>
                <div className="flex items-start gap-2.5">{check(c)}<Avatar initials={c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} size={34} tone={c.id.length} />
                  <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold">{c.name}</div><div className="text-[11px] text-ink3">{c.area} · {c.route}</div></div>
                  {c.status === "blocked" ? <span className="chip chip-bad">Blocked</span> : <span className={`chip ${c.type === "credit" ? "chip-info" : "chip-mute"}`}>{c.type === "credit" ? "Credit" : "Cash"}</span>}</div>
                <div><div className="th">Balance</div><div className="num text-[20px] font-bold leading-tight">{fmt(c.balance)}</div></div>
                {c.type === "credit" ? <div><div className="mb-1 flex justify-between text-[10.5px] text-ink3"><span>Credit used</span><span className="num">{creditUsedPct(c)}% of {fmt(c.creditLimit / 1000)}k</span></div><Meter pct={creditUsedPct(c)} /></div> : <div className="h-[22px]" />}
                <div className="flex flex-wrap gap-1">{daysOf(c).map((d) => <span key={d} className="chip chip-mute !px-1.5 !py-0 text-[10px]">{d}</span>)}{over[c.id] > 0 && <span className="chip chip-bad !py-0 text-[10px]">overdue</span>}</div>
                <div className="mt-auto flex items-center justify-between border-t border-line pt-2"><span className="flex items-center gap-1 text-[11px] text-ink2"><Avatar initials={bookerOf(c)?.initials ?? "—"} size={16} />{bookerOf(c)?.name.split(" ")[0]}</span>{actions(c)}</div>
              </div>
            ))}
          </div>
        )}

        {view === "compact" && rows.length > 0 && rows.map((c) => (
          <div key={c.id} className="row-hover flex items-center gap-3 border-b border-line px-3 py-1.5 text-[12.5px]">
            {check(c)}<span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
            <span className="hidden w-32 truncate text-ink3 md:block">{c.route}</span>
            {c.status === "blocked" && <span className="chip chip-bad">Blocked</span>}
            <span className="w-14 text-right text-ink3">{c.type === "credit" ? `${c.creditDays}d` : "Cash"}</span>
            <span className="num w-24 text-right font-semibold">{fmt(c.balance)}</span><span className="w-[120px] text-right">{actions(c)}</span>
          </div>
        ))}

        {view === "table" && rows.length > 0 && (
          <table className="w-full text-[12.5px]">
            <thead><tr className="th sticky top-0 z-10 bg-panel text-left"><th className="w-8 pl-4">{canEdit && <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={allOn} onChange={() => setSel(allOn ? [] : rows.map((c) => c.id))} />}</th><th className="py-2.5">Customer</th><th>Route · visits</th><th>Booker</th><th>Terms · price list</th><th className="w-36">Credit used</th><th className="text-right">Balance</th><th /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={`row-hover border-t border-line ${sel.includes(c.id) ? "bg-accentwash" : ""} ${c.status === "blocked" ? "opacity-75" : ""}`}>
                  <td className="pl-4">{check(c)}</td>
                  <td className="py-2.5"><div className="flex items-center gap-2 font-semibold">{c.name}{c.status === "blocked" && <span className="chip chip-bad">Blocked</span>}</div><div className="num text-[11px] text-ink3">{c.phone}{c.status === "blocked" && ` · ${c.blockedReason}`}</div></td>
                  <td><div className="text-ink2">{c.route}</div><div className="num text-[10.5px] text-ink3">{daysOf(c).join(" ")}</div></td>
                  <td><span className="flex items-center gap-1.5"><Avatar initials={bookerOf(c)?.initials ?? "—"} size={20} />{bookerOf(c)?.name}</span></td>
                  <td>{c.type === "credit" ? <span className="num">{c.creditDays}d · {fmt(c.creditLimit / 1000)}k</span> : <span className="chip chip-mute">Cash</span>}<div className="text-[10.5px] text-ink3">{lists.find((l) => l.id === c.priceListId)?.name}</div></td>
                  <td className="pr-6">{c.type === "credit" ? <Meter pct={creditUsedPct(c)} /> : null}</td>
                  <td className="num text-right font-semibold">{fmt(c.balance)}{over[c.id] > 0 && <div className="text-[10.5px] font-semibold text-[var(--bad-fg)]">{fmt(over[c.id])} overdue</div>}</td>
                  <td className="pr-4 text-right">{actions(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {stmt && <Statement c={customers.find((x) => x.id === stmt.id) ?? stmt} onClose={() => setStmt(null)} />}
      {edit && (
        <MasterForm<Customer> title={customers.some((c) => c.id === edit.id) ? "Edit customer" : "Add customer"} initial={edit} onClose={() => setEdit(null)}
          fields={[
            { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "area", label: "Area" },
            { key: "route", label: "Route", type: "select", options: routes.map((r) => [r.name, r.name]) },
            { key: "type", label: "Type", type: "select", options: [["credit", "Credit"], ["cash", "Cash"]] },
            { key: "priceListId", label: "Price list", type: "select", options: lists.map((l) => [l.id, `${l.name} (${l.adjustPct > 0 ? "+" : ""}${l.adjustPct}%)`]) },
            { key: "creditLimit", label: "Credit limit (Rs.)", type: "number" }, { key: "creditDays", label: "Credit days", type: "number" },
            ...(customers.some((c) => c.id === edit.id) ? [] : [{ key: "balance" as const, label: "Opening balance (Rs.)", type: "number" as const }]),
          ]}
          footer={(v) => { const r = routes.find((x) => x.name === v.route); const b = users.find((u) => u.id === r?.bookerId); return <div className="text-xs text-ink2">Booker follows the route: <b>{b?.name ?? "—"}</b>{r && <> · visits {r.days.join(", ")}</>}</div>; }}
          onSave={(v) => { upsert(v); setEdit(null); toast("Customer saved"); }} />
      )}
    </div>
  );
}
