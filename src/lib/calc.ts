import type { Customer, Line, Order, Payment, PriceList, Product, ReturnNote, Scheme, Unit } from "./types";

export const fmt = (n: number) => Math.round(n).toLocaleString("en-PK");
export const money = (n: number) => `Rs. ${fmt(n)}`;
export const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`);

export function pcsOf(line: { qty: number; unit: Unit }, p: Product) {
  return line.unit === "ctn" ? line.qty * p.packSize : line.qty;
}

export function rateFor(p: Product, unit: Unit) {
  return unit === "ctn" ? p.cartonPrice : Math.round((p.cartonPrice / p.packSize) * 100) / 100;
}

export function lineGross(l: Line) {
  return l.qty * l.rate;
}
export function lineNet(l: Line) {
  return lineGross(l) * (1 - l.discPct / 100);
}

export function totals(lines: Line[], taxPct = 18) {
  const gross = lines.reduce((s, l) => s + lineGross(l), 0);
  const net = lines.reduce((s, l) => s + lineNet(l), 0);
  const discount = gross - net;
  const tax = (net * taxPct) / 100;
  return { gross, discount, taxable: net, tax, total: net + tax };
}

export const orderTotal = (o: Order) => totals(o.lines).total;
export const orderDue = (o: Order) => Math.max(0, orderTotal(o) - o.paid - (o.returned ?? 0));

export function expiryEnd(expiry: string) {
  const [y, m] = expiry.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59).getTime();
}
export const isExpired = (expiry: string, now = Date.now()) => expiryEnd(expiry) < now;
/** Pieces that can still be sold: good stock minus anything past its expiry. */
export function sellable(p: Product) {
  return p.batches.filter((b) => !isExpired(b.expiry)).reduce((s, b) => s + b.qty, 0);
}
export function available(p: Product) {
  return Math.max(0, sellable(p) - p.reserved);
}

export function creditUsedPct(c: Customer) {
  if (c.type === "cash" || !c.creditLimit) return 0;
  return Math.min(100, Math.round((c.balance / c.creditLimit) * 100));
}

export function ago(ts: number, now = Date.now()) {
  const m = Math.max(1, Math.round((now - ts) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function clock(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export const STEPS = ["booked", "approved", "picked", "invoiced", "delivered", "paid"] as const;
export const STEP_LABEL: Record<string, string> = {
  booked: "Booked", approved: "Approved", picked: "Picked", invoiced: "Invoiced", delivered: "Delivered", paid: "Paid",
};

/* ---------- price lists ---------- */
export function cartonPriceFor(p: Product, c: Customer | undefined, lists: PriceList[]) {
  const pl = lists.find((l) => l.id === c?.priceListId);
  if (!pl) return p.cartonPrice;
  if (pl.overrides[p.id] !== undefined) return pl.overrides[p.id];
  return Math.round(p.cartonPrice * (1 + pl.adjustPct / 100));
}
export function unitRate(p: Product, unit: Unit, c: Customer | undefined, lists: PriceList[]) {
  const ctn = cartonPriceFor(p, c, lists);
  return unit === "ctn" ? ctn : Math.round((ctn / p.packSize) * 100) / 100;
}

/* ---------- schemes ---------- */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function schemeActive(s: Scheme, route?: string, now = new Date()) {
  const t = iso(now);
  if (s.from && t < s.from) return false;
  if (s.to && t > s.to) return false;
  if (s.route && s.route !== "all" && s.route !== route) return false;
  return true;
}
export function schemeLabel(s: Scheme) {
  return s.type === "free" ? `Buy ${s.minCtn} ctn, get ${s.freeCtn} free` : `Buy ${s.minCtn}+ ctn: ${s.discPct}% off`;
}
/** Re-apply discount schemes and regenerate free-goods lines. Hand-typed discounts are kept. */
export function applySchemes(schemes: Scheme[], lines: Line[], route?: string): Line[] {
  const active = schemes.filter((s) => schemeActive(s, route));
  const paid = lines.filter((l) => !l.isFree).map((l): Line => {
    if (l.manualDisc) return l;
    if (l.unit !== "ctn") return { ...l, discPct: 0, scheme: undefined };
    const s = active.filter((x) => x.type === "discount" && x.productId === l.productId && l.qty >= x.minCtn).sort((a, b) => b.discPct - a.discPct)[0];
    return s ? { ...l, discPct: s.discPct, scheme: schemeLabel(s) } : { ...l, discPct: 0, scheme: undefined };
  });
  const free: Line[] = [];
  for (const l of paid) {
    if (l.unit !== "ctn") continue;
    const s = active.filter((x) => x.type === "free" && x.productId === l.productId && l.qty >= x.minCtn).sort((a, b) => b.freeCtn / b.minCtn - a.freeCtn / a.minCtn)[0];
    if (!s) continue;
    const n = Math.floor(l.qty / s.minCtn) * s.freeCtn;
    if (n > 0) free.push({ productId: l.productId, unit: "ctn", qty: n, rate: 0, discPct: 0, isFree: true, scheme: schemeLabel(s) });
  }
  return [...paid, ...free];
}

/* ---------- batches & expiry ---------- */
export function monthsLeft(expiry: string, now = Date.now()) {
  const [y, m] = expiry.split("-").map(Number);
  const d = new Date();
  d.setTime(now);
  return (y - d.getFullYear()) * 12 + (m - 1 - d.getMonth());
}
export const earliest = (p: Product) => [...p.batches].filter((b) => b.qty > 0).sort((a, b) => a.expiry.localeCompare(b.expiry))[0];

/* ---------- velocity & cover ---------- */
// Average daily pieces sold. Reorder level is set at ~10 days of sales, plus the live orders in the system.
export function velocity(p: Product) {
  return Math.max(1, p.reorder / 10);
}
export const coverDays = (p: Product) => available(p) / velocity(p);

/* ---------- receivables ---------- */
export const invoiceDate = (o: Order) => o.trail.find((t) => t.status === "invoiced")?.at ?? o.createdAt;
export const invoiced = (o: Order) => ["invoiced", "delivered", "paid"].includes(o.status);

export function unpaidOrders(orders: Order[], customerId: string) {
  return orders
    .filter((o) => o.customerId === customerId && invoiced(o) && orderDue(o) > 1)
    .sort((a, b) => invoiceDate(a) - invoiceDate(b));
}

export const BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;
export function aging(orders: Order[], c: Customer, now = Date.now()) {
  const b = [0, 0, 0, 0];
  const put = (age: number, amt: number) => { b[age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3] += amt; };
  let sum = 0;
  for (const o of unpaidOrders(orders, c.id)) {
    const due = orderDue(o);
    sum += due;
    put(Math.floor((now - invoiceDate(o)) / 86400000), due);
  }
  const opening = c.balance - sum;
  if (opening > 1) put(c.oldestDue, opening);
  return b;
}
export const overdueAmount = (orders: Order[], c: Customer) => {
  // portion older than the customer's credit days
  if (c.type === "cash") return 0;
  let tot = 0;
  const now = Date.now();
  for (const o of unpaidOrders(orders, c.id)) if ((now - invoiceDate(o)) / 86400000 > c.creditDays) tot += orderDue(o);
  const sum = unpaidOrders(orders, c.id).reduce((s, o) => s + orderDue(o), 0);
  const opening = c.balance - sum;
  if (opening > 1 && c.oldestDue > c.creditDays) tot += opening;
  return tot;
};

export interface LedgerRow { at: number; ref: string; text: string; debit: number; credit: number; bal: number }
export function ledger(c: Customer, orders: Order[], payments: Payment[], returns: ReturnNote[]): LedgerRow[] {
  const rows: Omit<LedgerRow, "bal">[] = [];
  for (const o of orders) {
    if (o.customerId !== c.id || !invoiced(o) || c.type === "cash") continue;
    rows.push({ at: invoiceDate(o), ref: o.invoiceNo ?? o.folio, text: `Invoice · ${o.folio}`, debit: orderTotal(o), credit: 0 });
  }
  for (const p of payments) if (p.customerId === c.id && c.type === "credit") rows.push({ at: p.at, ref: "RCPT", text: `Payment (${p.mode})`, debit: 0, credit: p.amount });
  for (const r of returns) if (r.customerId === c.id && r.status === "inspected" && c.type === "credit") rows.push({ at: r.at, ref: r.folio, text: "Credit note (return)", debit: 0, credit: r.value ?? 0 });
  rows.sort((a, b) => a.at - b.at);
  const net = rows.reduce((s, r) => s + r.debit - r.credit, 0);
  let bal = c.balance - net;
  const out: LedgerRow[] = [{ at: Date.now() - (c.oldestDue + 30) * 86400000, ref: "OPEN", text: "Opening balance", debit: 0, credit: 0, bal }];
  for (const r of rows) { bal += r.debit - r.credit; out.push({ ...r, bal }); }
  return out;
}
