import type { Customer, Order, Payment, Product, PurchaseOrder, User, Line, OrderStatus, Stamp } from "./types";

export const USERS: User[] = [
  { id: "u-admin", name: "Zarie Khan", initials: "ZK", role: "admin", title: "Owner / Admin" },
  { id: "u-sales", name: "Kamran Hussain", initials: "KH", role: "sales", title: "Sales Desk" },
  { id: "u-wh", name: "Imran Ali", initials: "IA", role: "warehouse", title: "Warehouse" },
  { id: "u-pur", name: "Saima Noor", initials: "SN", role: "purchasing", title: "Purchasing" },
  { id: "u-b1", name: "Muhammad Sabir", initials: "MS", role: "booker", title: "Booker" },
  { id: "u-b2", name: "Zeeshan Ahmed", initials: "ZA", role: "booker", title: "Booker" },
  { id: "u-b3", name: "Usman Tariq", initials: "UT", role: "booker", title: "Booker" },
  { id: "u-d1", name: "Bilal Raza", initials: "BR", role: "delivery", title: "Delivery" },
  { id: "u-r1", name: "Farhan Malik", initials: "FM", role: "recovery", title: "Recovery (KE)" },
];

const P = (
  id: string, code: string, name: string, brand: string, packSize: number, cartonPrice: number,
  stockCtn: number, reservedCtn: number, reorderCtn: number, hue: number, expiry?: string
): Product => ({
  id, code, name, brand, packSize, cartonPrice, taxPct: 18,
  stock: stockCtn * packSize, reserved: reservedCtn * packSize, reorder: reorderCtn * packSize, hue, expiry,
});

export const PRODUCTS: Product[] = [
  P("p1", "SE-01", "Surf Excel 1kg", "Unilever", 12, 8500, 42, 0, 20, 215, "2027-06"),
  P("p2", "LX-04", "Lux Soap 100g", "Unilever", 72, 5200, 140, 0, 40, 330, "2028-01"),
  P("p3", "VM-02", "Vim Bar Regular 100g", "Unilever", 48, 4200, 12, 0, 15, 140, "2027-09"),
  P("p4", "TD-19", "Tapal Danedar 190g", "Tapal", 24, 5600, 15, 0, 10, 8, "2027-03"),
  P("p5", "LP-05", "Lipton Yellow Label 200g", "Unilever", 24, 6800, 2, 0, 10, 48, "2027-02"),
  P("p6", "DL-55", "Dalda Cooking Oil 5L", "Dalda", 4, 9200, 18, 0, 8, 95, "2027-05"),
  P("p7", "NM-10", "Nestle Milkpak 1L", "Nestle", 12, 3300, 60, 0, 30, 205, "2026-12"),
  P("p8", "CL-07", "Colgate Strong Teeth 100g", "Colgate", 48, 7400, 25, 0, 12, 0, "2028-03"),
  P("p9", "SH-03", "Sunsilk Shampoo 200ml", "Unilever", 24, 6100, 30, 0, 12, 290, "2028-02"),
  P("p10", "RF-08", "Rafhan Corn Oil 3L", "Rafhan", 6, 7900, 9, 0, 10, 45, "2027-04"),
  P("p11", "ML-12", "Meezan Biscuits Family", "Meezan", 36, 3900, 70, 0, 20, 25, "2026-12"),
  P("p12", "SG-14", "Shield Dish Wash 500ml", "Shield", 12, 4800, 22, 0, 8, 160, "2027-08"),
];

const C = (
  id: string, name: string, area: string, route: string, bookerId: string, type: "credit" | "cash",
  creditLimit: number, creditDays: number, balance: number, oldestDue: number, phone: string
): Customer => ({ id, name, area, route, bookerId, type, creditLimit, creditDays, balance, oldestDue, phone });

export const CUSTOMERS: Customer[] = [
  C("c1", "Ali General Store", "Anarkali", "Anarkali #4", "u-b1", "credit", 250000, 15, 184000, 12, "0300-4455120"),
  C("c2", "Al-Karam Traders", "Anarkali", "Anarkali #4", "u-b1", "credit", 300000, 21, 45200, 6, "0321-7788123"),
  C("c3", "Madina Provision Store", "Anarkali", "Anarkali #4", "u-b1", "credit", 200000, 15, 141800, 34, "0333-1209844"),
  C("c4", "Bismillah Karyana Store", "Mozang", "Mozang #2", "u-b2", "credit", 120000, 10, 29400, 4, "0345-2200981"),
  C("c5", "Ghazi Provision Store", "Mozang", "Mozang #2", "u-b2", "credit", 150000, 15, 112000, 18, "0300-9087761"),
  C("c6", "Bilal & Sons", "Mozang", "Mozang #2", "u-b2", "credit", 180000, 15, 68900, 9, "0322-5543210"),
  C("c7", "Noor Mart", "Gulberg", "Gulberg #1", "u-b3", "credit", 400000, 30, 212000, 22, "0301-6677889"),
  C("c8", "Fresh Corner", "Gulberg", "Gulberg #1", "u-b3", "cash", 0, 0, 0, 0, "0333-4412090"),
  C("c9", "Hamza Super Store", "Model Town", "Model Town #3", "u-b3", "credit", 220000, 15, 96500, 11, "0312-8800761"),
  C("c10", "City Kiryana", "Model Town", "Model Town #3", "u-b1", "cash", 0, 0, 0, 0, "0345-1122334"),
];

const h = 3600_000;
const now = Date.now();

function mk(
  n: number, customerId: string, bookerId: string, lines: Line[], status: OrderStatus, ageH: number,
  extra: Partial<Order> = {}
): Order {
  const flow: OrderStatus[] = ["booked", "approved", "picked", "invoiced", "delivered", "paid"];
  const idx = flow.indexOf(status === "hold" ? "booked" : status);
  const booker = USERS.find((u) => u.id === bookerId)!;
  const trail: Stamp[] = flow.slice(0, idx + 1).map((s, i) => ({
    status: s,
    at: now - ageH * h + i * 0.4 * h,
    by: i === 0 ? booker.initials : i === 1 ? "KH" : i === 2 ? "IA" : i === 3 ? "KH" : i === 4 ? "BR" : "FM",
  }));
  return {
    id: `o${n}`, folio: `SO-${1000 + n}`, customerId, bookerId, lines, status, createdAt: now - ageH * h,
    trail, paid: 0, ...extra,
  };
}

const L = (productId: string, unit: "ctn" | "pcs", qty: number, rate: number, discPct = 0): Line => ({
  productId, unit, qty, rate, discPct,
});

export const ORDERS: Order[] = [
  mk(42, "c1", "u-b1", [L("p1", "ctn", 15, 8500, 2), L("p2", "ctn", 1, 5200, 1.5), L("p3", "ctn", 5, 4200), L("p4", "ctn", 8, 5600, 1), L("p5", "ctn", 4, 6800, 1), L("p6", "ctn", 10, 9200, 0.5)], "booked", 0.2),
  mk(41, "c2", "u-b2", [L("p7", "ctn", 5, 3300), L("p11", "ctn", 6, 3900)], "booked", 0.4),
  mk(40, "c5", "u-b2", [L("p8", "ctn", 6, 7400, 1), L("p9", "ctn", 4, 6100)], "approved", 1.2),
  mk(39, "c6", "u-b2", [L("p12", "ctn", 5, 4800), L("p3", "ctn", 2, 4200)], "invoiced", 5, { challanNo: "DC-2039", invoiceNo: "INV-3039" }),
  mk(38, "c4", "u-b2", [L("p11", "ctn", 3, 3900), L("p7", "ctn", 2, 3300)], "booked", 3),
  mk(37, "c3", "u-b1", [L("p1", "ctn", 10, 8500), L("p10", "ctn", 5, 7900, 1)], "booked", 4),
  mk(36, "c7", "u-b3", [L("p9", "ctn", 8, 6100, 2), L("p8", "ctn", 5, 7400)], "picked", 8, { challanNo: "DC-2036" }),
  mk(35, "c9", "u-b3", [L("p2", "ctn", 3, 5200), L("p4", "ctn", 3, 5600)], "delivered", 26, { challanNo: "DC-2035", invoiceNo: "INV-3035", deliveryBoyId: "u-d1" }),
  mk(34, "c8", "u-b3", [L("p7", "ctn", 4, 3300)], "paid", 30, { challanNo: "DC-2034", invoiceNo: "INV-3034", deliveryBoyId: "u-d1", paid: Math.round(4 * 3300 * 1.18) }),
];

export const PURCHASES: PurchaseOrder[] = [
  {
    id: "po1", folio: "PO-7011", supplier: "Unilever Pakistan", status: "ordered", createdAt: now - 30 * h,
    lines: [{ productId: "p3", ordered: 40 }, { productId: "p5", ordered: 30 }, { productId: "p1", ordered: 25 }],
  },
  {
    id: "po2", folio: "PO-7010", supplier: "Tapal Tea Ltd", status: "received", createdAt: now - 54 * h,
    lines: [{ productId: "p4", ordered: 20, received: 19 }],
  },
];

export const PAYMENTS: Payment[] = [];
