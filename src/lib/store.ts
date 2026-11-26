"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CUSTOMERS, ORDERS, PAYMENTS, PRODUCTS, PURCHASES, RETURNS, SCHEMES, TRIPS, USERS } from "./seed";
import { orderDue, orderTotal, pcsOf, totals, unpaidOrders, withScheme } from "./calc";
import type {
  Activity, Allocation, Approval, Customer, Line, Order, OrderStatus, Payment, Product, PurchaseOrder,
  PriceChange, ProductStatus, ReturnNote, ReturnReason, Role, Scheme, StockAdj, SupplierReturn, Trip, User,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);
export const MAX_DISCOUNT = 5; // % above which the owner must approve
export const PRICE_LIMIT = 10; // % price change above which the owner must approve
export const ADJ_LIMIT = 20000; // Rs. stock-count variance above which the owner must approve

const cloneP = (ps: Product[]) => ps.map((p) => ({ ...p, batches: p.batches.map((b) => ({ ...b })) }));

/** Take pcs from the earliest-expiry batches first. Mutates the (cloned) product. */
function fefo(p: Product, pcs: number): { batch: string; expiry: string; pcs: number }[] {
  const out: { batch: string; expiry: string; pcs: number }[] = [];
  let need = pcs;
  for (const b of [...p.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))) {
    if (need <= 0) break;
    const take = Math.min(b.qty, need);
    if (take > 0) { b.qty -= take; need -= take; out.push({ batch: b.no, expiry: b.expiry, pcs: take }); }
  }
  p.batches = p.batches.filter((b) => b.qty > 0);
  p.stock = p.batches.reduce((s, b) => s + b.qty, 0);
  return out;
}
function addBatch(p: Product, no: string, expiry: string, pcs: number) {
  const ex = p.batches.find((b) => b.no === no);
  if (ex) ex.qty += pcs; else p.batches.push({ id: uid(), no, expiry, qty: pcs });
  p.stock = p.batches.reduce((s, b) => s + b.qty, 0);
}

function initialProducts(): Product[] {
  const ps = cloneP(PRODUCTS);
  for (const o of ORDERS) {
    if (o.status === "approved") {
      for (const l of o.lines) {
        const p = ps.find((x) => x.id === l.productId)!;
        p.reserved += pcsOf(l, p);
      }
    }
  }
  return ps;
}

const seedState = () => ({
  users: USERS,
  products: initialProducts(),
  customers: CUSTOMERS.map((c) => ({ ...c })),
  orders: ORDERS.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l })), trail: [...o.trail] })),
  purchases: PURCHASES.map((p) => ({ ...p, lines: p.lines.map((l) => ({ ...l })) })),
  payments: [...PAYMENTS] as Payment[],
  returns: RETURNS.map((r) => ({ ...r })) as ReturnNote[],
  trips: TRIPS.map((t) => ({ ...t })) as Trip[],
  schemes: SCHEMES.map((s) => ({ ...s })) as Scheme[],
  supplierReturns: [] as SupplierReturn[],
  adjustments: [] as StockAdj[],
  approvals: [] as Approval[],
  priceHistory: [] as PriceChange[],
  activity: [] as Activity[],
  seq: 43,
});

interface State {
  userId: string | null;
  users: User[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  purchases: PurchaseOrder[];
  payments: Payment[];
  returns: ReturnNote[];
  trips: Trip[];
  schemes: Scheme[];
  supplierReturns: SupplierReturn[];
  adjustments: StockAdj[];
  approvals: Approval[];
  priceHistory: PriceChange[];
  activity: Activity[];
  seq: number;

  login: (id: string) => void;
  logout: () => void;
  reset: () => void;

  // sales cycle
  createOrder: (customerId: string, lines: Line[], bookerId: string, note?: string) => string;
  updateOrderLines: (id: string, lines: Line[]) => void;
  approveOrder: (id: string, by: string, ownerOverride?: boolean) => { ok: boolean; reasons?: string[] };
  holdOrder: (id: string, by: string) => void;
  cancelOrder: (id: string, by: string) => void;
  pickOrder: (id: string, picked: Record<number, number>, reasons: Record<number, string>, by: string) => void;
  invoiceOrder: (id: string, by: string) => void;
  invoiceAll: (by: string) => number;

  // dispatch
  createTrip: (orderIds: string[], vehicle: string, driverId: string, keId: string, by: string) => void;
  dispatchTrip: (id: string, by: string) => void;
  settleTrip: (id: string, counted: number, by: string) => void;
  deliverOrder: (id: string, by: string) => void;
  signOrder: (id: string, dataUrl: string) => void;
  fileOrder: (id: string) => void;

  // money
  collect: (customerId: string, amount: number, by: string, orderId?: string, mode?: Payment["mode"]) => void;

  // returns
  reportReturn: (orderId: string, productId: string, qtyPcs: number, reason: ReturnReason, by: string) => void;
  inspectReturn: (id: string, condition: "good" | "damaged", by: string) => void;
  createSupplierReturn: (productId: string, qtyPcs: number, reason: string, by: string) => void;

  // stock in
  createPO: (supplier: string, lines: { productId: string; ordered: number }[], newItems?: NewItem[]) => void;
  receivePO: (id: string, rows: Record<number, { received: number; damaged: number; batch: string; expiry: string }>, by: string) => void;
  approvePO: (id: string) => void;
  cycleCount: (productId: string, counted: number, reason: string, by: string) => void;

  // owner
  approveRequest: (id: string, by: string) => void;
  rejectRequest: (id: string, by: string) => void;

  // masters
  upsertProduct: (p: Product, by?: string) => void;
  setProductStatus: (id: string, status: ProductStatus) => void;
  deleteProduct: (id: string) => boolean;
  applyPrices: (changes: { productId: string; newPrice: number }[], by: string, note: string) => { applied: number; pending: number };
  bulkPrice: (ids: string[], pct: number, by: string) => { applied: number; pending: number };
  importProducts: (rows: ImportRow[], by: string) => { added: number; updated: number; pending: number };
  upsertCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
  upsertScheme: (s: Scheme) => void;
  deleteScheme: (id: string) => void;
  setBookerTarget: (id: string, target: number) => void;
}

export interface NewItem { name: string; brand: string; packSize: number; costPrice: number; ordered: number }
export interface ImportRow { code: string; name?: string; brand?: string; supplier?: string; packSize?: number; cartonPrice?: number; costPrice?: number; reorder?: number; leadDays?: number; bin?: string }

const log = (s: State, text: string): Activity[] => [{ id: uid(), at: Date.now(), text }, ...s.activity].slice(0, 80);
const stamp = (o: Order, status: OrderStatus, by: string) => [...o.trail, { status, at: Date.now(), by }];

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      userId: null,
      ...seedState(),

      login: (id) => set({ userId: id }),
      logout: () => set({ userId: null }),
      reset: () => set({ ...seedState() }),

      createOrder: (customerId, lines, bookerId, note) => {
        const s = get();
        const booker = s.users.find((u) => u.id === bookerId);
        const id = `o${s.seq}`;
        const priced = lines.map((l) => withScheme(s.schemes, l));
        const o: Order = {
          id, folio: `SO-${1000 + s.seq}`, customerId, bookerId, lines: priced, status: "booked", createdAt: Date.now(),
          trail: [{ status: "booked", at: Date.now(), by: booker?.initials ?? "—" }], paid: 0, note,
        };
        const c = s.customers.find((x) => x.id === customerId);
        set({ orders: [o, ...s.orders], seq: s.seq + 1, activity: log(s, `${booker?.name ?? "Desk"} booked ${o.folio} for ${c?.name}`) });
        return id;
      },

      updateOrderLines: (id, lines) => set((st) => ({ orders: st.orders.map((o) => (o.id === id ? { ...o, lines } : o)) })),

      approveOrder: (id, by, ownerOverride = false) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o) return { ok: false };
        const c = s.customers.find((x) => x.id === o.customerId);
        const reasons: string[] = [];
        const total = orderTotal(o);
        if (c && c.type === "credit" && c.balance + total > c.creditLimit) reasons.push(`Over credit limit by Rs. ${Math.round(c.balance + total - c.creditLimit).toLocaleString()}`);
        if (c && c.type === "credit" && c.oldestDue > c.creditDays + 14) reasons.push(`Oldest invoice ${c.oldestDue} days unpaid`);
        const maxDisc = Math.max(0, ...o.lines.map((l) => l.discPct));
        if (maxDisc > MAX_DISCOUNT) reasons.push(`Discount ${maxDisc}% is above the ${MAX_DISCOUNT}% limit`);

        if (reasons.length && !ownerOverride) {
          const exists = s.approvals.some((a) => a.kind === "order" && a.refId === id && a.status === "pending");
          set({
            orders: s.orders.map((x) => (x.id === id ? { ...x, status: "hold", needsOwner: reasons, trail: stamp(x, "hold", by) } : x)),
            approvals: exists ? s.approvals : [{
              id: uid(), kind: "order", refId: id, text: `${o.folio} · ${c?.name}`, detail: reasons.join(" · "),
              amount: total, by, at: Date.now(), status: "pending",
            }, ...s.approvals],
            activity: log(s, `${o.folio} sent to owner for approval (${reasons[0]})`),
          });
          return { ok: false, reasons };
        }
        const products = cloneP(s.products);
        for (const l of o.lines) {
          const p = products.find((x) => x.id === l.productId)!;
          const av = p.stock - p.reserved;
          p.reserved += Math.min(pcsOf(l, p), Math.max(0, av));
        }
        set({
          products,
          orders: s.orders.map((x) => (x.id === id ? { ...x, status: "approved", needsOwner: undefined, trail: stamp(x, "approved", by) } : x)),
          activity: log(s, `${o.folio} approved by ${by}. Stock reserved`),
        });
        return { ok: true };
      },

      holdOrder: (id, by) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status: "hold", trail: stamp(o, "hold", by) } : o)) })),

      cancelOrder: (id, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o) return;
        const products = cloneP(s.products);
        if (o.status === "approved") {
          for (const l of o.lines) {
            const p = products.find((x) => x.id === l.productId)!;
            p.reserved = Math.max(0, p.reserved - pcsOf(l, p));
          }
        }
        set({
          products,
          orders: s.orders.map((x) => (x.id === id ? { ...x, status: "cancelled", needsOwner: undefined, trail: stamp(x, "cancelled", by) } : x)),
          approvals: s.approvals.map((a) => (a.kind === "order" && a.refId === id && a.status === "pending" ? { ...a, status: "rejected" } : a)),
        });
      },

      pickOrder: (id, picked, reasons, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o) return;
        const products = cloneP(s.products);
        const allocation: Allocation[] = [];
        const lines: Line[] = [];
        o.lines.forEach((l, i) => {
          const p = products.find((x) => x.id === l.productId)!;
          const pq = Math.max(0, Math.min(picked[i] ?? l.qty, l.qty));
          p.reserved = Math.max(0, p.reserved - pcsOf(l, p));
          const got = fefo(p, pcsOf({ ...l, qty: pq }, p));
          got.forEach((g) => allocation.push({ i: lines.length, ...g }));
          if (pq > 0) lines.push(withShort({ ...l, qty: pq, pickedQty: pq, orderedQty: l.qty }, l.qty, reasons[i]));
        });
        const challanNo = `DC-${2000 + Number(o.folio.slice(3)) - 1000}`;
        set({
          products,
          orders: s.orders.map((x) => (x.id === id ? { ...x, lines, allocation, challanNo, status: "picked", trail: stamp(x, "picked", by) } : x)),
          activity: log(s, `${challanNo} created for ${o.folio}. Batches allocated by expiry`),
        });
      },

      invoiceOrder: (id, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o || o.status !== "picked") return;
        const invoiceNo = `INV-${3000 + Number(o.folio.slice(3)) - 1000}`;
        const total = totals(o.lines).total;
        set({
          customers: s.customers.map((x) => (x.id === o.customerId && x.type === "credit" ? { ...x, balance: x.balance + total } : x)),
          orders: s.orders.map((x) => (x.id === id ? { ...x, invoiceNo, status: "invoiced", trail: stamp(x, "invoiced", by) } : x)),
          activity: log(s, `${invoiceNo} issued for ${o.folio} (Rs. ${Math.round(total).toLocaleString()})`),
        });
      },

      invoiceAll: (by) => {
        const ids = get().orders.filter((o) => o.status === "picked").map((o) => o.id);
        ids.forEach((id) => get().invoiceOrder(id, by));
        return ids.length;
      },

      createTrip: (orderIds, vehicle, driverId, keId, by) => {
        const s = get();
        const id = `t${uid()}`;
        const trip: Trip = { id, folio: `TRIP-${99 + s.trips.length + 1}`, vehicle, driverId, keId, orderIds, status: "loading", createdAt: Date.now() };
        set({
          trips: [trip, ...s.trips],
          orders: s.orders.map((o) => (orderIds.includes(o.id) ? { ...o, tripId: id } : o)),
          activity: log(s, `${trip.folio} load sheet created by ${by} (${orderIds.length} invoices, ${vehicle})`),
        });
      },
      dispatchTrip: (id, by) =>
        set((s) => ({
          trips: s.trips.map((t) => (t.id === id ? { ...t, status: "out", dispatchedAt: Date.now() } : t)),
          activity: log(s, `${s.trips.find((t) => t.id === id)?.folio} left the depot (${by})`),
        })),
      settleTrip: (id, counted, by) => {
        const s = get();
        const t = s.trips.find((x) => x.id === id);
        if (!t) return;
        const expected = s.payments.filter((p) => p.tripId === id && p.mode === "cash").reduce((a, p) => a + p.amount, 0);
        set({
          trips: s.trips.map((x) => (x.id === id ? { ...x, status: "closed", closedAt: Date.now(), expectedCash: expected, countedCash: counted } : x)),
          activity: log(s, `${t.folio} settled by ${by}. Cash ${counted === expected ? "matched" : `differs by Rs. ${Math.round(counted - expected).toLocaleString()}`}`),
        });
      },

      deliverOrder: (id, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        set({
          orders: s.orders.map((x) => (x.id === id ? { ...x, status: "delivered", trail: stamp(x, "delivered", by) } : x)),
          activity: log(s, `${o?.folio} delivered to customer`),
        });
      },
      signOrder: (id, dataUrl) => set((st) => ({ orders: st.orders.map((o) => (o.id === id ? { ...o, signature: dataUrl } : o)) })),
      fileOrder: (id) => set((st) => ({ orders: st.orders.map((o) => (o.id === id ? { ...o, filed: true } : o)) })),

      collect: (customerId, amount, by, orderId, mode = "cash") => {
        const s = get();
        const c = s.customers.find((x) => x.id === customerId);
        if (!c || amount <= 0) return;
        let left = amount;
        const orders = s.orders.map((o) => ({ ...o }));
        const target = orderId ? orders.find((o) => o.id === orderId) : undefined;
        const queue = [
          ...(target ? [target] : []),
          ...unpaidOrders(orders, customerId).map((u) => orders.find((o) => o.id === u.id)!).filter((o) => o !== target),
        ];
        for (const o of queue) {
          if (left <= 0) break;
          const due = orderDue(o);
          const pay = Math.min(due, left);
          o.paid += pay; left -= pay;
          if (orderDue(o) <= 1 && o.status === "delivered") { o.status = "paid"; o.trail = stamp(o, "paid", by); }
        }
        const pay: Payment = { id: uid(), customerId, orderId, tripId: target?.tripId, amount, mode, at: Date.now(), by };
        set({
          payments: [pay, ...s.payments],
          orders,
          customers: s.customers.map((x) => {
            if (x.id !== customerId || x.type === "cash") return x;
            const bal = Math.max(0, x.balance - amount);
            return { ...x, balance: bal, oldestDue: bal === 0 ? 0 : x.oldestDue };
          }),
          activity: log(s, `Rs. ${Math.round(amount).toLocaleString()} ${mode} received from ${c.name}`),
        });
      },

      reportReturn: (orderId, productId, qtyPcs, reason, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === orderId);
        const p = s.products.find((x) => x.id === productId);
        if (!o || !p) return;
        const note: ReturnNote = {
          id: uid(), folio: `RT-${502 + s.returns.length}`, orderId, customerId: o.customerId, productId, qtyPcs, reason,
          status: "pending", by, at: Date.now(),
        };
        set({ returns: [note, ...s.returns], activity: log(s, `${note.folio}: ${qtyPcs} pcs of ${p.name} coming back (${reason})`) });
      },

      inspectReturn: (id, condition, by) => {
        const s = get();
        const r = s.returns.find((x) => x.id === id);
        if (!r || r.status !== "pending") return;
        const o = s.orders.find((x) => x.id === r.orderId);
        const l = o?.lines.find((x) => x.productId === r.productId);
        const p = s.products.find((x) => x.id === r.productId);
        if (!o || !l || !p) return;
        const perPcs = (l.unit === "ctn" ? l.rate / p.packSize : l.rate) * (1 - l.discPct / 100) * 1.18;
        const value = Math.round(perPcs * r.qtyPcs);
        const products = cloneP(s.products);
        const pp = products.find((x) => x.id === r.productId)!;
        if (condition === "good") addBatch(pp, `RET-${r.folio.slice(3)}`, (pp.batches[0]?.expiry ?? "2027-06"), r.qtyPcs);
        else pp.damaged += r.qtyPcs;
        const c = s.customers.find((x) => x.id === r.customerId);
        set({
          products,
          returns: s.returns.map((x) => (x.id === id ? { ...x, status: "inspected", condition, value } : x)),
          customers: s.customers.map((x) => (x.id === r.customerId && x.type === "credit" ? { ...x, balance: Math.max(0, x.balance - value) } : x)),
          orders: s.orders.map((x) => (x.id === r.orderId ? { ...x, returned: (x.returned ?? 0) + value } : x)),
          activity: log(s, `${r.folio} inspected by ${by}: ${condition === "good" ? "back to stock" : "to damaged"}. Credit note Rs. ${value.toLocaleString()} for ${c?.name}`),
        });
      },

      createSupplierReturn: (productId, qtyPcs, reason, by) => {
        const s = get();
        const p = s.products.find((x) => x.id === productId);
        if (!p || qtyPcs <= 0 || qtyPcs > p.damaged) return;
        const value = Math.round((p.costPrice / p.packSize) * qtyPcs);
        const r: SupplierReturn = { id: uid(), folio: `DN-${600 + s.supplierReturns.length + 1}`, supplier: p.supplier, productId, qtyPcs, reason, value, at: Date.now() };
        set({
          supplierReturns: [r, ...s.supplierReturns],
          products: s.products.map((x) => (x.id === productId ? { ...x, damaged: x.damaged - qtyPcs } : x)),
          activity: log(s, `${r.folio}: ${qtyPcs} pcs of ${p.name} returned to ${p.supplier} by ${by}`),
        });
      },

      createPO: (supplier, lines, newItems = []) => {
        const s = get();
        const created: Product[] = newItems.map((n, i) => ({
          id: `p${uid()}`, status: "unlisted", code: `NEW-${s.products.length + i + 1}`, name: n.name, brand: n.brand || supplier.split(" ")[0],
          supplier, packSize: n.packSize, cartonPrice: 0, costPrice: n.costPrice, taxPct: 18, stock: 0, batches: [], damaged: 0, reserved: 0,
          reorder: n.packSize * 5, leadDays: 5, bin: "", hue: Math.floor(Math.random() * 360),
        }));
        const all = [...lines, ...created.map((p, i) => ({ productId: p.id, ordered: newItems[i].ordered }))];
        set({
          products: [...created, ...s.products],
          purchases: [{ id: `po${uid()}`, folio: `PO-${7012 + s.purchases.length - 2}`, supplier, lines: all, status: "ordered", createdAt: Date.now() }, ...s.purchases],
          activity: log(s, `Purchase order sent to ${supplier}${created.length ? ` (${created.length} new item${created.length > 1 ? "s" : ""} to be listed)` : ""}`),
        });
      },

      receivePO: (id, rows, by) =>
        set((s) => ({
          purchases: s.purchases.map((po) =>
            po.id === id
              ? { ...po, status: "received", lines: po.lines.map((l, i) => ({ ...l, ...(rows[i] ?? { received: l.ordered, damaged: 0, batch: "", expiry: "" }) })) }
              : po
          ),
          activity: log(s, `${by} counted the goods for ${s.purchases.find((p) => p.id === id)?.folio}`),
        })),

      approvePO: (id) => {
        const s = get();
        const po = s.purchases.find((x) => x.id === id);
        if (!po) return;
        const products = cloneP(s.products);
        po.lines.forEach((l) => {
          const p = products.find((x) => x.id === l.productId);
          if (!p) return;
          const good = Math.max(0, (l.received ?? 0) - (l.damaged ?? 0)) * p.packSize;
          if (good > 0) addBatch(p, l.batch || `B${Date.now().toString().slice(-5)}`, l.expiry || "2027-12", good);
          p.damaged += (l.damaged ?? 0) * p.packSize;
        });
        set({
          products,
          purchases: s.purchases.map((x) => (x.id === id ? { ...x, status: "approved" } : x)),
          activity: log(s, `${po.folio} approved. Stock is live for bookers`),
        });
      },

      cycleCount: (productId, counted, reason, by) => {
        const s = get();
        const p = s.products.find((x) => x.id === productId);
        if (!p) return;
        const delta = counted - p.stock;
        if (delta === 0) return;
        const value = Math.round(Math.abs(delta) * (p.costPrice / p.packSize));
        const auto = value <= ADJ_LIMIT;
        const adj: StockAdj = { id: uid(), productId, deltaPcs: delta, counted, reason, value, status: auto ? "applied" : "pending", by, at: Date.now() };
        const products = auto ? applyDelta(s.products, productId, delta) : s.products;
        set({
          products,
          adjustments: [adj, ...s.adjustments],
          approvals: auto ? s.approvals : [{
            id: uid(), kind: "adjustment", refId: adj.id, text: `Stock count: ${p.name}`,
            detail: `${delta > 0 ? "+" : ""}${Math.round(delta / p.packSize * 10) / 10} ctn variance (${reason})`, amount: value, by, at: Date.now(), status: "pending",
          }, ...s.approvals],
          activity: log(s, `${by} counted ${p.name}: ${delta > 0 ? "+" : ""}${delta} pcs ${auto ? "adjusted" : "sent for owner approval"}`),
        });
      },

      approveRequest: (id, by) => {
        const s = get();
        const a = s.approvals.find((x) => x.id === id);
        if (!a || a.status !== "pending") return;
        if (a.kind === "order") get().approveOrder(a.refId, by, true);
        else if (a.kind === "price") {
          const st = get();
          const ch = st.priceHistory.filter((c) => c.batchId === a.refId && c.status === "pending");
          set({
            products: st.products.map((p) => { const c = ch.find((x) => x.productId === p.id); return c ? { ...p, cartonPrice: c.newPrice } : p; }),
            priceHistory: st.priceHistory.map((c) => (c.batchId === a.refId && c.status === "pending" ? { ...c, status: "applied" } : c)),
          });
        } else {
          const adj = s.adjustments.find((x) => x.id === a.refId);
          if (adj) set({ products: applyDelta(get().products, adj.productId, adj.deltaPcs), adjustments: get().adjustments.map((x) => (x.id === adj.id ? { ...x, status: "applied" } : x)) });
        }
        set((st) => ({ approvals: st.approvals.map((x) => (x.id === id ? { ...x, status: "approved" } : x)), activity: log(st, `Owner approved ${a.text}`) }));
      },
      rejectRequest: (id, by) => {
        const s = get();
        const a = s.approvals.find((x) => x.id === id);
        if (!a || a.status !== "pending") return;
        if (a.kind === "order") get().cancelOrder(a.refId, by);
        else if (a.kind === "price") set({ priceHistory: s.priceHistory.map((c) => (c.batchId === a.refId && c.status === "pending" ? { ...c, status: "rejected" } : c)) });
        else set({ adjustments: s.adjustments.map((x) => (x.id === a.refId ? { ...x, status: "rejected" } : x)) });
        set((st) => ({ approvals: st.approvals.map((x) => (x.id === id ? { ...x, status: "rejected" } : x)), activity: log(st, `Owner rejected ${a.text}`) }));
      },

      upsertProduct: (p, by = "—") => {
        const s = get();
        const old = s.products.find((x) => x.id === p.id);
        if (!old) {
          set({ products: [{ ...p, cartonPrice: 0 }, ...s.products] });
          if (p.cartonPrice > 0) get().applyPrices([{ productId: p.id, newPrice: p.cartonPrice }], by, "Listed");
          return;
        }
        const { cartonPrice: newPrice, ...rest } = p;
        set({ products: s.products.map((x) => (x.id === p.id ? { ...x, ...rest, batches: x.batches, stock: x.stock, damaged: x.damaged, reserved: x.reserved } : x)) });
        if (newPrice !== old.cartonPrice) get().applyPrices([{ productId: p.id, newPrice }], by, old.cartonPrice === 0 ? "Listed" : "Edited");
      },
      setProductStatus: (id, status) => set((s) => ({ products: s.products.map((x) => (x.id === id ? { ...x, status } : x)) })),
      deleteProduct: (id) => {
        const s = get();
        const p = s.products.find((x) => x.id === id);
        const used = !!p && (p.stock > 0 || p.damaged > 0 || s.orders.some((o) => o.lines.some((l) => l.productId === id)) || s.purchases.some((o) => o.lines.some((l) => l.productId === id)));
        if (!p || used) return false;
        set({ products: s.products.filter((x) => x.id !== id), schemes: s.schemes.filter((x) => x.productId !== id) });
        return true;
      },
      applyPrices: (changes, by, note) => {
        const s = get();
        const batchId = uid();
        const now = Date.now();
        const entries: PriceChange[] = [];
        for (const c of changes) {
          const p = s.products.find((x) => x.id === c.productId);
          if (!p || c.newPrice === p.cartonPrice || c.newPrice < 0) continue;
          const pct = p.cartonPrice > 0 ? ((c.newPrice - p.cartonPrice) / p.cartonPrice) * 100 : 0;
          const big = p.cartonPrice > 0 && Math.abs(pct) > PRICE_LIMIT;
          entries.push({ id: uid(), batchId, productId: p.id, oldPrice: p.cartonPrice, newPrice: c.newPrice, pct, note, status: big ? "pending" : "applied", by, at: now });
        }
        const applied = entries.filter((e) => e.status === "applied");
        const pending = entries.filter((e) => e.status === "pending");
        if (!entries.length) return { applied: 0, pending: 0 };
        const names = (es: PriceChange[]) => es.slice(0, 3).map((e) => `${s.products.find((p) => p.id === e.productId)?.name}: ${e.oldPrice.toLocaleString()} → ${e.newPrice.toLocaleString()} (${e.pct > 0 ? "+" : ""}${e.pct.toFixed(1)}%)`).join(" · ") + (es.length > 3 ? ` · +${es.length - 3} more` : "");
        set({
          products: s.products.map((p) => { const e = applied.find((x) => x.productId === p.id); return e ? { ...p, cartonPrice: e.newPrice } : p; }),
          priceHistory: [...entries, ...s.priceHistory],
          approvals: pending.length ? [{
            id: uid(), kind: "price", refId: batchId,
            text: pending.length === 1 ? `Price change: ${s.products.find((p) => p.id === pending[0].productId)?.name}` : `Price update: ${pending.length} products`,
            detail: names(pending), amount: 0, by, at: now, status: "pending",
          }, ...s.approvals] : s.approvals,
          activity: log(s, `${by} changed prices on ${applied.length + pending.length} product${applied.length + pending.length > 1 ? "s" : ""}${pending.length ? ` (${pending.length} sent to owner)` : ""}`),
        });
        return { applied: applied.length, pending: pending.length };
      },
      bulkPrice: (ids, pct, by) => {
        const s = get();
        return get().applyPrices(
          ids.map((id) => ({ productId: id, newPrice: Math.round((s.products.find((p) => p.id === id)?.cartonPrice ?? 0) * (1 + pct / 100)) })),
          by, `Bulk ${pct > 0 ? "+" : ""}${pct}%`
        );
      },
      importProducts: (rows, by) => {
        const s = get();
        let added = 0, updated = 0;
        const priceChanges: { productId: string; newPrice: number }[] = [];
        let products = [...s.products];
        for (const r of rows) {
          const ex = products.find((p) => p.code.toLowerCase() === r.code.toLowerCase());
          if (ex) {
            updated++;
            products = products.map((p) => p.id === ex.id ? {
              ...p, name: r.name || p.name, brand: r.brand || p.brand, supplier: r.supplier || p.supplier,
              packSize: r.packSize || p.packSize, costPrice: r.costPrice ?? p.costPrice, reorder: r.reorder ?? p.reorder,
              leadDays: r.leadDays ?? p.leadDays, bin: r.bin ?? p.bin,
            } : p);
            if (r.cartonPrice !== undefined) priceChanges.push({ productId: ex.id, newPrice: r.cartonPrice });
          } else {
            added++;
            const id = `p${uid()}`;
            products = [{
              id, status: (r.cartonPrice ?? 0) > 0 ? "active" : "unlisted", code: r.code, name: r.name || r.code, brand: r.brand || "", supplier: r.supplier || "",
              packSize: r.packSize || 12, cartonPrice: 0, costPrice: r.costPrice ?? 0, taxPct: 18, stock: 0, batches: [], damaged: 0, reserved: 0,
              reorder: r.reorder ?? 120, leadDays: r.leadDays ?? 5, bin: r.bin ?? "", hue: Math.floor(Math.random() * 360),
            }, ...products];
            if ((r.cartonPrice ?? 0) > 0) priceChanges.push({ productId: id, newPrice: r.cartonPrice! });
          }
        }
        set({ products });
        const res = get().applyPrices(priceChanges, by, "Imported");
        set((st) => ({ activity: log(st, `${by} imported products: ${added} new, ${updated} updated`) }));
        return { added, updated, pending: res.pending };
      },
      upsertCustomer: (c) => set((s) => ({ customers: s.customers.some((x) => x.id === c.id) ? s.customers.map((x) => (x.id === c.id ? c : x)) : [c, ...s.customers] })),
      deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((x) => x.id !== id) })),
      upsertScheme: (sc) => set((s) => ({ schemes: s.schemes.some((x) => x.id === sc.id) ? s.schemes.map((x) => (x.id === sc.id ? sc : x)) : [sc, ...s.schemes] })),
      deleteScheme: (id) => set((s) => ({ schemes: s.schemes.filter((x) => x.id !== id) })),
      setBookerTarget: (id, target) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, target } : u)) })),
    }),
    { name: "zarie-dms-v3", version: 3 }
  )
);

function withShort(l: Line, ordered: number, reason?: string): Line {
  return l.qty < ordered ? { ...l, shortReason: reason || "Not enough on shelf" } : l;
}

function applyDelta(products: Product[], productId: string, delta: number) {
  const ps = cloneP(products);
  const p = ps.find((x) => x.id === productId)!;
  if (delta > 0) {
    const last = [...p.batches].sort((a, b) => b.expiry.localeCompare(a.expiry))[0];
    addBatch(p, last?.no ?? "ADJ", last?.expiry ?? "2027-12", delta);
  } else fefo(p, -delta);
  return ps;
}

export const useUser = () => {
  const id = useStore((s) => s.userId);
  const users = useStore((s) => s.users);
  return users.find((u) => u.id === id) ?? null;
};

export const HOME: Record<Role, string> = {
  admin: "/dashboard",
  sales: "/dashboard",
  warehouse: "/dashboard",
  purchasing: "/dashboard",
  booker: "/m",
  delivery: "/m",
  recovery: "/m",
};
export type { Role };
