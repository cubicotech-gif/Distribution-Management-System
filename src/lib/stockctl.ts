import type { Customer, Order, Product, StockEntry } from "./types";
import { available, expiryEnd as expEnd } from "./calc";

export const DAY = 86400000;
export const expiryEnd = expEnd;
export const daysLeft = (expiry: string, now = Date.now()) => Math.floor((expiryEnd(expiry) - now) / DAY);

export type Tier = "expired" | "d30" | "d60" | "d90" | "ok";
export const tierOf = (d: number): Tier => (d < 0 ? "expired" : d <= 30 ? "d30" : d <= 60 ? "d60" : d <= 90 ? "d90" : "ok");
export const TIER: Record<Tier, { label: string; chip: string; action: string }> = {
  expired: { label: "Expired", chip: "chip-bad", action: "Write off. Never sell." },
  d30: { label: "Within 30 days", chip: "chip-bad", action: "Run a clearance deal or return to the supplier" },
  d60: { label: "31 to 60 days", chip: "chip-warn", action: "Push to customers now" },
  d90: { label: "61 to 90 days", chip: "chip-info", action: "Sell first, watch weekly" },
  ok: { label: "More than 90 days", chip: "chip-ok", action: "Fine" },
};

export interface BatchGroup { key: string; p: Product; no: string; expiry: string; pcs: number; ctn: number; bins: string[]; receivedAt: number; clearance: boolean; days: number; tier: Tier; value: number }
export function batchGroups(products: Product[], now = Date.now()): BatchGroup[] {
  const out: BatchGroup[] = [];
  for (const p of products) {
    for (const no of Array.from(new Set(p.batches.filter((b) => b.qty > 0).map((b) => b.no)))) {
      const rows = p.batches.filter((b) => b.no === no && b.qty > 0);
      const pcs = rows.reduce((s, b) => s + b.qty, 0);
      const days = daysLeft(rows[0].expiry, now);
      out.push({
        key: `${p.id}|${no}`, p, no, expiry: rows[0].expiry, pcs, ctn: pcs / p.packSize, bins: Array.from(new Set(rows.map((b) => b.bin))),
        receivedAt: Math.min(...rows.map((b) => b.receivedAt ?? now)), clearance: rows.some((b) => b.clearance), days, tier: tierOf(days), value: (pcs / p.packSize) * p.costPrice,
      });
    }
  }
  return out;
}

export function statusSplit(p: Product, now = Date.now()) {
  const expired = p.batches.filter((b) => daysLeft(b.expiry, now) < 0).reduce((s, b) => s + b.qty, 0);
  return { available: available(p), reserved: Math.min(p.reserved, p.stock), held: p.quarantine.reduce((s, b) => s + b.qty, 0), damaged: p.damaged, expired };
}

export function ageBuckets(p: Product, now = Date.now()) {
  const b = [0, 0, 0, 0];
  for (const x of p.batches) {
    const age = (now - (x.receivedAt ?? now)) / DAY;
    b[age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3] += x.qty;
  }
  return b;
}
export const oldestAge = (p: Product, now = Date.now()) => Math.max(0, ...p.batches.filter((b) => b.qty > 0).map((b) => Math.floor((now - (b.receivedAt ?? now)) / DAY)));
export const lastPick = (ledger: StockEntry[], productId: string) => ledger.filter((e) => e.productId === productId && e.kind === "pick").reduce<number | undefined>((m, e) => (m === undefined || e.at > m ? e.at : m), undefined);

export const KIND: Record<StockEntry["kind"], { label: string; tone: "in" | "out" | "move" | "flag" }> = {
  receipt: { label: "Received", tone: "in" }, pick: { label: "Picked", tone: "out" }, return: { label: "Customer return", tone: "in" },
  adjustment: { label: "Count adjustment", tone: "flag" }, transfer: { label: "Moved", tone: "move" }, putaway: { label: "Put away", tone: "move" },
  hold: { label: "Quality hold", tone: "flag" }, release: { label: "Released", tone: "in" }, damaged: { label: "Damaged", tone: "flag" },
  "supplier-return": { label: "To supplier", tone: "out" }, "write-off": { label: "Written off", tone: "out" }, recall: { label: "Recall hold", tone: "flag" },
  issue: { label: "Issued (sample / internal)", tone: "out" }, destroy: { label: "Destroyed", tone: "out" },
};

/** Entries for one product, newest first, each with the good on-hand balance AFTER it (worked back from today's stock). */
export function withBalance(entries: StockEntry[], productId: string, currentPcs: number) {
  const mine = entries.filter((e) => e.productId === productId).sort((a, b) => b.at - a.at);
  let bal = currentPcs;
  return mine.map((e) => { const after = bal; bal -= e.qty; return { e, after }; });
}

export interface TraceCustomer { key: string; name: string; phone: string; route: string; ref: string; invoice?: string; pcs: number; at: number; status: string }
export function traceBatch(ledger: StockEntry[], orders: Order[], customers: Customer[], productId: string, batch: string): TraceCustomer[] {
  const out: TraceCustomer[] = [];
  for (const e of ledger.filter((x) => x.kind === "pick" && x.productId === productId && x.batch === batch)) {
    const o = e.orderId ? orders.find((x) => x.id === e.orderId) : undefined;
    const c = o ? customers.find((x) => x.id === o.customerId) : customers.find((x) => x.name === e.note);
    out.push({
      key: e.id, name: c?.name ?? e.note ?? "Unknown", phone: c?.phone ?? "", route: c?.route ?? "", ref: e.ref, invoice: o?.invoiceNo, pcs: -e.qty, at: e.at,
      status: o ? (o.status === "picked" ? "Picked, not invoiced" : o.status === "invoiced" ? "On the truck" : o.status === "delivered" || o.status === "paid" ? "Delivered" : o.status) : "Delivered",
    });
  }
  return out.sort((a, b) => b.at - a.at);
}
