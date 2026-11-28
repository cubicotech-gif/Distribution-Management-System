import type { Allocation, Bin, Handover, Customer, Grn, Order, Payment, PriceList, Product, PurchaseOrder, User, Line, OrderStatus, Stamp, ReturnNote, Route, Scheme, StockEntry, Supplier, Trip } from "./types";

export const USERS: User[] = [
  { id: "u-admin", name: "Zarie Khan", initials: "ZK", role: "admin", title: "Owner" },
  { id: "u-sales", name: "Kamran Hussain", initials: "KH", role: "sales", title: "Back Office" },
  { id: "u-wh", name: "Imran Ali", initials: "IA", role: "warehouse", whRole: "storekeeper", title: "Warehouse · Storekeeper" },
  { id: "u-wh2", name: "Danish Khan", initials: "DK", role: "warehouse", whRole: "picker", title: "Warehouse · Picker" },
  { id: "u-wh3", name: "Hamid Raza", initials: "HR", role: "warehouse", whRole: "loader", title: "Warehouse · Loader" },
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
  const bs = batches.map(([no, expiry, ctn], i) => ({ id: `${id}-b${i}`, no, expiry, qty: ctn * packSize, bin: "" }));
  return {
    id, status: "active", code, name, brand, supplier, packSize, cartonPrice, costPrice: Math.round(cartonPrice * costPct),
    taxPct: 18, batches: bs, stock: bs.reduce((s, b) => s + b.qty, 0), damaged: 0, quarantine: [], reserved: 0,
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
  P("p10", "RF-08", "Rafhan Corn Oil 3L", "Rafhan", "Rafhan Maize", 6, 7900, 0.88, [["RF2704", "2027-04", 9], ["RF2610", "2026-10", 2]], 10, 45, "C-02", 6),
  P("p11", "ML-12", "Meezan Biscuits Family", "Meezan", "Meezan Foods", 36, 3900, 0.89, [["ML2612", "2026-12", 25], ["ML2703", "2027-03", 45]], 20, 25, "D-02", 4),
  { id: "p13", status: "unlisted", code: "LY-21", name: "Lays Masala 50g", brand: "PepsiCo", supplier: "PepsiCo Pakistan", packSize: 48, cartonPrice: 0, costPrice: 3150, taxPct: 18, stock: 0, batches: [], damaged: 0, quarantine: [], reserved: 0, reorder: 240, leadDays: 5, bin: "", hue: 38 },
  P("p12", "SG-14", "Shield Dish Wash 500ml", "Shield", "Shield Chemicals", 12, 4800, 0.86, [["SG2708", "2027-08", 22], ["SG2611", "2026-11", 3]], 8, 160, "A-06", 7),
];

const CAT: Record<string, string> = {
  p1: "Detergents & cleaning", p3: "Detergents & cleaning", p12: "Detergents & cleaning",
  p2: "Soap & personal care", p8: "Soap & personal care", p9: "Soap & personal care",
  p4: "Tea & beverages", p5: "Tea & beverages", p7: "Tea & beverages",
  p6: "Cooking oil & staples", p10: "Cooking oil & staples",
  p11: "Snacks & biscuits", p13: "Snacks & biscuits",
};
export const PRODUCTS: Product[] = RAW_PRODUCTS.map((p, i) => ({ ...p, category: CAT[p.id] ?? "General", barcode: `896400${String(1000 + i * 37).padStart(6, "0")}` }));

export const ZONES: Record<string, string> = {
  A: "Home & personal care", B: "Tea & beverages", C: "Oil & heavy goods", D: "Dairy & snacks (short shelf life)",
  E: "New items & overflow", Q: "Quality hold", R: "Receiving dock",
};
const LEVEL_CAP = [60, 40, 30]; // cartons per level, level 1 is the floor / pick face

function buildBins(): Bin[] {
  const racks = new Set<string>(["A-07", "B-03", "E-01", "E-02"]);
  for (const p of PRODUCTS) if (p.bin) racks.add(p.bin);
  const out: Bin[] = [];
  for (const r of Array.from(racks).sort()) for (let l = 1; l <= 3; l++) out.push({ code: `${r}-${l}`, zone: r[0], capacity: LEVEL_CAP[l - 1] });
  for (const z of ["A", "B", "C", "D"]) out.push({ code: `${z}-OV`, zone: z, capacity: 200, note: "Overflow" });
  out.push({ code: "Q-01", zone: "Q", capacity: 100, note: "Quality hold cage" });
  out.push({ code: "RCV", zone: "R", capacity: 500, note: "Receiving dock" });
  return out;
}
export const BINS: Bin[] = buildBins();

// Spread each product's batches over its rack: floor first, then upper levels, then the zone overflow.
(function assignBins() {
  const dock = PRODUCTS.find((x) => x.id === "p6")!; // a Dalda delivery that has not been put away yet
  dock.batches.push({ id: "p6-b9", no: "DL2706", expiry: "2027-06", qty: 6 * dock.packSize, bin: "RCV" });
  for (const p of PRODUCTS) {
    const free = [1, 2, 3].map((l) => ({ code: `${p.bin}-${l}`, left: LEVEL_CAP[l - 1] }));
    const fixed = p.batches.filter((b) => b.bin);
    const toPlace = p.batches.filter((b) => !b.bin).sort((a, b) => a.expiry.localeCompare(b.expiry));
    void fixed;
    const rows: typeof p.batches = [...fixed];
    for (const b of toPlace) {
      let left = Math.round(b.qty / p.packSize);
      let n = 0;
      while (left > 0) {
        const slot = free.find((f) => f.left > 0);
        const take = slot ? Math.min(left, slot.left) : left;
        const code = slot ? slot.code : `${p.bin[0]}-OV`;
        if (slot) slot.left -= take;
        rows.push({ id: `${b.id}-${n++}`, no: b.no, expiry: b.expiry, qty: take * p.packSize, bin: code });
        left -= take;
      }
    }
    p.batches = rows;
    p.stock = rows.reduce((s, b) => s + b.qty, 0);
  }
})();

// When each product was last counted (drives the ABC count schedule).
(function stampCounts() {
  const days: Record<string, number> = { p1: 3, p2: 10, p3: 40, p4: 2, p5: 35, p6: 5, p7: 12, p8: 80, p9: 20, p10: 95, p11: 30, p12: 100 };
  for (const p of PRODUCTS) if (days[p.id] !== undefined) p.lastCount = Date.now() - days[p.id] * 86400000;
})();

// How long ago each batch arrived (gives the ageing report something real to show).
(function stampBatches() {
  PRODUCTS.forEach((p, pi) => {
    const nos = Array.from(new Set(p.batches.map((b) => b.no)));
    for (const b of p.batches) {
      const bi = nos.indexOf(b.no);
      const slow = p.id === "p10" || p.id === "p12";
      const days = b.no === "DL2706" ? 0.2 : slow ? 72 + bi * 25 : 6 + ((bi * 37 + pi * 17) % 84);
      b.receivedAt = Date.now() - days * 86400000;
      if (b.no === "NM2611" || b.no === "ML2612") b.clearance = false;
    }
  });
})();

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
  { id: "po1", folio: "PO-7011", supplier: "Unilever Pakistan", status: "ordered", createdAt: now - 30 * h, expectedAt: now + 3 * h, lines: [{ productId: "p3", ordered: 40 }, { productId: "p5", ordered: 30 }, { productId: "p1", ordered: 25 }] },
  { id: "po3", folio: "PO-7012", supplier: "PepsiCo Pakistan", status: "ordered", createdAt: now - 6 * h, expectedAt: now + 26 * h, lines: [{ productId: "p13", ordered: 30 }] },
  { id: "po4", folio: "PO-7009", supplier: "Nestle Pakistan", status: "ordered", createdAt: now - 80 * h, expectedAt: now - 20 * h, lines: [{ productId: "p7", ordered: 40 }] },
  { id: "po2", folio: "PO-7010", supplier: "Tapal Tea Ltd", status: "ordered", createdAt: now - 54 * h, expectedAt: now - 6 * h, lines: [{ productId: "p4", ordered: 20 }] },
];

export const GRNS: Grn[] = [
  {
    id: "g1", folio: "GRN-9001", poId: "po2", supplier: "Tapal Tea Ltd", deliveryNote: "TT-44721", vehicle: "LEB-3310", driver: "Aslam", status: "counted",
    arrivedAt: now - 5 * h, countedAt: now - 4 * h, by: "IA",
    lines: [{ productId: "p4", arrived: 19, rejected: 0, damaged: 1, held: 0, batch: "TD2608", expiry: "2027-08", reason: "Damaged in transit" }],
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
  { id: "r2", folio: "RT-500", orderId: "o34", customerId: "c8", productId: "p7", qtyPcs: 12, reason: "damaged", status: "received", by: "BR", at: now - 5 * h, receivedQty: 12, receivedAt: now - 1 * h, receivedBy: "IA", intakeNote: "Cartons wet at the bottom, contents spoiled" },
];

// Sales of the previous 13 days (Rs.), used by the owner's trend chart
export const HISTORY = [1.42, 1.18, 1.65, 1.31, 0.92, 1.58, 1.74, 1.29, 1.51, 1.12, 1.68, 1.83, 1.47].map((m) => m * 1_000_000);

// Which batches the already-picked seed orders were taken from (so recall tracing has real customers to show).
(function allocateSeedOrders() {
  for (const o of ORDERS) {
    if (!["picked", "invoiced", "delivered", "paid"].includes(o.status)) continue;
    const alloc: Allocation[] = [];
    o.lines.forEach((l, i) => {
      const p = PRODUCTS.find((x) => x.id === l.productId)!;
      const pcs = l.unit === "ctn" ? l.qty * p.packSize : l.qty;
      const b = [...p.batches].filter((x) => x.bin !== "RCV").sort((a, c) => a.expiry.localeCompare(c.expiry))[0];
      if (b) alloc.push({ i, batch: b.no, expiry: b.expiry, pcs, bin: b.bin });
    });
    o.allocation = alloc;
  }
})();

// A believable stock ledger: each batch was received, picked from over the following weeks, and the seed orders picked from it.
export const LEDGER: StockEntry[] = (() => {
  const out: StockEntry[] = [];
  let n = 0;
  const picked = new Map<string, number>();
  for (const o of ORDERS) {
    if (!o.allocation) continue;
    const at = o.trail.find((t) => t.status === "picked")?.at ?? o.createdAt;
    for (const a of o.allocation) {
      const l = o.lines[a.i];
      const key = `${l.productId}|${a.batch}`;
      picked.set(key, (picked.get(key) ?? 0) + a.pcs);
      out.push({ id: `sl${n++}`, at, by: "IA", productId: l.productId, kind: "pick", batch: a.batch, from: a.bin, qty: -a.pcs, pcs: a.pcs, ref: o.challanNo ?? o.folio, orderId: o.id, note: CUSTOMERS.find((c) => c.id === o.customerId)?.name });
    }
  }
  const now2 = Date.now();
  PRODUCTS.forEach((p, pi) => {
    const slow = p.id === "p10" || p.id === "p12";
    for (const no of Array.from(new Set(p.batches.map((b) => b.no)))) {
      const rows = p.batches.filter((b) => b.no === no);
      const rcv = rows[0].receivedAt ?? now2 - 20 * 86400000;
      const cur = rows.reduce((s, b) => s + b.qty, 0);
      // earlier picks from this batch (customers of past orders)
      const span = Math.max(0, now2 - 2 * 86400000 - rcv);
      for (let k = 0; k < (slow ? 1 : 3) && span > 3 * 86400000; k++) {
        const pcs = Math.max(1, Math.ceil((cur * (0.05 + 0.04 * k)) / p.packSize)) * p.packSize;
        const at = slow ? rcv + 3 * 86400000 : rcv + ((k + 1) * span) / 4;
        const cust = CUSTOMERS[(pi + k * 3) % CUSTOMERS.length];
        picked.set(`${p.id}|${no}`, (picked.get(`${p.id}|${no}`) ?? 0) + pcs);
        out.push({ id: `sl${n++}`, at, by: "IA", productId: p.id, kind: "pick", batch: no, from: rows[0].bin, qty: -pcs, pcs, ref: `DC-${1900 + ((pi * 13 + k * 7) % 90)}`, orderId: `h${n}`, note: cust.name });
      }
      const qty = cur + (picked.get(`${p.id}|${no}`) ?? 0);
      out.push({ id: `sl${n++}`, at: rcv, by: "IA", productId: p.id, kind: "receipt", batch: no, to: "RCV", qty, pcs: qty, ref: `GRN-${8000 + pi * 7 + (n % 5)}`, note: p.supplier });
    }
  });
  return out.sort((a, b) => b.at - a.at);
})();

export const VEHICLES = [
  { no: "LEA-4821", label: "Hino truck", capacity: 120 },
  { no: "LEB-3310", label: "Shehzore pickup", capacity: 80 },
  { no: "LES-901", label: "Suzuki Bolan", capacity: 20 },
];

// Seed orders that are already past the picking stage were packed and checked.
for (const o of ORDERS) {
  if (["picked", "invoiced", "delivered", "paid"].includes(o.status)) {
    o.packed = true; o.packedBy = "IA"; o.packedAt = o.createdAt + 2 * 3600_000;
    o.cartons = Math.max(1, Math.round(o.lines.reduce((s, l) => { const p = PRODUCTS.find((x) => x.id === l.productId)!; return s + (l.unit === "ctn" ? l.qty : l.qty / p.packSize); }, 0)));
  }
}

// Who picked the seed orders and how: gives the pick-accuracy report something to compare.
(function seedPickers() {
  const who: Record<string, [string, number, number]> = { o36: ["DK", 4, 0], o35: ["IA", 2, 2], o34: ["DK", 1, 0], o39: ["IA", 3, 1] };
  for (const o of ORDERS) { const w = who[o.id]; if (w) { o.pickedBy = w[0]; o.pickStats = { scan: w[1], manual: w[2] }; } }
  const o35 = ORDERS.find((o) => o.id === "o35"); if (o35) o35.lines[0].shortReason = "Not enough on shelf";
})();

export const HANDOVERS: Handover[] = [
  { id: "hv1", at: Date.now() - 9 * 3600_000, by: "IA", shift: "Evening", important: true, ackBy: ["IA"], text: "Rack A-07-1 shelf is cracked and blocked. Do not use until maintenance fixes it. Dalda delivery is at the dock waiting for putaway." },
  { id: "hv2", at: Date.now() - 20 * 3600_000, by: "DK", shift: "Morning", important: false, ackBy: ["DK", "IA"], text: "Tapal truck was 6 hours late. Count is done, waiting for purchasing approval." },
];
