"use client";
import { useMemo, useState } from "react";
import { Trash2, ClipboardPaste, Sparkles } from "lucide-react";
import { useStore, useUser } from "@/lib/store";
import { available, fmt, lineNet, rateFor, totals } from "@/lib/calc";
import type { Line, Product, Unit } from "@/lib/types";
import { Kbd, Modal, Thumb, toast } from "./ui";

function parsePaste(text: string, products: Product[]): { lines: Line[]; missed: string[] } {
  const lines: Line[] = [];
  const missed: string[] = [];
  for (const raw of text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = raw.match(/(\d+)\s*(ctn|carton|cartons|pcs|pc|piece|pieces|dozen)?/i);
    if (!m) { missed.push(raw); continue; }
    const qty = parseInt(m[1], 10);
    const unit: Unit = m[2] && /^(pcs|pc|piece|pieces)$/i.test(m[2]) ? "pcs" : "ctn";
    const words = raw.replace(m[0], " ").toLowerCase().split(/\s+/).filter((w) => w.length > 1 && !["of", "the", "ctn"].includes(w));
    let best: Product | null = null, bestScore = 0;
    for (const p of products) {
      const hay = (p.name + " " + p.brand + " " + p.code).toLowerCase();
      const score = words.reduce((s, w) => s + (hay.includes(w) ? w.length : 0), 0);
      if (score > bestScore) { best = p; bestScore = score; }
    }
    if (best && bestScore >= 3) lines.push({ productId: best.id, unit, qty, rate: rateFor(best, unit), discPct: 0 });
    else missed.push(raw);
  }
  return { lines, missed };
}

export default function NewOrder({ onClose, onCreated, defaultCustomer }: { onClose: () => void; onCreated: (id: string) => void; defaultCustomer?: string }) {
  const customers = useStore((s) => s.customers);
  const products = useStore((s) => s.products);
  const orders = useStore((s) => s.orders);
  const create = useStore((s) => s.createOrder);
  const user = useUser();
  const [cid, setCid] = useState(defaultCustomer ?? customers[0]?.id);
  const [lines, setLines] = useState<Line[]>([]);
  const [paste, setPaste] = useState("");
  const [q, setQ] = useState("");
  const c = customers.find((x) => x.id === cid);
  const t = totals(lines);

  const matches = useMemo(() => {
    const ql = q.toLowerCase().trim();
    if (!ql) return [];
    return products.filter((p) => (p.name + p.code + p.brand).toLowerCase().includes(ql)).slice(0, 5);
  }, [q, products]);

  const lastOrder = orders.find((o) => o.customerId === cid && o.status !== "cancelled");
  const add = (p: Product, unit: Unit = "ctn", qty = 1) => {
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === p.id && l.unit === unit);
      if (i >= 0) return ls.map((l, k) => (k === i ? { ...l, qty: l.qty + qty } : l));
      return [...ls, { productId: p.id, unit, qty, rate: rateFor(p, unit), discPct: 0 }];
    });
    setQ("");
  };
  const submit = () => {
    if (!cid || lines.length === 0) return;
    const id = create(cid, lines.filter((l) => l.qty > 0), c?.bookerId ?? user?.id ?? "u-b1");
    toast("Order booked and sent to the approval queue");
    onCreated(id);
  };

  return (
    <Modal open onClose={onClose} title="New sales order" width={780}>
      <div
        className="space-y-4"
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") submit(); }}
      >
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <div className="th mb-1">Customer</div>
            <select className="field" value={cid} onChange={(e) => setCid(e.target.value)} autoFocus>
              {customers.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.area}</option>)}
            </select>
          </div>
          {lastOrder && (
            <button className="btn" onClick={() => setLines(lastOrder.lines.map((l) => ({ ...l, pickedQty: undefined })))}>
              <Sparkles size={14} /> Repeat last order
            </button>
          )}
        </div>
        {c && <div className="text-xs text-ink2">Balance <span className="num font-semibold text-ink">Rs. {fmt(c.balance)}</span>{c.type === "credit" && <> of limit <span className="num">{fmt(c.creditLimit)}</span></>}</div>}

        <div className="rounded-xl border border-dashed border-line2 bg-panel2 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink2"><ClipboardPaste size={13} /> Smart paste a WhatsApp order</div>
          <div className="flex gap-2">
            <textarea className="field h-[58px] resize-none py-1.5" placeholder={"5 ctn surf, 2 ctn lux\n10 pcs vim"} value={paste} onChange={(e) => setPaste(e.target.value)} />
            <button className="btn self-end" onClick={() => {
              const r = parsePaste(paste, products);
              setLines((ls) => [...ls, ...r.lines]);
              setPaste("");
              toast(r.missed.length ? `Added ${r.lines.length}. Couldn't match: ${r.missed.join(", ")}` : `Added ${r.lines.length} lines`);
            }}>Add lines</button>
          </div>
        </div>

        <div className="relative">
          <input className="field" placeholder="Add product: type name or code, Enter to add 1 carton…" value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); add(matches[0]); } }} />
          {matches.length > 0 && (
            <div className="panel absolute z-10 mt-1 w-full overflow-hidden p-1">
              {matches.map((p, i) => (
                <button key={p.id} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accentsoft ${i === 0 ? "bg-accentwash" : ""}`} onClick={() => add(p)}>
                  <Thumb p={p} size={22} /><span className="flex-1 font-medium">{p.name}</span>
                  <span className="num text-xs text-ink3">{p.code}</span>
                  <span className="chip chip-ok num">{Math.floor(available(p) / p.packSize)} ctn</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-[96px] rounded-xl border border-line">
          {lines.length === 0 ? <div className="p-6 text-center text-ink3">No items yet</div> : (
            <table className="w-full text-[12.5px]">
              <thead><tr className="th text-left"><th className="px-3 py-2">Product</th><th>Unit</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th><th /></tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const p = products.find((x) => x.id === l.productId)!;
                  return (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-1.5"><div className="flex items-center gap-2"><Thumb p={p} size={22} />{p.name}</div></td>
                      <td>
                        <select className="cell !text-left" value={l.unit} onChange={(e) => { const u = e.target.value as Unit; setLines(lines.map((x, k) => k === i ? { ...x, unit: u, rate: rateFor(p, u) } : x)); }}>
                          <option value="ctn">Carton</option><option value="pcs">Pcs</option>
                        </select>
                      </td>
                      <td className="w-20"><input className="cell num font-semibold" type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, k) => k === i ? { ...x, qty: Math.max(0, +e.target.value) } : x))} /></td>
                      <td className="num text-right text-ink2">{fmt(l.rate)}</td>
                      <td className="num text-right font-semibold">{fmt(lineNet(l))}</td>
                      <td className="w-9 text-center"><button className="text-ink3 hover:text-[var(--bad-fg)]" onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 size={14} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-ink2">Tax 18% included in total · <span className="num">{lines.length}</span> items</div>
          <div className="flex items-center gap-4">
            <div className="num text-[20px] font-bold text-accent">Rs. {fmt(t.total)}</div>
            <button className="btn btn-primary h-9" disabled={!lines.length} onClick={submit}>Book order <Kbd>Ctrl</Kbd><Kbd>↵</Kbd></button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
