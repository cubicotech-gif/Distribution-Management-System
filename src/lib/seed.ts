import type { Customer, Order, Payment, PriceList, Product, PurchaseOrder, User, Line, OrderStatus, Stamp, ReturnNote, Route, Scheme, Supplier, Trip } from "./types";

export const USERS: User[] = [
  { id: "u-admin", name: "Zarie Khan", initials: "ZK", role: "admin", title: "Owner" },
  { id: "u-sales", name: "Kamran Hussain", initials: "KH", role: "sales", title: "Back Office" },
  { id: "u-wh", name: "Imran Ali", initials: "IA", role: "warehouse", title: "Warehouse" },
  { id: "u-pur", name: "Saima Noor", initials: "SN", role: "purchasing", title: "Purchasing" },
  { id: "u-b1", name: "Muhammad Sabir", initials: "MS", role: "booker", title: "Booker", target: 1500000, baseline: 920000 },
  { id: "u-b2", name: "Zeeshan Ahmed", initials: "ZA", role: "booker", title: "Booker", target: 1400000, baseline: 1180000 },
  { id: "u-b3", name: "Usman Tariq", initials: "UT", role: "booker", title: "Booker", target: 1600000, baseline: 760000 },
  { id: "u-d1", name: "Bilal Raza", initials: "BR", role: "delivery", title: "Delivery" },
  { id: "u-r1", name: "Farhan Malik", initials: "FM", role: "recovery", title: "Recovery (KE)" },
];

type B = [string, string, number]; // batch no, expiry, cartons
const P = (
  id: string, code: string, name: string, brand: string, supplier: string, packSize: number, cartonPrice: number,
  costPct: number, batches: B[], reorderCtn: number, hue: number, bin: string, leadDays: number
): Omit<Product, "category" | "barcode"> => {
  const bs = batches.map(([no, expiry, ctn], i) => ({ id: `${id}-b${i}`, no, expiry, qty: ctn * packSize }));
  return {
    id, status: "active", code, name, brand, supplier, packSize, cartonPrice, costPrice: Math.round(cartonPrice * costPct),
    taxPct: 18, batches: bs, stock: bs.reduce((s, b) => s + b.qty, 0), damaged: 0, reserved: 0,
    reorder: reorderCtn * packSize, leadDays, bin, hue,
  };
};

const RAW_PRODUCTS: Omit<Product, "category" | "barcode">[] = [
  P("p1", "SE-01", "Surf Excel 1kg", "Unilever", "Unilever Pakistan", 12, 8500, 0.86, [["SE2603", "2027-03", 12], ["SE2606", "2027-06", 30]], 20, 215, "A-01", 5),
  P("p2", "LX-04", "Lux Soap 100g", "Unilever", "Unilever Pakistan", 72, 5200, 0.84, [["LX2701", "2028-01", 140]], 40, 330, "A-02", 5),
  P("p3", "VM-02", "Vim Bar Regular 100g", "Unilever", "Unilever Pakistan", 48, 4200, 0.85, [["VM2609", "2027-09", 12]], 15, 140, "A-03", 5),
  P("p4", "TD-19", "Tapal Danedar 190g", "Tapal", "Tapal Tea Ltd", 24, 5600, 0.87, [["TD2603", "2027-03", 15]], 10, 8, "B-01", 7),
  P("p5", "LP-05", "Lipton Yellow Label 200g", "Unilever", "Unilever Pakistan", 24, 6800, 0.86, [["LP2702", "2027-02", 2]], 10, 48, "B-02", 5),
  P("p6", "DL-55", "Dalda Cooking Oil 5L", "Dalda", "Dalda Foods", 4, 9200, 0.88, [["DL2705", "2027-05", 18]], 8, 95, "C-01", 6),
  P("p7", "NM-10", "Nestle Milkpak 1L", "Nestle", "Nestle Pakistan", 12, 3300, 0.9, [["NM2611", "2026-12", 18], ["NM2702", "2027-03", 42]], 30, 205, "D-01", 4),
  P("p8", "CL-07", "Colgate Strong Teeth 100g", "Colgate", "Colgate-Palmolive", 48, 7400, 0.85, [["CL2803", "2028-03", 25]], 12, 0, "A-04", 6),
  P("p9", "SH-03", "Sunsilk Shampoo 200ml", "Unilever", "Unilever Pakistan", 24, 6100, 0.84, [["SH2802", "2028-02", 30]], 12, 290, "A-05", 5),
  P("p10", "RF-08", "Rafhan Corn Oil 3L", "Rafhan", "Rafhan Maize", 6, 7900, 0.88, [["RF2704", "2027-04", 9]], 10, 45, "C-02", 6),
  P("p11", "ML-12", "Meezan Biscuits Family", "Meezan", "Meezan Foods", 36, 3900, 0.89, [["ML2612", "2026-12", 25], ["ML2703", "2027-03", 45]], 20, 25, "D-02", 4),
  { id: "p13", status: "unlisted", code: "LY-21", name: "Lays Masala 50g", brand: "PepsiCo", supplier: "PepsiCo Pakistan", packSize: 48, cartonPrice: 0, costPrice: 3150, taxPct: 18, stock: 0, batches: [], damaged: 0, reserved: 0, reorder: 240, leadDays: 5, bin: "", hue: 38 },
  P("p12", "SG-14", "Shield Dish Wash 500ml", "Shield", "Shield Chemicals", 12, 4800, 0.86, [["SG2708", "2027-08", 22]], 8, 160, "A-06", 7),
];

const CAT: Record<string, string> = {
  p1: "Detergents & cleaning", p3: "Detergents & cleaning", p12: "Detergents & cleaning",
  p2: "Soap & personal care", p8: "Soap & personal care", p9: "Soap & personal care",
  p4: "Tea & beverages", p5: "Tea & beverages", p7: "Tea & beverages",
  p6: "Cooking oil & staples", p10: "Cooking oil & staples",
  p11: "Snacks & biscuits", p13: "Snacks & biscuits",
};
export const PRODUCTS: Product[] = RAW_PRODUCTS.map((p, i) => ({ ...p, category: CAT[p.id] ?? "General", barcode: `896400${String(1000 + i * 37).padStart(6, "0")}` }));

const C = (
  id: string, name: string, area: string, route: string, bookerId: string, type: "credit" | "cash",
  creditLimit: number, creditDays: number, balance: number, oldestDue: number, phone: string, priceListId = "pl1"
): Customer => ({ id, name, area, route, bookerId, type, status: "active", priceListId, creditLimit, creditDays, balance, oldestDue, phone });

export const CUSTOMERS: Customer[] = [
  C("c1", "Ali General Store", "Anarkali", "Anarkali #4", "u-b1", "credit", 250000, 15, 184000, 12, "0300-4455120"),
  C("c2", "Al-Karam Traders", "Anarkali", "Anarkali #4", "u-b1", "credit", 300000, 21, 45200, 6, "0321-7788123"),
  C("c3", "Madina Provision Store", "Anarkali", "Anarkali #4", "u-b1", "credit", 200000, 15, 141800, 34, "0333-1209844"),
  C("c4", "Bismillah Karyana Store", "Mozang", "Mozang #2", "u-b2", "credit", 120000, 10, 29400, 4, "0345-2200981"),
  C("c5", "Ghazi Provision Store", "Mozang", "Mozang #2", "u-b2", "credit", 150000, 15, 112000, 18, "0300-9087761"),
  C("c6", "Bilal & Sons", "Mozang", "Mozang #2", "u-b2", "credit", 180000, 15, 68900, 9, "0322-5543210"),
  C("c7", "Noor Mart", "Gulberg", "Gulberg #1", "u-b3", "credit", 400000, 30, 212000, 22, "0301-6677889", "pl2"),
  C("c8", "Fresh Corner", "Gulberg", "Gulberg #1", "u-b3", "cash", 0, 0, 0, 0, "0333-4412090", "pl3"),
  C("c9", "Hamza Super Store", "Model Town", "Model Town #3", "u-b3", "credit", 220000, 15, 96500, 11, "0312-8800761", "pl2"),
  C("c10", "City Kiryana", "Model Town", "Model Town #3", "u-b3", "cash", 0, 0, 0, 0, "0345-1122334", "pl3"),
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
  mk(39, "c6", "u-b2", [L("p12", "ctn", 5, 4800), L("p3", "ctn", 2, 4200)], "invoiced", 5, { challanNo: "DC-2039", invoiceNo: "INV-3039", tripId: "t1" }),
  mk(38, "c4", "u-b2", [L("p11", "ctn", 3, 3900), L("p7", "ctn", 2, 3300)], "booked", 3),
  mk(37, "c3", "u-b1", [L("p1", "ctn", 10, 8500), L("p10", "ctn", 5, 7900, 1)], "booked", 4),
  mk(36, "c7", "u-b3", [L("p9", "ctn", 8, 6100, 2), L("p8", "ctn", 5, 7400)], "picked", 8, { challanNo: "DC-2036" }),
  mk(35, "c9", "u-b3", [L("p2", "ctn", 3, 5200), L("p4", "ctn", 3, 5600)], "delivered", 26, { challanNo: "DC-2035", invoiceNo: "INV-3035", tripId: "t1" }),
  mk(34, "c8", "u-b3", [L("p7", "ctn", 4, 3300)], "paid", 30, { challanNo: "DC-2034", invoiceNo: "INV-3034", paid: Math.round(4 * 3300 * 1.18) }),
];

export const PURCHASES: PurchaseOrder[] = [
  {
    id: "po1", folio: "PO-7011", supplier: "Unilever Pakistan", status: "ordered", createdAt: now - 30 * h,
    lines: [{ productId: "p3", ordered: 40 }, { productId: "p5", ordered: 30 }, { productId: "p1", ordered: 25 }],
  },
  {
    id: "po3", folio: "PO-7012", supplier: "PepsiCo Pakistan", status: "ordered", createdAt: now - 6 * h,
    lines: [{ productId: "p13", ordered: 30 }],
  },
  {
    id: "po2", folio: "PO-7010", supplier: "Tapal Tea Ltd", status: "received", createdAt: now - 54 * h,
    lines: [{ productId: "p4", ordered: 20, received: 19, damaged: 1, batch: "TD2608", expiry: "2027-08" }],
  },
];

export const PAYMENTS: Payment[] = [];

export const SCHEMES: Scheme[] = [
  { id: "s1", productId: "p1", type: "discount", minCtn: 10, discPct: 2, freeCtn: 0 },
  { id: "s2", productId: "p2", type: "discount", minCtn: 5, discPct: 1.5, freeCtn: 0 },
  { id: "s3", productId: "p7", type: "discount", minCtn: 10, discPct: 3, freeCtn: 0, to: "2026-12-31" },
  { id: "s4", productId: "p11", type: "discount", minCtn: 8, discPct: 2.5, freeCtn: 0 },
  { id: "s5", productId: "p8", type: "discount", minCtn: 6, discPct: 1, freeCtn: 0 },
  { id: "s6", productId: "p6", type: "free", minCtn: 10, discPct: 0, freeCtn: 1 },
];

export const ROUTES: Route[] = [
  { id: "rt1", name: "Anarkali #4", bookerId: "u-b1", days: ["Mon", "Wed", "Fri"] },
  { id: "rt2", name: "Mozang #2", bookerId: "u-b2", days: ["Tue", "Thu", "Sat"] },
  { id: "rt3", name: "Gulberg #1", bookerId: "u-b3", days: ["Mon", "Thu"] },
  { id: "rt4", name: "Model Town #3", bookerId: "u-b3", days: ["Wed", "Sat"] },
];

export const PRICE_LISTS: PriceList[] = [
  { id: "pl1", name: "Standard", adjustPct: 0, overrides: {} },
  { id: "pl2", name: "Wholesale", adjustPct: -2, overrides: {} },
  { id: "pl3", name: "Retail", adjustPct: 3, overrides: {} },
];

export const SUPPLIERS: Supplier[] = [
  { id: "sp1", name: "Unilever Pakistan", contact: "Hassan Raza", phone: "042-111-222-333", terms: "Net 15", leadDays: 5 },
  { id: "sp2", name: "Tapal Tea Ltd", contact: "Faisal Ahmed", phone: "021-3456-7890", terms: "Net 7", leadDays: 7 },
  { id: "sp3", name: "Dalda Foods", contact: "Nadia Khan", phone: "021-3567-1122", terms: "Net 15", leadDays: 6 },
  { id: "sp4", name: "Nestle Pakistan", contact: "Omar Sheikh", phone: "042-3577-0000", terms: "Net 30", leadDays: 4 },
  { id: "sp5", name: "Colgate-Palmolive", contact: "Sana Iqbal", phone: "021-3250-1111", terms: "Net 21", leadDays: 6 },
  { id: "sp6", name: "Rafhan Maize", contact: "Tariq Mehmood", phone: "042-3542-2200", terms: "Net 15", leadDays: 6 },
  { id: "sp7", name: "Meezan Foods", contact: "Bilal Siddiqui", phone: "042-3588-4400", terms: "Net 7", leadDays: 4 },
  { id: "sp8", name: "Shield Chemicals", contact: "Rabia Anwar", phone: "042-3599-1000", terms: "Net 7", leadDays: 7 },
  { id: "sp9", name: "PepsiCo Pakistan", contact: "Danish Lodhi", phone: "042-3500-7788", terms: "Net 21", leadDays: 5 },
];

export const TRIPS: Trip[] = [
  { id: "t1", folio: "TRIP-100", vehicle: "LEA-4821", driverId: "u-d1", keId: "u-r1", orderIds: ["o39", "o35"], status: "out", createdAt: now - 20 * h, dispatchedAt: now - 19 * h },
];

export const RETURNS: ReturnNote[] = [
  { id: "r1", folio: "RT-501", orderId: "o35", customerId: "c9", productId: "p2", qtyPcs: 36, reason: "old packaging", status: "pending", by: "BR", at: now - 2 * h },
];

// Sales of the previous 13 days (Rs.), used by the owner's trend chart
export const HISTORY = [1.42, 1.18, 1.65, 1.31, 0.92, 1.58, 1.74, 1.29, 1.51, 1.12, 1.68, 1.83, 1.47].map((m) => m * 1_000_000);
