import type { Grn, GrnLine, Product, PurchaseOrder } from "./types";

export const TOLERANCE = 2; // % over the ordered quantity that is accepted without a flag

export const good = (l: GrnLine) => Math.max(0, l.arrived - l.rejected - l.damaged - l.held);
export const accepted = (l: GrnLine) => Math.max(0, l.arrived - l.rejected);

/** Cartons already received (approved) for a product on a PO. */
export function receivedSoFar(po: PurchaseOrder, grns: Grn[], productId: string, includeCounted = false) {
  return grns
    .filter((g) => g.poId === po.id && (g.status === "approved" || (includeCounted && g.status === "counted")))
    .reduce((s, g) => s + g.lines.filter((l) => l.productId === productId).reduce((a, l) => a + accepted(l), 0), 0);
}
export const remaining = (po: PurchaseOrder, grns: Grn[], productId: string, includeCounted = true) => {
  const ord = po.lines.find((l) => l.productId === productId)?.ordered ?? 0;
  return Math.max(0, ord - receivedSoFar(po, grns, productId, includeCounted));
};

export function monthsFromNow(expiry: string, now = Date.now()) {
  const [y, m] = expiry.split("-").map(Number);
  const d = new Date(now);
  return (y - d.getFullYear()) * 12 + (m - 1 - d.getMonth());
}

export interface LineCheck { errors: string[]; warnings: string[] }
export function checkLine(l: GrnLine, po: PurchaseOrder, grns: Grn[], thisGrn: string): LineCheck {
  const errors: string[] = [], warnings: string[] = [];
  const bad = l.rejected + l.damaged + l.held;
  if (l.arrived < 0 || l.rejected < 0 || l.damaged < 0 || l.held < 0) errors.push("Quantities cannot be negative");
  if (bad > l.arrived) errors.push("Rejected + damaged + held is more than arrived");
  if (bad > 0 && !l.reason) errors.push("Choose a reason for the rejected, damaged or held cartons");
  if (accepted(l) > 0) {
    if (!l.batch.trim()) errors.push("Batch number is required");
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(l.expiry)) errors.push("Expiry must look like 2027-06");
    else {
      const m = monthsFromNow(l.expiry);
      if (m < 0) errors.push("This batch has already expired");
      else if (m < 6) warnings.push(`Only ${m} month${m === 1 ? "" : "s"} of shelf life left`);
    }
  }
  const ord = po.lines.find((x) => x.productId === l.productId)?.ordered ?? 0;
  const prior = grns.filter((g) => g.poId === po.id && g.id !== thisGrn && (g.status === "approved" || g.status === "counted")).reduce((s, g) => s + g.lines.filter((x) => x.productId === l.productId).reduce((a, x) => a + accepted(x), 0), 0);
  if (prior + accepted(l) > ord * (1 + TOLERANCE / 100)) warnings.push(`Over the order by ${prior + accepted(l) - ord} carton${prior + accepted(l) - ord === 1 ? "" : "s"}`);
  return { errors, warnings };
}

export const REASONS = ["Damaged in transit", "Wet or torn cartons", "Wrong item", "Expired / short expiry", "Leaking", "Quality doubt"];

export interface Claim { grn: Grn; line: GrnLine; product: Product; short: number }
export function claimsOf(grns: Grn[], pos: PurchaseOrder[], products: Product[]): Claim[] {
  const out: Claim[] = [];
  for (const g of grns) {
    if (g.status === "counting") continue;
    const po = pos.find((p) => p.id === g.poId);
    for (const l of g.lines) {
      const p = products.find((x) => x.id === l.productId);
      if (!p || !po) continue;
      const exp = po.lines.find((x) => x.productId === l.productId)?.ordered ?? 0;
      const priorOther = grns.filter((x) => x.poId === po.id && x.id !== g.id && x.status !== "counting" && x.arrivedAt < g.arrivedAt).reduce((s, x) => s + x.lines.filter((y) => y.productId === l.productId).reduce((a, y) => a + accepted(y), 0), 0);
      const short = Math.max(0, exp - priorOther - accepted(l));
      const isLast = po.status === "closed" || po.status === "complete";
      if (l.rejected + l.damaged + l.held > 0 || (isLast && short > 0)) out.push({ grn: g, line: l, product: p, short: isLast ? short : 0 });
    }
  }
  return out;
}
