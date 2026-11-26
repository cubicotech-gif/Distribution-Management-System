export type Role = "admin" | "sales" | "warehouse" | "purchasing" | "booker" | "delivery" | "recovery";

export interface User {
  id: string;
  name: string;
  initials: string;
  role: Role;
  title: string;
  target?: number; // monthly sales target (bookers)
  baseline?: number; // sales already achieved this month before the demo started
}

export interface Batch {
  id: string;
  no: string;
  expiry: string; // YYYY-MM
  qty: number; // pcs
}

export type ProductStatus = "active" | "inactive" | "unlisted";

export interface Product {
  id: string;
  status: ProductStatus; // unlisted = arrived or ordered but not priced yet; inactive = hidden from bookers
  code: string;
  name: string;
  brand: string;
  supplier: string;
  packSize: number; // pcs per carton
  cartonPrice: number; // sale price
  costPrice: number; // purchase cost per carton
  taxPct: number;
  stock: number; // good pcs (sum of batches)
  batches: Batch[];
  damaged: number; // pcs in quarantine / damaged
  reserved: number; // pcs reserved against approved orders
  reorder: number; // pcs
  leadDays: number; // supplier lead time
  bin: string; // rack location
  hue: number;
}

export interface Customer {
  id: string;
  name: string;
  area: string;
  route: string;
  bookerId: string;
  type: "credit" | "cash";
  creditLimit: number;
  creditDays: number;
  balance: number;
  oldestDue: number; // age in days of the oldest opening balance
  phone: string;
}

export type Unit = "ctn" | "pcs";

export interface Line {
  productId: string;
  unit: Unit;
  qty: number;
  rate: number; // per selected unit
  discPct: number;
  scheme?: string; // label of auto-applied scheme
  pickedQty?: number;
  orderedQty?: number;
  shortReason?: string;
}

export type OrderStatus =
  | "booked"
  | "approved"
  | "picked"
  | "invoiced"
  | "delivered"
  | "paid"
  | "hold"
  | "cancelled";

export interface Stamp {
  status: OrderStatus;
  at: number;
  by: string;
}

export interface Allocation {
  i: number; // line index
  batch: string;
  expiry: string;
  pcs: number;
}

export interface Order {
  id: string;
  folio: string;
  customerId: string;
  bookerId: string;
  lines: Line[];
  status: OrderStatus;
  createdAt: number;
  trail: Stamp[];
  challanNo?: string;
  invoiceNo?: string;
  invoicedAt?: number;
  tripId?: string;
  allocation?: Allocation[];
  needsOwner?: string[]; // reasons the owner must approve
  paid: number;
  note?: string;
  returned?: number;
  signature?: string;
  filed?: boolean;
}

export interface Trip {
  id: string;
  folio: string;
  vehicle: string;
  driverId: string;
  keId: string;
  orderIds: string[];
  status: "loading" | "out" | "closed";
  createdAt: number;
  dispatchedAt?: number;
  closedAt?: number;
  expectedCash?: number;
  countedCash?: number;
}

export interface PurchaseLine {
  productId: string;
  ordered: number; // cartons
  received?: number; // cartons counted
  damaged?: number; // cartons damaged on arrival
  batch?: string;
  expiry?: string;
}
export interface PurchaseOrder {
  id: string;
  folio: string;
  supplier: string;
  lines: PurchaseLine[];
  status: "ordered" | "received" | "approved";
  createdAt: number;
}

export interface Payment {
  id: string;
  customerId: string;
  orderId?: string;
  tripId?: string;
  amount: number;
  mode: "cash" | "cheque" | "online";
  at: number;
  by: string;
}

export type ReturnReason = "damaged" | "expired" | "wrong item" | "old packaging" | "refused";
export interface ReturnNote {
  id: string;
  folio: string;
  orderId: string;
  customerId: string;
  productId: string;
  qtyPcs: number;
  reason: ReturnReason;
  status: "pending" | "inspected";
  condition?: "good" | "damaged";
  value?: number;
  by: string;
  at: number;
}

export interface SupplierReturn {
  id: string;
  folio: string;
  supplier: string;
  productId: string;
  qtyPcs: number;
  reason: string;
  value: number;
  at: number;
}

export interface StockAdj {
  id: string;
  productId: string;
  deltaPcs: number;
  counted: number;
  reason: string;
  value: number;
  status: "applied" | "pending" | "rejected";
  by: string;
  at: number;
}

export interface Approval {
  id: string;
  kind: "order" | "adjustment" | "price";
  refId: string;
  text: string;
  detail: string;
  amount: number;
  by: string;
  at: number;
  status: "pending" | "approved" | "rejected";
}

export interface Scheme {
  id: string;
  productId: string;
  minCtn: number;
  discPct: number;
}

export interface Activity {
  id: string;
  at: number;
  text: string;
}

export interface PriceChange {
  id: string;
  batchId: string;
  productId: string;
  oldPrice: number;
  newPrice: number;
  pct: number;
  note: string;
  status: "applied" | "pending" | "rejected";
  by: string;
  at: number;
}
