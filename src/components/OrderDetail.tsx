"use client";
import { Check, Printer } from "lucide-react";
import { useState } from "react";
import { useStore, useUser } from "@/lib/store";
import { ago, available, clock, fmt, lineNet, money, orderTotal, pcsOf, STEPS, STEP_LABEL, totals, withScheme } from "@/lib/calc";
import { checkOrder } from "@/lib/check";
import type { Order, ReturnReason } from "@/lib/types";
import { AgingBar, Avatar, CreditMeter, Kbd, Modal, StatusChip, Thumb, toast } from "./ui";

export function Stepper({ o }: { o: Order }) {
  const done = (s: string) => o.trail.find((t) => t.status === s);
  const idx = STEPS.findIndex((s) => !done(s));
  const cur = idx === -1 ? STEPS.length : idx;
  return (
    <div className="flex items-start">
      {STEPS.map((s, i) => {
        const t = done(s);
        const isCur = i === cur;
        return (
          <div key={s} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1.5">
                <span className={`grid h-[18px] w-[18px] place-items-center rounded-full border-2 ${t ? "border-accent bg-accent text-accentink" : isCur ? "border-accent bg-panel" : "border-line2 bg-panel"}`}>
                  {t ? <Check size={11} strokeWidth={3} /> : isCur ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
                </span>
                <span className={`text-[12px] font-semibold ${t || isCur ? "text-ink" : "text-ink3"}`}>{STEP_LABEL[s]}</span>
              </div>
              <div className="num ml-6 mt-0.5 text-[10.5px] text-ink3">{t ? `${clock(t.at)} · ${t.by}` : "—"}</div>
            </div>
            {i < STEPS.length - 1 && <div className={`mx-2 mt-[9px] h-[2px] flex-1 rounded ${t ? "bg-accent" : "bg-line"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export function InvoiceDoc({ o, onClose }: { o: Order; onClose: () => void }) {
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const c = customers.find((x) => x.id === o.customerId)!;
  const t = totals(o.lines);
  return (
    <Modal open onClose={onClose} title={o.invoiceNo ? `Invoice ${o.invoiceNo}` : `Draft invoice for ${o.folio}`} width={720}>
      <div className="printable rounded-xl border border-line bg-white p-6 text-[#16201b]">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-bold tracking-wide">ZARIE DISTRIBUTORS</div>
            <div className="text-xs text-[#4b5a52]">Lahore Depot · NTN 1234567-8</div>
          </div>
          <div className="text-right">
            <div className="num text-base font-bold">{o.invoiceNo ?? "DRAFT"}</div>
            <div className="num text-xs text-[#4b5a52]">{o.folio} {o.challanNo ? `· ${o.challanNo}` : ""}</div>
            <div className="text-xs text-[#4b5a52]">{new Date(o.createdAt).toLocaleDateString("en-GB")}</div>
          </div>
        </div>
        <div className="my-4 rounded-lg bg-[#f4f6f3] p-3 text-xs">
          <div className="font-semibold">{c.name}</div>
          <div className="text-[#4b5a52]">{c.area} · {c.phone} · {c.type === "credit" ? `Credit ${c.creditDays} days` : "Cash"}</div>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b border-[#d3d9d0] text-left text-[10px] uppercase tracking-wider text-[#8a968f]">
            <th className="py-1.5">Product</th><th>Unit</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Disc</th><th className="text-right">Amount</th>
          </tr></thead>
          <tbody>
            {o.lines.map((l, i) => {
              const p = products.find((x) => x.id === l.productId)!;
              return (
                <tr key={i} className="border-b border-[#e4e8e2]">
                  <td className="py-1.5">{p.name}</td><td className="uppercase">{l.unit}</td>
                  <td className="num text-right">{l.qty}</td><td className="num text-right">{fmt(l.rate)}</td>
                  <td className="num text-right">{l.discPct}%</td><td className="num text-right">{fmt(lineNet(l))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-3 ml-auto w-56 space-y-1 text-xs">
          <div className="flex justify-between"><span>Subtotal</span><span className="num">{fmt(t.gross)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span className="num">-{fmt(t.discount)}</span></div>
          <div className="flex justify-between"><span>Sales tax 18%</span><span className="num">{fmt(t.tax)}</span></div>
          <div className="flex justify-between border-t border-[#d3d9d0] pt-1 text-sm font-bold"><span>Net total</span><span className="num">Rs. {fmt(t.total)}</span></div>
        </div>
        <div className="mt-8 flex justify-between text-[11px] text-[#8a968f]">
          <span>Customer signature / stamp ____________</span>
          <span>{o.status === "delivered" || o.status === "paid" ? "RECEIVED ✓" : ""}</span>
        </div>
      </div>
      <div className="no-print mt-4 flex justify-end gap-2">
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print</button>
      </div>
    </Modal>
  );
}

export function ReturnModal({ o, onClose }: { o: Order; onClose: () => void }) {
  const products = useStore((s) => s.products);
  const report = useStore((s) => s.reportReturn);
  const user = useUser();
  const [pid, setPid] = useState(o.lines[0]?.productId);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState<ReturnReason>("old packaging");
  const l = o.lines.find((x) => x.productId === pid);
  const p = products.find((x) => x.id === pid);
  const max = l && p ? pcsOf(l, p) : 1;
  return (
    <Modal open onClose={onClose} title={`Customer return · ${o.folio}`} width={460}>
      <div className="space-y-3">
        <div>
          <div className="th mb-1">Product</div>
          <select className="field" value={pid} onChange={(e) => setPid(e.target.value)}>
            {o.lines.map((x) => <option key={x.productId} value={x.productId}>{products.find((p) => p.id === x.productId)?.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="th mb-1">Quantity (pcs, max {max})</div>
            <input className="field num" type="number" min={1} max={max} value={qty} onChange={(e) => setQty(Math.min(max, Math.max(1, +e.target.value)))} />
          </div>
          <div>
            <div className="th mb-1">Reason</div>
            <select className="field" value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>
              {["old packaging", "damaged", "expired", "wrong item", "refused"].map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="text-xs text-ink2">The warehouse inspects the goods when they arrive and decides good or damaged. The credit note is issued automatically after inspection.</div>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { report(o.id, pid!, qty, reason, user?.initials ?? "—"); toast("Return sent to warehouse for inspection"); onClose(); }}>Send to warehouse</button>
        </div>
      </div>
    </Modal>
  );
}

export default function OrderDetail({ o, primary }: { o: Order; primary?: { label: string; run: () => void } }) {
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const updateLines = useStore((s) => s.updateOrderLines);
  const schemes = useStore((s) => s.schemes);
  const hold = useStore((s) => s.holdOrder);
  const cancel = useStore((s) => s.cancelOrder);
  const user = useUser();
  const [inv, setInv] = useState(false);
  const [ret, setRet] = useState(false);
  const c = customers.find((x) => x.id === o.customerId)!;
  const booker = useStore((s) => s.users.find((u) => u.id === o.bookerId));
  const chk = checkOrder(o, c, products);
  const t = totals(o.lines);
  const readOnly = user?.role === "admin";
  const editable = !readOnly && (o.status === "booked" || (o.status === "hold" && !o.needsOwner));
  const by = user?.initials ?? "—";

  const setLine = (i: number, patch: Partial<Order["lines"][number]>) =>
    updateLines(o.id, o.lines.map((l, k) => {
      if (k !== i) return l;
      const n = { ...l, ...patch };
      return "qty" in patch ? { ...withScheme(schemes, n), discPct: patch.discPct ?? withScheme(schemes, n).discPct } : n;
    }));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-5 pb-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[20px] font-bold leading-tight">{c.name}</h2>
              <StatusChip status={o.status} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-ink2">
              <span className="num rounded bg-[var(--mute-bg)] px-1.5 py-0.5 font-semibold">{o.folio}</span>
              <span>{c.area}</span><span>·</span>
              <span className="flex items-center gap-1"><Avatar initials={booker?.initials ?? "—"} size={16} /> {booker?.name}</span>
              <span>·</span><span>{ago(o.createdAt)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {o.invoiceNo || o.challanNo ? <button className="btn" onClick={() => setInv(true)}><Printer size={14} /> Invoice</button> : null}
            {!readOnly && (o.status === "delivered" || o.status === "paid") && <button className="btn" onClick={() => setRet(true)}>Customer return</button>}
          </div>
        </div>
        <div className="mt-4"><Stepper o={o} /></div>
        <div className="mt-4 grid grid-cols-3 gap-5 rounded-xl border border-line bg-panel2 p-3">
          <CreditMeter c={c} />
          <div>
            <div className="mb-1 text-[11px] text-ink2">Outstanding · {c.type === "credit" ? `${c.creditDays}d terms` : "cash"}</div>
            {c.balance > 0 ? <AgingBar c={c} /> : <span className="num text-xs text-ink3">Nothing due</span>}
          </div>
          <div className="text-[11px] text-ink2">
            <div className="mb-1">Balance / Limit</div>
            <div className="num text-[13px] font-semibold text-ink">{fmt(c.balance)} <span className="text-ink3">/ {c.creditLimit ? fmt(c.creditLimit) : "—"}</span></div>
          </div>
        </div>
        {o.needsOwner && (
          <div className="mt-3 rounded-xl border border-[var(--warn-fg)] bg-[var(--warn-bg)] px-3 py-2 text-[12px] text-[var(--warn-fg)]">
            <span className="font-semibold">Waiting for owner.</span> {o.needsOwner.join(" · ")}
          </div>
        )}
        {(chk.over || chk.short.length > 0 || chk.overdue) && editable && (
          <div className="mt-3 flex flex-wrap gap-2">
            {chk.over && <span className="chip chip-warn">Over credit limit by Rs. {fmt(c.balance + chk.total - c.creditLimit)}</span>}
            {chk.overdue && <span className="chip chip-bad">Oldest invoice {c.oldestDue}d unpaid</span>}
            {chk.short.length > 0 && <span className="chip chip-bad">Short on stock: {chk.short.map((s) => s.p.name.split(" ")[0]).join(", ")}</span>}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-5 py-3">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="th text-left">
              <th className="py-2 font-semibold">Code</th><th>Product</th><th>Unit</th>
              <th className="text-right">Qty</th><th className="text-right">Stock</th><th className="text-right">Rate</th>
              <th className="text-right">Disc %</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {o.lines.map((l, i) => {
              const p = products.find((x) => x.id === l.productId)!;
              const sh = chk.short.find((s) => s.i === i);
              const avCtn = Math.floor(available(p) / (l.unit === "ctn" ? p.packSize : 1));
              return (
                <tr key={i} className="border-t border-line">
                  <td className="num py-1.5 text-ink2">{p.code}</td>
                  <td>
                    <div className="flex items-center gap-2"><Thumb p={p} size={24} />
                      <div><div className="font-medium">{p.name}</div>{sh && <div className="text-[10.5px] font-semibold text-[var(--bad-fg)]">Short: {Math.ceil(sh.shortPcs / (l.unit === "ctn" ? p.packSize : 1))} {l.unit}</div>}{l.scheme && <div className="text-[10.5px] font-medium text-accent">{l.scheme}</div>}{l.shortReason && <div className="text-[10.5px] font-semibold text-[var(--warn-fg)]">Short picked: {l.shortReason}</div>}</div>
                    </div>
                  </td>
                  <td className="uppercase text-ink2">{l.unit}</td>
                  <td className="w-16 text-right">
                    {editable ? <input className="cell num font-semibold" type="number" min={0} value={l.qty} onChange={(e) => setLine(i, { qty: Math.max(0, +e.target.value) })} /> : <span className="num font-semibold">{l.qty}</span>}
                  </td>
                  <td className="text-right">{editable ? <span className={`chip ${sh ? "chip-warn" : "chip-ok"} num`}>{avCtn}</span> : <span className="text-ink3">—</span>}</td>
                  <td className="num text-right text-ink2">{fmt(l.rate)}</td>
                  <td className="w-16 text-right">
                    {editable ? <input className="cell num" style={{ color: l.discPct > 5 ? "var(--bad-fg)" : undefined }} type="number" step="0.5" min={0} max={20} value={l.discPct} onChange={(e) => setLine(i, { discPct: Math.max(0, +e.target.value) })} /> : <span className="num">{l.discPct}</span>}
                  </td>
                  <td className="num text-right font-semibold">{fmt(lineNet(l))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-end justify-between gap-4 border-t border-line bg-panel px-5 py-3">
        <div className="flex gap-2">
          {primary && (
            <button className="btn btn-primary h-9 px-4 text-[13px]" onClick={primary.run}>{primary.label} <Kbd>↵</Kbd></button>
          )}
          {editable && o.status === "booked" && <button className="btn h-9" onClick={() => { hold(o.id, by); toast("Order put on hold"); }}>Hold <Kbd>H</Kbd></button>}
          {!readOnly && (o.status === "booked" || o.status === "hold" || o.status === "approved") && (
            <button className="btn btn-danger h-9" onClick={() => { cancel(o.id, by); toast("Order cancelled"); }}>Cancel</button>
          )}
        </div>
        <div className="space-y-0.5 text-right text-xs text-ink2">
          <div>Subtotal <span className="num ml-3">{fmt(t.gross)}</span> · Disc <span className="num">-{fmt(t.discount)}</span> · Tax 18% <span className="num">{fmt(t.tax)}</span></div>
          <div className="text-ink">Net total <span className="num ml-2 text-[20px] font-bold text-accent">{money(orderTotal(o))}</span></div>
        </div>
      </div>
      {inv && <InvoiceDoc o={o} onClose={() => setInv(false)} />}
      {ret && <ReturnModal o={o} onClose={() => setRet(false)} />}
    </div>
  );
}
