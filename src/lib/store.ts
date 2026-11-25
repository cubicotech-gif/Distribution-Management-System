"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CUSTOMERS, ORDERS, PAYMENTS, PRODUCTS, PURCHASES, USERS } from "./seed";
import { orderTotal, pcsOf, totals } from "./calc";
import type {
  Activity, Customer, Line, Order, OrderStatus, Payment, Product, PurchaseOrder, ReturnNote, Role, User,
} from "./types";

const uid = () => Math.random().toString(36).slice(2, 9);

function initialProducts(): Product[] {
  const ps = PRODUCTS.map((p) => ({ ...p }));
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

interface State {
  userId: string | null;
  users: User[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  purchases: PurchaseOrder[];
  payments: Payment[];
  returns: ReturnNote[];
  activity: Activity[];
  seq: number;

  login: (id: string) => void;
  logout: () => void;
  reset: () => void;

  createOrder: (customerId: string, lines: Line[], bookerId: string, note?: string) => string;
  setStatus: (id: string, status: OrderStatus, by: string) => void;
  approveOrder: (id: string, by: string) => { ok: boolean; reason?: string };
  holdOrder: (id: string, by: string) => void;
  updateOrderLines: (id: string, lines: Line[]) => void;
  cancelOrder: (id: string, by: string) => void;
  pickOrder: (id: string, picked: Record<number, number>, by: string) => void;
  invoiceOrder: (id: string, by: string) => void;
  deliverOrder: (id: string, by: string) => void;
  signOrder: (id: string, dataUrl: string) => void;
  fileOrder: (id: string) => void;
  collect: (customerId: string, amount: number, by: string, orderId?: string) => void;
  returnItem: (orderId: string, productId: string, qtyPcs: number, condition: "good" | "damaged", by: string) => void;

  receivePO: (id: string, received: Record<number, number>) => void;
  approvePO: (id: string) => void;
  createPO: (supplier: string, lines: { productId: string; ordered: number }[]) => void;

  upsertProduct: (p: Product) => void;
  deleteProduct: (id: string) => void;
  upsertCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
}

const log = (s: State, text: string): Activity[] =>
  [{ id: uid(), at: Date.now(), text }, ...s.activity].slice(0, 60);

const seedState = () => ({
  users: USERS,
  products: initialProducts(),
  customers: CUSTOMERS.map((c) => ({ ...c })),
  orders: ORDERS.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l })), trail: [...o.trail] })),
  purchases: PURCHASES.map((p) => ({ ...p, lines: p.lines.map((l) => ({ ...l })) })),
  payments: [...PAYMENTS],
  returns: [] as ReturnNote[],
  activity: [] as Activity[],
  seq: 43,
});

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
        const o: Order = {
          id, folio: `SO-${1000 + s.seq}`, customerId, bookerId, lines, status: "booked", createdAt: Date.now(),
          trail: [{ status: "booked", at: Date.now(), by: booker?.initials ?? "—" }], paid: 0, note,
        };
        const c = s.customers.find((x) => x.id === customerId);
        set({
          orders: [o, ...s.orders], seq: s.seq + 1,
          activity: log(s, `${booker?.name ?? "Desk"} booked ${o.folio} for ${c?.name}`),
        });
        return id;
      },

      setStatus: (id, status, by) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id ? { ...o, status, trail: [...o.trail, { status, at: Date.now(), by }] } : o
          ),
        })),

      approveOrder: (id, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o) return { ok: false, reason: "Order not found" };
        // reserve stock (cap at available)
        const products = s.products.map((p) => ({ ...p }));
        for (const l of o.lines) {
          const p = products.find((x) => x.id === l.productId)!;
          const need = pcsOf(l, p);
          const av = p.stock - p.reserved;
          p.reserved += Math.min(need, Math.max(0, av));
        }
        set({
          products,
          orders: s.orders.map((x) =>
            x.id === id ? { ...x, status: "approved", trail: [...x.trail, { status: "approved", at: Date.now(), by }] } : x
          ),
          activity: log(s, `${o.folio} approved by ${by}`),
        });
        return { ok: true };
      },

      updateOrderLines: (id, lines) =>
        set((st) => ({ orders: st.orders.map((o) => (o.id === id ? { ...o, lines } : o)) })),

      holdOrder: (id, by) => {
        get().setStatus(id, "hold", by);
      },
      cancelOrder: (id, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o) return;
        const products = s.products.map((p) => ({ ...p }));
        if (o.status === "approved") {
          for (const l of o.lines) {
            const p = products.find((x) => x.id === l.productId)!;
            p.reserved = Math.max(0, p.reserved - pcsOf(l, p));
          }
        }
        set({ products });
        get().setStatus(id, "cancelled", by);
      },

      pickOrder: (id, picked, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o) return;
        const products = s.products.map((p) => ({ ...p }));
        const lines = o.lines.map((l, i) => {
          const p = products.find((x) => x.id === l.productId)!;
          const pq = Math.max(0, Math.min(picked[i] ?? l.qty, l.qty));
          const orderedPcs = pcsOf(l, p);
          const pickedPcs = pcsOf({ ...l, qty: pq }, p);
          p.reserved = Math.max(0, p.reserved - orderedPcs);
          p.stock = Math.max(0, p.stock - pickedPcs);
          return { ...l, pickedQty: pq, qty: pq };
        }).filter((l) => l.qty > 0);
        const challanNo = `DC-${2000 + Number(o.folio.slice(3)) - 1000}`;
        set({
          products,
          orders: s.orders.map((x) =>
            x.id === id ? { ...x, lines, challanNo, status: "picked", trail: [...x.trail, { status: "picked", at: Date.now(), by }] } : x
          ),
          activity: log(s, `${challanNo} created for ${o.folio} by ${by}`),
        });
      },

      invoiceOrder: (id, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === id);
        if (!o) return;
        const invoiceNo = `INV-${3000 + Number(o.folio.slice(3)) - 1000}`;
        const total = totals(o.lines).total;
        const c = s.customers.find((x) => x.id === o.customerId)!;
        set({
          customers: s.customers.map((x) =>
            x.id === c.id && c.type === "credit" ? { ...x, balance: x.balance + total } : x
          ),
          orders: s.orders.map((x) =>
            x.id === id
              ? { ...x, invoiceNo, status: "invoiced", deliveryBoyId: "u-d1", trail: [...x.trail, { status: "invoiced", at: Date.now(), by }] }
              : x
          ),
          activity: log(s, `${invoiceNo} issued for ${o.folio} (${total.toFixed(0)})`),
        });
      },

      deliverOrder: (id, by) => {
        get().setStatus(id, "delivered", by);
        const s = get();
        const o = s.orders.find((x) => x.id === id)!;
        set({ activity: log(s, `${o.folio} delivered and signed`) });
      },

      signOrder: (id, dataUrl) =>
        set((st) => ({ orders: st.orders.map((o) => (o.id === id ? { ...o, signature: dataUrl } : o)) })),

      fileOrder: (id) =>
        set((st) => ({ orders: st.orders.map((o) => (o.id === id ? { ...o, filed: true } : o)) })),

      collect: (customerId, amount, by, orderId) => {
        const s = get();
        if (amount <= 0) return;
        const c = s.customers.find((x) => x.id === customerId);
        if (!c) return;
        const pay: Payment = { id: uid(), customerId, orderId, amount, at: Date.now(), by };
        let orders = s.orders;
        let customers = s.customers;
        const isCash = c.type === "cash";
        if (orderId) {
          orders = orders.map((o) => {
            if (o.id !== orderId) return o;
            const paid = o.paid + amount;
            const full = paid >= Math.round(orderTotal(o)) - 1;
            return {
              ...o, paid,
              status: full && (o.status === "delivered" || o.status === "invoiced") ? "paid" : o.status,
              trail: full && o.status === "delivered" ? [...o.trail, { status: "paid" as const, at: Date.now(), by }] : o.trail,
            };
          });
        }
        if (!isCash) {
          customers = customers.map((x) =>
            x.id === customerId ? { ...x, balance: Math.max(0, x.balance - amount), oldestDue: Math.max(0, x.balance - amount) === 0 ? 0 : x.oldestDue } : x
          );
        }
        set({
          payments: [pay, ...s.payments], orders, customers,
          activity: log(s, `Rs. ${Math.round(amount).toLocaleString()} collected from ${c.name}`),
        });
      },

      returnItem: (orderId, productId, qtyPcs, condition, by) => {
        const s = get();
        const o = s.orders.find((x) => x.id === orderId);
        if (!o) return;
        const l = o.lines.find((x) => x.productId === productId);
        const p = s.products.find((x) => x.id === productId);
        if (!l || !p) return;
        const perPcs = (l.unit === "ctn" ? l.rate / p.packSize : l.rate) * (1 - l.discPct / 100) * 1.18;
        const value = Math.round(perPcs * qtyPcs);
        const note: ReturnNote = {
          id: uid(), folio: `CN-${5000 + s.returns.length + 1}`, orderId, customerId: o.customerId, productId, qtyPcs,
          condition, value, at: Date.now(),
        };
        set({
          returns: [note, ...s.returns],
          products: s.products.map((x) => (x.id === productId && condition === "good" ? { ...x, stock: x.stock + qtyPcs } : x)),
          customers: s.customers.map((c) => (c.id === o.customerId && c.type === "credit" ? { ...c, balance: Math.max(0, c.balance - value) } : c)),
          orders: s.orders.map((x) => (x.id === orderId ? { ...x, returned: (x.returned ?? 0) + value } : x)),
          activity: log(s, `${note.folio}: ${qtyPcs} pcs of ${p.name} returned (${condition}) by ${by}`),
        });
      },

      receivePO: (id, received) =>
        set((s) => ({
          purchases: s.purchases.map((po) =>
            po.id === id
              ? { ...po, status: "received", lines: po.lines.map((l, i) => ({ ...l, received: received[i] ?? l.ordered })) }
              : po
          ),
          activity: log(s, `Warehouse counted goods for ${s.purchases.find((p) => p.id === id)?.folio}`),
        })),

      approvePO: (id) => {
        const s = get();
        const po = s.purchases.find((x) => x.id === id);
        if (!po) return;
        const products = s.products.map((p) => {
          const l = po.lines.find((x) => x.productId === p.id);
          return l ? { ...p, stock: p.stock + (l.received ?? 0) * p.packSize } : p;
        });
        set({
          products,
          purchases: s.purchases.map((x) => (x.id === id ? { ...x, status: "approved" } : x)),
          activity: log(s, `${po.folio} approved. Stock is now available to bookers`),
        });
      },

      createPO: (supplier, lines) => {
        const s = get();
        set({
          purchases: [
            { id: `po${uid()}`, folio: `PO-${7012 + s.purchases.length - 2}`, supplier, lines, status: "ordered", createdAt: Date.now() },
            ...s.purchases,
          ],
        });
      },

      upsertProduct: (p) =>
        set((s) => ({
          products: s.products.some((x) => x.id === p.id) ? s.products.map((x) => (x.id === p.id ? p : x)) : [p, ...s.products],
        })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((x) => x.id !== id) })),
      upsertCustomer: (c) =>
        set((s) => ({
          customers: s.customers.some((x) => x.id === c.id) ? s.customers.map((x) => (x.id === c.id ? c : x)) : [c, ...s.customers],
        })),
      deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((x) => x.id !== id) })),
    }),
    {
      name: "zarie-dms-v1",
      version: 1,
    }
  )
);

export const useUser = () => {
  const id = useStore((s) => s.userId);
  const users = useStore((s) => s.users);
  return users.find((u) => u.id === id) ?? null;
};

export const HOME: Record<Role, string> = {
  admin: "/dashboard",
  sales: "/orders",
  warehouse: "/pick",
  purchasing: "/receiving",
  booker: "/m",
  delivery: "/m",
  recovery: "/m",
};
export type { Role };
