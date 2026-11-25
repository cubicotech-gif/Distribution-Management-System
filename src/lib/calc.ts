import type { Customer, Line, Order, Product, Unit } from "./types";

export const fmt = (n: number) => Math.round(n).toLocaleString("en-PK");
export const money = (n: number) => `Rs. ${fmt(n)}`;

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

export function available(p: Product) {
  return Math.max(0, p.stock - p.reserved);
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
  booked: "Booked",
  approved: "Approved",
  picked: "Picked",
  invoiced: "Invoiced",
  delivered: "Delivered",
  paid: "Paid",
};
