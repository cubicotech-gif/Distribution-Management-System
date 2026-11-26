"use client";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import type { Supplier } from "@/lib/types";
import { claimsOf } from "@/lib/grn";
import MasterForm from "@/components/MasterForm";
import { ask, toast } from "@/components/ui";

export default function Suppliers() {
  const suppliers = useStore((s) => s.suppliers);
  const products = useStore((s) => s.products);
  const purchases = useStore((s) => s.purchases);
  const grns = useStore((s) => s.grns);
  const upsert = useStore((s) => s.upsertSupplier);
  const del = useStore((s) => s.deleteSupplier);
  const canEdit = useUser()?.role === "purchasing";
  const [edit, setEdit] = useState<Supplier | null>(null);
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-end justify-between">
        <div><h1 className="text-[18px] font-bold">Suppliers</h1><p className="text-ink2">Contacts, payment terms and lead time. Lead time feeds the reorder planner for every product from that supplier.</p></div>
        {canEdit && <button className="btn btn-primary" onClick={() => setEdit({ id: `sp${Date.now()}`, name: "", contact: "", phone: "", terms: "Net 15", leadDays: 5 })}><Plus size={14} /> Add supplier</button>}
      </div>
      <div className="panel min-h-0 flex-1 overflow-auto">
        <table className="w-full text-[12.5px]">
          <thead><tr className="th sticky top-0 bg-panel text-left"><th className="px-4 py-2.5">Supplier</th><th>Contact</th><th>Terms</th><th className="text-right">Lead time</th><th className="text-right">Products</th><th className="text-right">Open orders</th><th className="text-right">Short / damaged</th><th /></tr></thead>
          <tbody>
            {suppliers.map((s) => {
              const ps = products.filter((p) => p.supplier === s.name);
              const pos = purchases.filter((p) => p.supplier === s.name);
              const claims = claimsOf(grns, purchases, products).filter((c) => c.grn.supplier === s.name).length;
              return (
                <tr key={s.id} className="row-hover border-t border-line">
                  <td className="px-4 py-2.5 font-semibold">{s.name}</td>
                  <td><div>{s.contact}</div><div className="num text-[11px] text-ink3">{s.phone}</div></td>
                  <td>{s.terms}</td><td className="num text-right">{s.leadDays} days</td><td className="num text-right">{ps.length}</td>
                  <td className="num text-right">{pos.filter((p) => p.status === "ordered" || p.status === "partial").length || "—"}</td>
                  <td className="text-right">{claims ? <span className="chip chip-bad num">{claims}</span> : <span className="text-ink3">—</span>}</td>
                  <td className="space-x-1 pr-4 text-right">{canEdit && <><button className="btn h-7 px-2" onClick={() => setEdit(s)}><Pencil size={13} /></button><button className="btn btn-danger h-7 px-2" onClick={async () => { if (await ask({ title: `Delete ${s.name}?`, confirm: "Delete", danger: true })) toast(del(s.id) ? "Supplier deleted" : "This supplier still has products, so it cannot be deleted."); }}><Trash2 size={13} /></button></>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {edit && (
        <MasterForm<Supplier> title={suppliers.some((s) => s.id === edit.id) ? "Edit supplier" : "Add supplier"} initial={edit} onClose={() => setEdit(null)}
          validate={(v) => ({ name: v.name && suppliers.some((x) => x.id !== v.id && x.name.toLowerCase() === v.name.toLowerCase()) ? "This supplier already exists" : "", leadDays: v.leadDays < 0 || v.leadDays > 90 ? "Lead time must be 0 to 90 days" : "" })}
          fields={[{ key: "name", label: "Company name", required: true }, { key: "contact", label: "Contact person", required: true }, { key: "phone", label: "Phone", required: true }, { key: "terms", label: "Payment terms", type: "select", options: ["Advance", "Net 7", "Net 15", "Net 21", "Net 30"].map((t) => [t, t] as [string, string]) }, { key: "leadDays", label: "Lead time (days)", type: "number" }]}
          footer={() => <div className="text-xs text-ink2">Saving updates the lead time on all products from this supplier.</div>}
          onSave={(v) => { upsert(v); setEdit(null); toast("Supplier saved"); }} />
      )}
    </div>
  );
}
