import type { CountLine, CountSession, Product } from "./types";
import { velocity } from "./calc";

export const FREQ = { A: 7, B: 30, C: 90 } as const; // days between counts
export const RECOUNT_VALUE = 5000; // Rs: a variance worth more than this is recounted
export const RECOUNT_PCT = 10; // %: or a variance bigger than this share of the system quantity

export type Abc = "A" | "B" | "C";
/** A = products making up the first 70% of daily turnover at cost, B = next 20%, C = the rest. */
export function abcClasses(products: Product[]): Record<string, Abc> {
  const list = products.filter((p) => p.status !== "unlisted").map((p) => ({ id: p.id, v: velocity(p) * (p.costPrice / p.packSize) })).sort((a, b) => b.v - a.v);
  const total = list.reduce((s, x) => s + x.v, 0) || 1;
  let cum = 0;
  const out: Record<string, Abc> = {};
  for (const x of list) { out[x.id] = cum / total < 0.7 ? "A" : cum / total < 0.9 ? "B" : "C"; cum += x.v; }
  return out;
}

export function dueInfo(p: Product, cls: Abc, now = Date.now()) {
  const every = FREQ[cls];
  const since = p.lastCount ? Math.floor((now - p.lastCount) / 86400000) : 9999;
  const overdue = since - every;
  return { every, since, overdue, due: overdue >= 0, nextIn: Math.max(0, -overdue) };
}

export const lineFinal = (l: CountLine) => l.recount ?? l.counted;
export const lineDelta = (l: CountLine) => (lineFinal(l) ?? l.systemPcs) - l.systemPcs;
export function lineValue(l: CountLine, p: Product) { return Math.abs(lineDelta(l)) * (p.costPrice / p.packSize); }
export function needsRecount(l: CountLine, p: Product) {
  if (l.counted === undefined) return false;
  const d = Math.abs(l.counted - l.systemPcs);
  if (d === 0) return false;
  const first = d * (p.costPrice / p.packSize) > RECOUNT_VALUE || (l.systemPcs > 0 && (d / l.systemPcs) * 100 > RECOUNT_PCT);
  return first && l.recount === undefined;
}
export const sessionValue = (s: CountSession, products: Product[]) => s.lines.reduce((t, l) => t + lineValue(l, products.find((p) => p.id === l.productId)!), 0);

export const ABC_NOTE = "Class A are the fast, valuable items, so they are counted most often.";
