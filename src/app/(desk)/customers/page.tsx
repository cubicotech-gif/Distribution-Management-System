"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { fmt, creditUsedPct } from "@/lib/calc";
import type { Customer } from "@/lib/types";
import MasterForm from "@/components/MasterForm";
import Statement from "@/components/Statement";
import { Avatar, Meter, toast } from "@/components/ui";

export default function Customers() {
  const customers = useStore((s) => s.customers);
  const users = useStore((s) => s.users);
  const upsert = useStore((s) => s.upsertCustomer);
  const del = useStore((s) => s.deleteCustomer);
  const user = useUser();
  const canEdit = user?.role === "sales";
  const [q, setQ] = useState("");
  const [route, setRoute] = useState("all");
  const [edit, setEdit] = useState<Customer | null>(null);
  const [stmt, setStmt] = useState<Customer | null>(null);
  const bookers = users.filter((u) => u.role === "booker");
  const routes = Array.from(new Set(customers.map((c) => c.route)));
  const blank: Customer = { id: `c${Date.now()}`, name: "", area: "", route: routes[0] ?? "", bookerId: bookers[0].id, type: "credit", creditLimit: 100000, creditDays: 15, balance: 0, oldestDue: 0, phone: "" };
  const rows = customers.filter((c) => (c.name + c.area).toLowerCase().includes(q.toLowerCase()) && (route === "all" || c.route === route));
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <input className="field max-w-xs" placeholder="Search customers…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="field w-44" value={route} onChange={(e) => setRoute(e.target.value)}><option value="all">All routes</option>{routes.map((r) => <option key={r}>{r}</option>)}</select>
        {canEdit ? <button className="btn btn-primary ml-auto" onClick={() => setEdit(blank)}><Plus size={14} /> Add customer</button> : <span className="ml-auto text-xs text-ink3">View only. Back office maintains customers.</span>}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Customer</th><th>Route</th><th>Booker</th><th>Terms</th><th className="w-36">Credit used</th><th className="text-right">Balance</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => {
              const b = users.find((u) => u.id === c.bookerId);
              return (
                <tr key={c.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2.5"><div className="font-semibold">{c.name}</div><div className="num text-[11px] text-ink3">{c.phone}</div></td>
                  <td className="text-ink2">{c.route}</td>
                  <td><span className="flex items-center gap-1.5"><Avatar initials={b?.initials ?? "—"} size={20} />{b?.name}</span></td>
                  <td>{c.type === "credit" ? <span className="num">{c.creditDays}d · {fmt(c.creditLimit / 1000)}k</span> : <span className="chip chip-mute">Cash</span>}</td>
                  <td className="pr-6">{c.type === "credit" ? <Meter pct={creditUsedPct(c)} /> : null}</td>
                  <td className="num text-right font-semibold">{fmt(c.balance)}</td>
                  <td className="space-x-1 pr-4 text-right">
                    <button className="btn h-7" onClick={() => setStmt(c)}><FileText size={13} /> Statement</button>
                    {canEdit && <>
                      <button className="btn h-7 px-2" onClick={() => setEdit(c)}><Pencil size={13} /></button>
                      <button className="btn btn-danger h-7 px-2" onClick={() => { del(c.id); toast(`${c.name} deleted`); }}><Trash2 size={13} /></button>
                    </>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {stmt && <Statement c={customers.find((x) => x.id === stmt.id) ?? stmt} onClose={() => setStmt(null)} />}
      {edit && (
        <MasterForm<Customer> title={customers.some((c) => c.id === edit.id) ? "Edit customer" : "Add customer"} initial={edit} onClose={() => setEdit(null)}
          fields={[
            { key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "area", label: "Area" }, { key: "route", label: "Route" },
            { key: "bookerId", label: "Assigned booker", type: "select", options: bookers.map((b) => [b.id, b.name]) },
            { key: "type", label: "Type", type: "select", options: [["credit", "Credit"], ["cash", "Cash"]] },
            { key: "creditLimit", label: "Credit limit (Rs.)", type: "number" }, { key: "creditDays", label: "Credit days", type: "number" },
          ]}
          onSave={(v) => { upsert(v); setEdit(null); toast("Customer saved"); }} />
      )}
    </div>
  );
}
