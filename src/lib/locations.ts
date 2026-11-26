import type { Batch, Bin, Product } from "./types";

export const DOCK = "RCV";
export const HOLD = "Q-01";
export const isStorage = (b: Bin) => b.zone !== "R" && b.zone !== "Q";

/** Cartons currently stored in a bin. */
export function binUsed(products: Product[], code: string) {
  let n = 0;
  for (const p of products) for (const b of p.batches) if (b.bin === code) n += b.qty / p.packSize;
  return n;
}
export function binContents(products: Product[], code: string) {
  const rows: { p: Product; b: Batch; ctn: number }[] = [];
  for (const p of products) for (const b of p.batches) if (b.bin === code && b.qty > 0) rows.push({ p, b, ctn: b.qty / p.packSize });
  const q: { p: Product; b: Batch; ctn: number; hold: true }[] = [];
  if (code === HOLD) for (const p of products) for (const b of p.quarantine) q.push({ p, b, ctn: b.qty / p.packSize, hold: true });
  return { rows, q };
}
export const rackOf = (code: string) => code.split("-").slice(0, 2).join("-");
export const levelOf = (code: string) => Number(code.split("-")[2]) || 0;

export type Fill = "empty" | "ok" | "full" | "over" | "blocked";
export function fillOf(bin: Bin, used: number): Fill {
  if (bin.blocked) return "blocked";
  if (used > bin.capacity + 0.001) return "over";
  if (used === 0) return "empty";
  return used / bin.capacity >= 0.85 ? "full" : "ok";
}

export interface Suggestion { bin: Bin; free: number; reason: string; score: number }
/** Best places for a batch: where the same batch already is, then the product's home rack (floor first), then zone overflow. */
export function suggestBins(p: Product, batch: Batch, products: Product[], bins: Bin[]): Suggestion[] {
  const needCtn = batch.qty / p.packSize;
  const out: Suggestion[] = [];
  for (const bin of bins) {
    if (!isStorage(bin) || bin.blocked) continue;
    const free = bin.capacity - binUsed(products, bin.code);
    if (free <= 0) continue;
    const sameBatch = products.some((x) => x.id === p.id && x.batches.some((b) => b.no === batch.no && b.bin === bin.code));
    const sameProduct = p.batches.some((b) => b.bin === bin.code);
    const home = !!p.bin && rackOf(bin.code) === p.bin;
    const overflow = bin.code === `${(p.bin || "E")[0]}-OV`;
    const otherProduct = products.some((x) => x.id !== p.id && x.batches.some((b) => b.bin === bin.code && b.qty > 0));
    let score = 0, reason = "";
    if (sameBatch) { score = 100; reason = "Same batch is already here"; }
    else if (home) { score = 80 - levelOf(bin.code) * 5; reason = levelOf(bin.code) === 1 ? "Home rack, pick face" : "Home rack"; }
    else if (sameProduct) { score = 60; reason = "Same product is already here"; }
    else if (overflow) { score = 30; reason = "Zone overflow"; }
    else if (!otherProduct && bin.zone === (p.bin || "E")[0]) { score = 40; reason = "Empty bin in the right zone"; }
    else continue;
    if (otherProduct && score < 100) score -= 15; // avoid mixing products when we can
    if (free < needCtn) score -= 10;
    out.push({ bin, free, reason: otherProduct && !sameBatch ? `${reason} (shares with another product)` : reason, score });
  }
  return out.sort((a, b) => b.score - a.score || b.free - a.free).slice(0, 8);
}

/** Products whose floor (pick face) bin is nearly empty while stock sits higher up or in overflow. */
export function replenishments(products: Product[], bins: Bin[]) {
  const out: { p: Product; face: Bin; from: Batch; ctn: number }[] = [];
  for (const p of products) {
    if (!p.bin) continue;
    const face = bins.find((b) => b.code === `${p.bin}-1`);
    if (!face || face.blocked) continue;
    const used = binUsed(products.filter((x) => x.id === p.id), face.code);
    if (used > face.capacity * 0.25) continue;
    const src = [...p.batches].filter((b) => b.bin !== face.code && b.bin !== DOCK && b.bin !== HOLD && b.qty > 0).sort((a, b) => a.expiry.localeCompare(b.expiry))[0];
    if (!src) continue;
    out.push({ p, face, from: src, ctn: Math.min(src.qty / p.packSize, face.capacity - used) });
  }
  return out;
}
