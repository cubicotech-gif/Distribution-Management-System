"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BINS, CUSTOMERS, GRNS, ORDERS, PAYMENTS, PRICE_LISTS, PRODUCTS, PURCHASES, RETURNS, ROUTES, SCHEMES, SUPPLIERS, TRIPS, USERS } from "./seed";
import { accepted, good, receivedSoFar } from "./grn";
import { DOCK, HOLD, binUsed } from "./locations";
import { applySchemes, orderDue, orderTotal, pcsOf, totals, unpaidOrders } from "./calc";
import type {
  Activity, Allocation, Approval, Customer, Line, Order, OrderStatus, Payment, Product, PurchaseOrder,
  Bin, ChangeEntry, Grn, GrnLine, PriceChange, PriceList, ProductStatus, ReturnNote, ReturnReason, Role, Route, Scheme, StockAdj, StockMove, Supplier, SupplierReturn, Trip, User,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);
export const MAX_DISCOUNT = 5; // % above which the owner must approve
export const PRICE_LIMIT = 10; // % price change above which the owner must approve
export const ADJ_LIMIT = 20000; // Rs. stock-count variance above which the owner must approve

const cloneP = (ps: Product[]) => ps.map((p) => ({ ...p, batches: p.batches.map((b) => ({ ...b })) }));

/** Take pcs from the earliest-expiry batches first. Mutates the (cloned) product. */
function fefo(p: Product, pcs: number): { batch: string; expiry: string; pcs: number; bin: string }[] {
  const out: { batch: string; expiry: string; pcs: number; bin: string }[] = [];
  let need = pcs;
  for (const b of [...p.batches].sort((a, b) => a.expiry.localeCompare(b.expiry))) {
    if (need <= 0) break;
    const take = Math.min(b.qty, need);
    if (take > 0) { b.qty -= take; need -= take; out.push({ batch: b.no, expiry: b.expiry, pcs: take, bin: b.bin }); }
  }
  p.batches = p.batches.filter((b) => b.qty > 0);
  p.stock = p.batches.reduce((s, b) => s + b.qty, 0);
  return out;
}
function addBatch(p: Product, no: string, expiry: string, pcs: number, bin: string = DOCK) {
  const ex = p.batches.find((b) => b.no === no && b.bin === bin);
  if (ex) ex.qty += pcs; else p.batches.push({ id: uid(), no, expiry, qty: pcs, bin });
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
  grns: GRNS.map((g) => ({ ...g, lines: g.lines.map((l) => ({ ...l })) })) as Grn[],
  payments: [...PAYMENTS] as Payment[],
  returns: RETURNS.map((r) => ({ ...r })) as ReturnNote[],
  trips: TRIPS.map((t) => ({ ...t })) as Trip[],
  schemes: SCHEMES.map((s) => ({ ...s })) as Scheme[],
  supplierReturns: [] as SupplierReturn[],
  adjustments: [] as StockAdj[],
  approvals: [] as Approval[],
  priceHistory: [] as PriceChange[],
  routes: ROUTES.map((r) => ({ ...r })) as Route[],
  priceLists: PRICE_LISTS.map((l) => ({ ...l, overrides: { ...l.overrides } })) as PriceList[],
  suppliers: SUPPLIERS.map((x) => ({ ...x })) as Supplier[],
  bins: BINS.map((b) => ({ ...b })) as Bin[],
  moves: [] as StockMove[],
  changeLog: [] as ChangeEntry[],
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
  grns: Grn[];
  payments: Payment[];
  returns: ReturnNote[];
  trips: Trip[];
  schemes: Scheme[];
  supplierReturns: SupplierReturn[];
  adjustments: StockAdj[];
  approvals: Approval[];
  priceHistory: PriceChange[];
  routes: Route[];
  priceLists: PriceList[];
  suppliers: Supplier[];
  bins: Bin[];
  moves: StockMove[];
  changeLog: ChangeEntry[];
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
  restoreOrder: (id: string, status: OrderStatus, by: string) => void;
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
  createPO: (supplier: string, lines: { productId: string; ordered: number }[], newItems?: NewItem[], expectedAt?: number) => void;
  registerArrival: (poId: string, info: { deliveryNote: string; vehicle: string; driver: string }, by: string) => string;
  updateGrnLine: (grnId: string, idx: number, patch: Partial<GrnLine>) => void;
  fillGrnExpected: (grnId: string) => void;
  submitGrn: (grnId: string, by: string) => void;
  sendBackGrn: (grnId: string, note: string) => void;
  approveGrn: (grnId: string, by: string) => void;
  closePoShort: (poId: string, note: string) => void;
  releaseQuarantine: (productId: string, batchId: string, action: "release" | "reject", by: string) => void;
  scanGrn: (grnId: string, code: string) => { ok: boolean; name?: string };
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
  deleteCustomer: (id: string) => boolean;
  setCustomerStatus: (ids: string[], status: "active" | "blocked", reason?: string) => void;
  moveCustomers: (ids: string[], routeName: string) => void;
  upsertRoute: (r: Route) => void;
  deleteRoute: (id: string) => boolean;
  upsertPriceList: (l: PriceList) => void;
  deletePriceList: (id: string) => boolean;
  moveStock: (o: { productId: string; batch: string; from: string; to: string; qtyPcs: number; kind: "putaway" | "transfer"; reason: string; by: string; force?: boolean }) => { ok: boolean; reason?: string };
  upsertBin: (b: Bin) => void;
  setBinBlocked: (code: string, blocked: boolean, note?: string) => void;
  deleteBin: (code: string) => boolean;
  upsertSupplier: (x: Supplier) => void;
  deleteSupplier: (id: string) => boolean;
  upsertScheme: (s: Scheme) => void;
  deleteScheme: (id: string) => void;
  setBookerTarget: (id: string, target: number) => void;
}

export interface NewItem { name: string; brand: string; packSize: number; costPrice: number; ordered: number }
export interface ImportRow { code: string; name?: string; brand?: string; supplier?: string; packSize?: number; cartonPrice?: number; costPrice?: number; reorder?: number; leadDays?: number; bin?: string }

const log = (s: State, text: string): Activity[] => [{ id: uid(), at: Date.now(), text }, ...s.activity].slice(0, 80);
const aud = (s: State, entity: ChangeEntry["entity"], text: string): ChangeEntry[] => [
  { id: uid(), at: Date.now(), by: s.users.find((u) => u.id === s.userId)?.initials ?? "—", entity, text }, ...s.changeLog,
].slice(0, 300);
const stamp = (o: Order, status: OrderStatus, by: string) => [...o.trail, { status, at: Date.now(), by }];

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      userId: typeof window !== "undefined" ? (() => { try { return sessionStorage.getItem("dms-user"); } catch { return null; } })() : null,
      ...seedState(),

      login: (id) => { try { sessionStorage.setItem("dms-user", id); } catch {} set({ userId: id }); },
      logout: () => { try { sessionStorage.removeItem("dms-user"); } catch {} set({ userId: null }); },
      reset: () => set({ ...seedState() }),

      createOrder: (customerId, lines, bookerId, note) => {
        const s = get();
        const booker = s.users.find((u) => u.id === bookerId);
        const id = `o${s.seq}`;
        const cust = s.customers.find((x) => x.id === customerId);
        if (cust?.status === "blocked") return "";
        const priced = applySchemes(s.schemes, lines, cust?.route);
        const o: Order = {
          id, folio: `SO-${1000 + s.seq}`, customerId, bookerId, lines: priced, status: "booked", createdAt: Date.now(),
          trail: [{ status: "booked", at: Date.now(), by: booker?.initials ?? "—" }], paid: 0, note,
        };
        const c = s.customers.find((x) => x.id === customerId);
        set({ orders: [o, ...s.orders], seq: s.seq + 1, activity: log(s, `${booker?.name ?? "Desk"} booked ${o.folio} for ${c?.name}`) });
        return id;
      },

      updateOrderLines: (id, lines) =>
        set((st) => {
          const o = st.orders.find((x) => x.id === id);
          if (!o) return {};
          const c = st.customers.find((x) => x.id === o.customerId);
          const old = o.lines.filter((l) => !l.isFree);
          const forced = new Set<number>();
          const prepared = lines.filter((l) => !l.isFree).map((l, i) => {
            if (old[i] && old[i].qty === l.qty && old[i].unit === l.unit && !l.manualDisc) { forced.add(i); return { ...l, manualDisc: true }; }
            return l;
          });
          const res = applySchemes(st.schemes, prepared, c?.route).map((l, i) => (forced.has(i) && !l.isFree ? { ...l, manualDisc: undefined } : l));
          return { orders: st.orders.map((x) => (x.id === id ? { ...x, lines: res } : x)) };
        }),

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

      restoreOrder: (id, status, by) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status, needsOwner: undefined, trail: stamp(o, status, by) } : o)) })),

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

      createPO: (supplier, lines, newItems = [], expectedAt) => {
        const s = get();
        const created: Product[] = newItems.map((n, i) => ({
          id: `p${uid()}`, status: "unlisted", category: "General", barcode: "", code: `NEW-${s.products.length + i + 1}`, name: n.name, brand: n.brand || supplier.split(" ")[0],
          supplier, packSize: n.packSize, cartonPrice: 0, costPrice: n.costPrice, taxPct: 18, stock: 0, batches: [], damaged: 0, quarantine: [], reserved: 0,
          reorder: n.packSize * 5, leadDays: 5, bin: "", hue: Math.floor(Math.random() * 360),
        }));
        const all = [...lines, ...created.map((p, i) => ({ productId: p.id, ordered: newItems[i].ordered }))];
        const lead = s.suppliers.find((x) => x.name === supplier)?.leadDays ?? 5;
        set({
          products: [...created, ...s.products],
          purchases: [{ id: `po${uid()}`, folio: `PO-${7013 + s.purchases.length - 3}`, supplier, lines: all, status: "ordered", createdAt: Date.now(), expectedAt: expectedAt ?? Date.now() + lead * 86400000 }, ...s.purchases],
          activity: log(s, `Purchase order sent to ${supplier}${created.length ? ` (${created.length} new item${created.length > 1 ? "s" : ""} to be listed)` : ""}`),
        });
      },

      registerArrival: (poId, info, by) => {
        const s = get();
        const po = s.purchases.find((x) => x.id === poId);
        if (!po) return "";
        const id = `g${uid()}`;
        const g: Grn = {
          id, folio: `GRN-${9001 + s.grns.length}`, poId, supplier: po.supplier, ...info, status: "counting", arrivedAt: Date.now(), by,
          lines: po.lines.filter((l) => l.ordered - receivedSoFar(po, s.grns, l.productId, true) > 0).map((l) => ({ productId: l.productId, arrived: 0, rejected: 0, damaged: 0, held: 0, batch: "", expiry: "", reason: "" })),
        };
        set({ grns: [g, ...s.grns], activity: log(s, `${po.supplier} truck ${info.vehicle || ""} arrived (${g.folio}). Count started by ${by}`) });
        return id;
      },
      updateGrnLine: (grnId, idx, patch) => set((s) => ({ grns: s.grns.map((g) => (g.id === grnId ? { ...g, lines: g.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) } : g)) })),
      fillGrnExpected: (grnId) => {
        const s = get();
        const g = s.grns.find((x) => x.id === grnId);
        const po = g && s.purchases.find((p) => p.id === g.poId);
        if (!g || !po) return;
        set({ grns: s.grns.map((x) => (x.id === grnId ? { ...x, lines: x.lines.map((l) => ({ ...l, arrived: Math.max(l.arrived, po.lines.find((p) => p.productId === l.productId)!.ordered - receivedSoFar(po, s.grns.filter((y) => y.id !== grnId), l.productId, true)) })) } : x)) });
      },
      scanGrn: (grnId, code) => {
        const s = get();
        const g = s.grns.find((x) => x.id === grnId);
        const c = code.trim().toLowerCase();
        const p = s.products.find((x) => x.code.toLowerCase() === c || (x.barcode && x.barcode === c));
        if (!g || !p) return { ok: false };
        const i = g.lines.findIndex((l) => l.productId === p.id);
        if (i < 0) return { ok: false, name: p.name };
        get().updateGrnLine(grnId, i, { arrived: g.lines[i].arrived + 1 });
        return { ok: true, name: p.name };
      },
      submitGrn: (grnId, by) => {
        const s = get();
        const g = s.grns.find((x) => x.id === grnId);
        if (!g) return;
        set({ grns: s.grns.map((x) => (x.id === grnId ? { ...x, status: "counted", countedAt: Date.now(), by, sentBack: undefined } : x)), activity: log(s, `${g.folio} counted by ${by}. Waiting for purchasing to approve`) });
      },
      sendBackGrn: (grnId, note) => {
        const s = get();
        const g = s.grns.find((x) => x.id === grnId);
        if (!g) return;
        set({ grns: s.grns.map((x) => (x.id === grnId ? { ...x, status: "counting", sentBack: note } : x)), activity: log(s, `${g.folio} sent back to the warehouse for a recount: ${note}`) });
      },
      approveGrn: (grnId, by) => {
        const s = get();
        const g = s.grns.find((x) => x.id === grnId);
        if (!g || g.status !== "counted") return;
        const products = cloneP(s.products);
        for (const l of g.lines) {
          const p = products.find((x) => x.id === l.productId);
          if (!p) continue;
          const gd = good(l) * p.packSize;
          if (gd > 0) addBatch(p, l.batch.trim(), l.expiry, gd);
          p.damaged += l.damaged * p.packSize;
          if (l.held > 0) p.quarantine.push({ id: uid(), no: l.batch.trim() || "HOLD", expiry: l.expiry || "2027-12", qty: l.held * p.packSize, bin: HOLD });
        }
        const grns = s.grns.map((x) => (x.id === grnId ? { ...x, status: "approved" as const, approvedAt: Date.now() } : x));
        const po = s.purchases.find((x) => x.id === g.poId)!;
        const done = po.lines.every((l) => receivedSoFar(po, grns, l.productId) >= l.ordered);
        set({
          products, grns,
          purchases: s.purchases.map((x) => (x.id === po.id ? { ...x, status: done ? "complete" : "partial" } : x)),
          activity: log(s, `${g.folio} approved by ${by}. Good stock is live for bookers${done ? "" : ` (${po.folio} still has cartons to come)`}`),
        });
      },
      closePoShort: (poId, note) => {
        const s = get();
        const po = s.purchases.find((x) => x.id === poId);
        set({ purchases: s.purchases.map((x) => (x.id === poId ? { ...x, status: "closed", closedNote: note } : x)), activity: log(s, `${po?.folio} closed short: ${note}`) });
      },
      releaseQuarantine: (productId, batchId, action, by) => {
        const s = get();
        const products = cloneP(s.products);
        const p = products.find((x) => x.id === productId);
        const q = p?.quarantine.find((x) => x.id === batchId);
        if (!p || !q) return;
        p.quarantine = p.quarantine.filter((x) => x.id !== batchId);
        if (action === "release") addBatch(p, q.no, q.expiry, q.qty); else p.damaged += q.qty;
        set({ products, activity: log(s, `${by} ${action === "release" ? "released" : "rejected"} ${Math.round(q.qty / p.packSize * 10) / 10} ctn of ${p.name} (batch ${q.no}) from quality hold`) });
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
          set({ products: [{ ...p, cartonPrice: 0 }, ...s.products], changeLog: aud(s, "product", `Added product ${p.name} (${p.code})`) });
          if (p.cartonPrice > 0) get().applyPrices([{ productId: p.id, newPrice: p.cartonPrice }], by, "Listed");
          return;
        }
        const { cartonPrice: newPrice, ...rest } = p;
        set({ products: s.products.map((x) => (x.id === p.id ? { ...x, ...rest, batches: x.batches, stock: x.stock, damaged: x.damaged, reserved: x.reserved } : x)), changeLog: aud(s, "product", `Edited ${p.name}`) });
        if (newPrice !== old.cartonPrice) get().applyPrices([{ productId: p.id, newPrice }], by, old.cartonPrice === 0 ? "Listed" : "Edited");
      },
      setProductStatus: (id, status) => set((s) => ({ products: s.products.map((x) => (x.id === id ? { ...x, status } : x)), changeLog: aud(s, "product", `${s.products.find((x) => x.id === id)?.name} set to ${status}`) })),
      deleteProduct: (id) => {
        const s = get();
        const p = s.products.find((x) => x.id === id);
        const used = !!p && (p.stock > 0 || p.damaged > 0 || s.orders.some((o) => o.lines.some((l) => l.productId === id)) || s.purchases.some((o) => o.lines.some((l) => l.productId === id)));
        if (!p || used) return false;
        set({ products: s.products.filter((x) => x.id !== id), schemes: s.schemes.filter((x) => x.productId !== id), changeLog: aud(s, "product", `Deleted product ${p.name}`) });
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
              id, status: (r.cartonPrice ?? 0) > 0 ? "active" : "unlisted", category: "General", barcode: "", code: r.code, name: r.name || r.code, brand: r.brand || "", supplier: r.supplier || "",
              packSize: r.packSize || 12, cartonPrice: 0, costPrice: r.costPrice ?? 0, taxPct: 18, stock: 0, batches: [], damaged: 0, quarantine: [], reserved: 0,
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
      upsertCustomer: (c) =>
        set((s) => {
          const rt = s.routes.find((r) => r.name === c.route);
          const n = { ...c, bookerId: rt?.bookerId ?? c.bookerId };
          const exists = s.customers.some((x) => x.id === c.id);
          return {
            customers: exists ? s.customers.map((x) => (x.id === c.id ? n : x)) : [n, ...s.customers],
            changeLog: aud(s, "customer", `${exists ? "Edited" : "Added"} customer ${c.name}`),
          };
        }),
      deleteCustomer: (id) => {
        const s = get();
        const c = s.customers.find((x) => x.id === id);
        if (!c || c.balance > 0 || s.orders.some((o) => o.customerId === id)) return false;
        set({ customers: s.customers.filter((x) => x.id !== id), changeLog: aud(s, "customer", `Deleted customer ${c.name}`) });
        return true;
      },
      setCustomerStatus: (ids, status, reason) =>
        set((s) => ({
          customers: s.customers.map((c) => (ids.includes(c.id) ? { ...c, status, blockedReason: status === "blocked" ? reason || "Blocked by back office" : undefined } : c)),
          changeLog: aud(s, "customer", `${status === "blocked" ? "Blocked" : "Unblocked"} ${ids.length} customer${ids.length > 1 ? "s" : ""}${reason ? ` (${reason})` : ""}`),
        })),
      moveCustomers: (ids, routeName) =>
        set((s) => {
          const rt = s.routes.find((r) => r.name === routeName);
          if (!rt) return {};
          return {
            customers: s.customers.map((c) => (ids.includes(c.id) ? { ...c, route: rt.name, bookerId: rt.bookerId } : c)),
            changeLog: aud(s, "route", `Moved ${ids.length} customer${ids.length > 1 ? "s" : ""} to ${rt.name}`),
          };
        }),
      upsertRoute: (r) =>
        set((s) => {
          const old = s.routes.find((x) => x.id === r.id);
          const customers = s.customers.map((c) => (c.route === (old?.name ?? r.name) ? { ...c, route: r.name, bookerId: r.bookerId } : c));
          return {
            routes: old ? s.routes.map((x) => (x.id === r.id ? r : x)) : [...s.routes, r],
            customers,
            changeLog: aud(s, "route", `${old ? "Edited" : "Added"} route ${r.name}`),
          };
        }),
      deleteRoute: (id) => {
        const s = get();
        const r = s.routes.find((x) => x.id === id);
        if (!r || s.customers.some((c) => c.route === r.name)) return false;
        set({ routes: s.routes.filter((x) => x.id !== id), changeLog: aud(s, "route", `Deleted route ${r.name}`) });
        return true;
      },
      upsertPriceList: (l) =>
        set((s) => ({
          priceLists: s.priceLists.some((x) => x.id === l.id) ? s.priceLists.map((x) => (x.id === l.id ? l : x)) : [...s.priceLists, l],
          changeLog: aud(s, "price list", `Saved price list ${l.name} (${l.adjustPct > 0 ? "+" : ""}${l.adjustPct}%, ${Object.keys(l.overrides).length} overrides)`),
        })),
      deletePriceList: (id) => {
        const s = get();
        const l = s.priceLists.find((x) => x.id === id);
        if (!l || id === "pl1" || s.customers.some((c) => c.priceListId === id)) return false;
        set({ priceLists: s.priceLists.filter((x) => x.id !== id), changeLog: aud(s, "price list", `Deleted price list ${l.name}`) });
        return true;
      },
      moveStock: ({ productId, batch, from, to, qtyPcs, kind, reason, by, force }) => {
        const s = get();
        const dest = s.bins.find((b) => b.code === to);
        const src = s.products.find((x) => x.id === productId);
        if (!dest || !src) return { ok: false, reason: "Bin not found" };
        if (from === to) return { ok: false, reason: "Choose a different bin" };
        if (dest.blocked) return { ok: false, reason: `${to} is blocked` };
        if (dest.zone === "R") return { ok: false, reason: "The dock is for arrivals only" };
        const row = src.batches.find((b) => b.no === batch && b.bin === from);
        if (!row || row.qty < qtyPcs || qtyPcs <= 0) return { ok: false, reason: "Not enough stock in the source bin" };
        const free = dest.capacity - binUsed(s.products, to);
        if (qtyPcs / src.packSize > free + 0.001 && !force) return { ok: false, reason: `${to} only has room for ${Math.floor(free)} more cartons` };
        const products = cloneP(s.products);
        const p = products.find((x) => x.id === productId)!;
        const r = p.batches.find((b) => b.no === batch && b.bin === from)!;
        r.qty -= qtyPcs;
        p.batches = p.batches.filter((b) => b.qty > 0);
        addBatch(p, batch, r.expiry, qtyPcs, to);
        const mv: StockMove = { id: uid(), at: Date.now(), by, kind, productId, batch, qty: qtyPcs, from, to, reason };
        set({
          products, moves: [mv, ...s.moves].slice(0, 400),
          activity: log(s, `${by} ${kind === "putaway" ? "put away" : "moved"} ${Math.round((qtyPcs / src.packSize) * 10) / 10} ctn of ${src.name} (${batch}) ${from} → ${to}`),
        });
        return { ok: true };
      },
      upsertBin: (b) =>
        set((s) => {
          const exists = s.bins.some((x) => x.code === b.code);
          return { bins: exists ? s.bins.map((x) => (x.code === b.code ? b : x)) : [...s.bins, b], changeLog: aud(s, "bin", `${exists ? "Edited" : "Added"} bin ${b.code} (capacity ${b.capacity} ctn)`) };
        }),
      setBinBlocked: (code, blocked, note) =>
        set((s) => ({ bins: s.bins.map((b) => (b.code === code ? { ...b, blocked, note: blocked ? note : b.note } : b)), changeLog: aud(s, "bin", `${blocked ? "Blocked" : "Unblocked"} bin ${code}${note ? ` (${note})` : ""}`) })),
      deleteBin: (code) => {
        const s = get();
        if (code === DOCK || code === HOLD || binUsed(s.products, code) > 0) return false;
        set({ bins: s.bins.filter((b) => b.code !== code), changeLog: aud(s, "bin", `Deleted bin ${code}`) });
        return true;
      },
      upsertSupplier: (x) =>
        set((s) => {
          const old = s.suppliers.find((y) => y.id === x.id);
          return {
            suppliers: old ? s.suppliers.map((y) => (y.id === x.id ? x : y)) : [...s.suppliers, x],
            products: s.products.map((p) => (p.supplier === (old?.name ?? x.name) ? { ...p, supplier: x.name, leadDays: x.leadDays } : p)),
            changeLog: aud(s, "supplier", `${old ? "Edited" : "Added"} supplier ${x.name}`),
          };
        }),
      deleteSupplier: (id) => {
        const s = get();
        const x = s.suppliers.find((y) => y.id === id);
        if (!x || s.products.some((p) => p.supplier === x.name)) return false;
        set({ suppliers: s.suppliers.filter((y) => y.id !== id), changeLog: aud(s, "supplier", `Deleted supplier ${x.name}`) });
        return true;
      },
      upsertScheme: (sc) =>
        set((s) => ({
          schemes: s.schemes.some((x) => x.id === sc.id) ? s.schemes.map((x) => (x.id === sc.id ? sc : x)) : [sc, ...s.schemes],
          changeLog: aud(s, "scheme", `Saved scheme on ${s.products.find((p) => p.id === sc.productId)?.name}`),
        })),
      deleteScheme: (id) => set((s) => ({ schemes: s.schemes.filter((x) => x.id !== id), changeLog: aud(s, "scheme", "Deleted a scheme") })),
      setBookerTarget: (id, target) => set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, target } : u)) })),
    }),
    {
      name: "zarie-dms-v7",
      version: 7,
      // The signed-in user belongs to this tab only; the business data is shared by every tab.
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== "userId")) as unknown as State,
    }
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
    addBatch(p, last?.no ?? "ADJ", last?.expiry ?? "2027-12", delta, last?.bin ?? DOCK);
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

// Keep open tabs in step: when another tab changes the data, pick it up straight away.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "zarie-dms-v7") useStore.persist.rehydrate();
  });
}
