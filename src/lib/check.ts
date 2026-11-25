import type { Customer, Order, Product } from "./types";
import { available, orderTotal, pcsOf } from "./calc";

export function checkOrder(o: Order, c: Customer | undefined, products: Product[]) {
  const total = orderTotal(o);
  const over = !!c && c.type === "credit" && c.balance + total > c.creditLimit;
  const overdue = !!c && c.type === "credit" && c.oldestDue > c.creditDays + 14;
  const short = o.lines
    .map((l, i) => {
      const p = products.find((x) => x.id === l.productId);
      if (!p) return null;
      const need = pcsOf(l, p);
      const av = o.status === "booked" || o.status === "hold" ? available(p) : need;
      return need > av ? { i, shortPcs: need - av, p, l } : null;
    })
    .filter(Boolean) as { i: number; shortPcs: number; p: Product; l: Order["lines"][number] }[];
  return { over, overdue, short, total };
}
